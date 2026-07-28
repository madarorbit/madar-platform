-- ORBY Stage 3 worker RPCs, vector search, retention and insight deduplication.
-- All functions are server-only and execute with a fixed empty search_path.

create or replace function public.orby_expire_memories(cutoff timestamptz,batch_limit integer default 500)
returns integer
language plpgsql
security definer set search_path=''
as $$
declare affected integer;
begin
 with targets as (
  select id from public.orby_memories
  where deleted_at is null and expires_at is not null and expires_at<=cutoff
  order by expires_at asc
  limit greatest(1,least(batch_limit,5000))
  for update skip locked
 )
 update public.orby_memories m set deleted_at=now(),updated_at=now()
 from targets t where m.id=t.id;
 get diagnostics affected=row_count;
 return affected;
end;
$$;

create or replace function public.orby_find_memories(
 target_organization uuid,target_user uuid,target_workspace uuid,memory_kinds jsonb default '[]'::jsonb,
 memory_query text default null,match_count integer default 12,at_time timestamptz default now()
)
returns setof public.orby_memories
language sql
stable
security definer set search_path=''
as $$
 select m.* from public.orby_memories m
 where m.organization_id=target_organization
  and m.deleted_at is null
  and (m.expires_at is null or m.expires_at>at_time)
  and (m.user_id is null or m.user_id=target_user)
  and (m.workspace_id is null or m.workspace_id=target_workspace)
  and (jsonb_array_length(memory_kinds)=0 or m.kind in (select value from jsonb_array_elements_text(memory_kinds)))
 order by
  case when nullif(trim(memory_query),'') is null then 0 when to_tsvector('simple',m.content||' '||m.memory_key) @@ websearch_to_tsquery('simple',memory_query) then 1 else 0 end desc,
  (m.importance*m.confidence) desc,m.updated_at desc
 limit greatest(1,least(match_count,50));
$$;

create or replace function public.orby_replace_knowledge_chunks(target_document uuid,chunk_payload jsonb)
returns setof public.orby_knowledge_chunks
language plpgsql
security definer set search_path=''
as $$
declare doc public.orby_knowledge_documents;
begin
 select * into doc from public.orby_knowledge_documents where id=target_document for update;
 if doc.id is null then raise exception 'ORBY_KNOWLEDGE_DOCUMENT_NOT_FOUND'; end if;
 if jsonb_typeof(chunk_payload)<>'array' then raise exception 'ORBY_CHUNKS_INVALID'; end if;
 delete from public.orby_knowledge_chunks where document_id=target_document;
 return query
 insert into public.orby_knowledge_chunks(document_id,source_id,organization_id,workspace_id,ordinal,content,token_estimate,checksum,heading,metadata)
 select target_document,doc.source_id,doc.organization_id,doc.workspace_id,
  (item->>'ordinal')::integer,item->>'content',(item->>'tokenEstimate')::integer,item->>'checksum',
  nullif(item->>'heading',''),coalesce(item->'metadata','{}'::jsonb)
 from jsonb_array_elements(chunk_payload) item
 order by (item->>'ordinal')::integer
 returning *;
end;
$$;

create or replace function public.orby_save_chunk_embeddings(chunk_ids jsonb,embedding_vectors jsonb,embedding_model_name text)
returns integer
language plpgsql
security definer set search_path=''
as $$
declare total integer;idx integer;target_chunk uuid;target_vector jsonb;target_org uuid;
begin
 if jsonb_typeof(chunk_ids)<>'array' or jsonb_typeof(embedding_vectors)<>'array' then raise exception 'ORBY_EMBEDDINGS_INVALID'; end if;
 total=jsonb_array_length(chunk_ids);
 if total<>jsonb_array_length(embedding_vectors) then raise exception 'ORBY_EMBEDDING_COUNT_MISMATCH'; end if;
 if total=0 then return 0; end if;
 for idx in 0..total-1 loop
  target_chunk=(chunk_ids->>idx)::uuid;target_vector=embedding_vectors->idx;
  if jsonb_typeof(target_vector)<>'array' or jsonb_array_length(target_vector)=0 then raise exception 'ORBY_EMBEDDING_VECTOR_INVALID'; end if;
  select organization_id into target_org from public.orby_knowledge_chunks where id=target_chunk;
  if target_org is null then raise exception 'ORBY_KNOWLEDGE_CHUNK_NOT_FOUND'; end if;
  insert into public.orby_knowledge_embeddings(chunk_id,organization_id,embedding,dimensions,model,updated_at)
  values(target_chunk,target_org,target_vector::text::extensions.vector,jsonb_array_length(target_vector),embedding_model_name,now())
  on conflict(chunk_id) do update set embedding=excluded.embedding,dimensions=excluded.dimensions,model=excluded.model,updated_at=now();
  update public.orby_knowledge_chunks set embedding_model=embedding_model_name,embedding_dimensions=jsonb_array_length(target_vector) where id=target_chunk;
 end loop;
 return total;
end;
$$;

create or replace function public.orby_search_knowledge(
 target_organization uuid,target_workspace uuid,query_embedding jsonb,match_count integer default 8,
 minimum_score double precision default .55,source_filter jsonb default '[]'::jsonb
)
returns table(
 id uuid,document_id uuid,source_id uuid,organization_id uuid,workspace_id uuid,ordinal integer,content text,token_estimate integer,
 checksum text,heading text,metadata jsonb,embedding_model text,embedding_dimensions integer,created_at timestamptz,
 score double precision,citation_label text,document_title text,source_metadata jsonb
)
language sql
stable
security definer set search_path=''
as $$
 select c.id,c.document_id,c.source_id,c.organization_id,c.workspace_id,c.ordinal,c.content,c.token_estimate,c.checksum,c.heading,c.metadata,
  c.embedding_model,c.embedding_dimensions,c.created_at,
  1-(e.embedding OPERATOR(extensions.<=>) query_embedding::text::extensions.vector) as score,
  s.citation_label,d.title,s.metadata
 from public.orby_knowledge_embeddings e
 join public.orby_knowledge_chunks c on c.id=e.chunk_id
 join public.orby_knowledge_documents d on d.id=c.document_id and d.status='ready'
 join public.orby_knowledge_sources s on s.id=c.source_id and s.status<>'archived'
 where c.organization_id=target_organization
  and (target_workspace is null or c.workspace_id is null or c.workspace_id=target_workspace)
  and e.dimensions=jsonb_array_length(query_embedding)
  and (jsonb_array_length(source_filter)=0 or c.source_id in (select value::uuid from jsonb_array_elements_text(source_filter)))
  and 1-(e.embedding OPERATOR(extensions.<=>) query_embedding::text::extensions.vector)>=minimum_score
 order by e.embedding OPERATOR(extensions.<=>) query_embedding::text::extensions.vector
 limit greatest(1,least(match_count,50));
$$;

create or replace function public.orby_enqueue_intelligence_job(
 target_organization uuid,target_workspace uuid,target_job_type text,job_payload jsonb default '{}'::jsonb,
 job_priority integer default 100,job_available_at timestamptz default now(),job_max_attempts integer default 6,job_idempotency_key text default null
)
returns public.orby_intelligence_jobs
language plpgsql
security definer set search_path=''
as $$
declare result public.orby_intelligence_jobs;
begin
 insert into public.orby_intelligence_jobs(organization_id,workspace_id,job_type,payload,priority,available_at,max_attempts,idempotency_key)
 values(target_organization,target_workspace,target_job_type,coalesce(job_payload,'{}'::jsonb),job_priority,job_available_at,greatest(1,least(job_max_attempts,20)),job_idempotency_key)
 on conflict(organization_id,idempotency_key) where idempotency_key is not null do update
  set available_at=least(public.orby_intelligence_jobs.available_at,excluded.available_at),priority=least(public.orby_intelligence_jobs.priority,excluded.priority),updated_at=now()
 returning * into result;
 return result;
end;
$$;

create or replace function public.orby_claim_intelligence_jobs(worker_id text,claim_limit integer default 5,lease_seconds integer default 120)
returns setof public.orby_intelligence_jobs
language plpgsql
security definer set search_path=''
as $$
begin
 return query
 with candidates as (
  select id from public.orby_intelligence_jobs
  where status in ('queued','retry') and available_at<=now()
   and (lease_expires_at is null or lease_expires_at<now())
  order by priority asc,available_at asc,created_at asc
  limit greatest(1,least(claim_limit,20))
  for update skip locked
 )
 update public.orby_intelligence_jobs j
 set status='running',attempts=j.attempts+1,locked_by=worker_id,lease_expires_at=now()+make_interval(secs=>greatest(30,least(lease_seconds,900))),updated_at=now()
 from candidates c where j.id=c.id
 returning j.*;
end;
$$;

create or replace function public.orby_complete_intelligence_job(target_job uuid,worker_id text,job_result jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer set search_path=''
as $$
begin
 update public.orby_intelligence_jobs set status='succeeded',result=coalesce(job_result,'{}'::jsonb),completed_at=now(),locked_by=null,lease_expires_at=null,updated_at=now()
 where id=target_job and status='running' and locked_by=worker_id;
 return found;
end;
$$;

create or replace function public.orby_fail_intelligence_job(target_job uuid,worker_id text,error_code text,error_message text,next_attempt_at timestamptz default null)
returns boolean
language plpgsql
security definer set search_path=''
as $$
begin
 update public.orby_intelligence_jobs
 set status=case when next_attempt_at is null or attempts>=max_attempts then 'dead' else 'retry' end,
  available_at=coalesce(next_attempt_at,available_at),last_error_code=error_code,last_error_message=left(error_message,4000),
  completed_at=case when next_attempt_at is null or attempts>=max_attempts then now() else null end,locked_by=null,lease_expires_at=null,updated_at=now()
 where id=target_job and status='running' and locked_by=worker_id;
 return found;
end;
$$;

create or replace function public.orby_enqueue_due_intelligence_schedules(schedule_limit integer default 100)
returns integer
language plpgsql
security definer set search_path=''
as $$
declare item public.orby_intelligence_schedules;count_jobs integer=0;next_time timestamptz;
begin
 for item in
  select * from public.orby_intelligence_schedules where enabled and next_run_at<=now()
  order by next_run_at asc limit greatest(1,least(schedule_limit,500)) for update skip locked
 loop
  perform public.orby_enqueue_intelligence_job(item.organization_id,item.workspace_id,item.job_type,item.payload,100,item.next_run_at,6,'schedule:'||item.id::text||':'||extract(epoch from item.next_run_at)::bigint::text);
  next_time=item.next_run_at+make_interval(secs=>greatest(coalesce(item.interval_seconds,86400),3600));
  update public.orby_intelligence_schedules set last_run_at=item.next_run_at,next_run_at=next_time,updated_at=now() where id=item.id;
  count_jobs=count_jobs+1;
 end loop;
 return count_jobs;
end;
$$;

create or replace function public.orby_upsert_insight(signal_payload jsonb,cooldown_minutes integer default 180)
returns jsonb
language plpgsql
security definer set search_path=''
as $$
declare existing public.orby_proactive_insights;result public.orby_proactive_insights;is_created boolean=false;is_suppressed boolean=false;detected timestamptz;
begin
 detected=coalesce((signal_payload->>'detectedAt')::timestamptz,now());
 select * into existing from public.orby_proactive_insights
 where organization_id=(signal_payload->>'organizationId')::uuid and fingerprint=signal_payload->>'fingerprint'
 for update;
 if existing.id is null then
  insert into public.orby_proactive_insights(organization_id,workspace_id,detector,fingerprint,title,description,category,severity,confidence,risk_score,opportunity_score,metrics,evidence,root_causes,recommendations,suggested_actions,cooldown_until,first_detected_at,last_detected_at)
  values((signal_payload->>'organizationId')::uuid,nullif(signal_payload->>'workspaceId','')::uuid,signal_payload->>'detector',signal_payload->>'fingerprint',signal_payload->>'title',signal_payload->>'description',signal_payload->>'category',signal_payload->>'severity',(signal_payload->>'confidence')::numeric,(signal_payload->>'riskScore')::integer,(signal_payload->>'opportunityScore')::integer,coalesce(signal_payload->'metrics','{}'::jsonb),coalesce(signal_payload->'evidence','[]'::jsonb),coalesce(signal_payload->'rootCauses','[]'::jsonb),coalesce(signal_payload->'recommendations','[]'::jsonb),coalesce(signal_payload->'suggestedActions','[]'::jsonb),detected+make_interval(mins=>greatest(0,cooldown_minutes)),detected,detected)
  returning * into result;is_created=true;
 else
  is_suppressed=existing.cooldown_until is not null and existing.cooldown_until>detected;
  update public.orby_proactive_insights set title=signal_payload->>'title',description=signal_payload->>'description',category=signal_payload->>'category',severity=signal_payload->>'severity',
   confidence=(signal_payload->>'confidence')::numeric,risk_score=(signal_payload->>'riskScore')::integer,opportunity_score=(signal_payload->>'opportunityScore')::integer,
   metrics=coalesce(signal_payload->'metrics','{}'::jsonb),evidence=coalesce(signal_payload->'evidence','[]'::jsonb),root_causes=coalesce(signal_payload->'rootCauses','[]'::jsonb),
   recommendations=coalesce(signal_payload->'recommendations','[]'::jsonb),suggested_actions=coalesce(signal_payload->'suggestedActions','[]'::jsonb),
   last_detected_at=detected,occurrences=occurrences+1,cooldown_until=case when is_suppressed then cooldown_until else detected+make_interval(mins=>greatest(0,cooldown_minutes)) end,updated_at=now()
  where id=existing.id returning * into result;
 end if;
 return jsonb_build_object('row',to_jsonb(result),'created',is_created,'suppressed',is_suppressed);
end;
$$;

revoke all on function public.orby_expire_memories(timestamptz,integer) from public,anon,authenticated;
revoke all on function public.orby_find_memories(uuid,uuid,uuid,jsonb,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.orby_replace_knowledge_chunks(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.orby_save_chunk_embeddings(jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.orby_search_knowledge(uuid,uuid,jsonb,integer,double precision,jsonb) from public,anon,authenticated;
revoke all on function public.orby_enqueue_intelligence_job(uuid,uuid,text,jsonb,integer,timestamptz,integer,text) from public,anon,authenticated;
revoke all on function public.orby_claim_intelligence_jobs(text,integer,integer) from public,anon,authenticated;
revoke all on function public.orby_complete_intelligence_job(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.orby_fail_intelligence_job(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.orby_enqueue_due_intelligence_schedules(integer) from public,anon,authenticated;
revoke all on function public.orby_upsert_insight(jsonb,integer) from public,anon,authenticated;

grant execute on function public.orby_expire_memories(timestamptz,integer) to service_role;
grant execute on function public.orby_find_memories(uuid,uuid,uuid,jsonb,text,integer,timestamptz) to service_role;
grant execute on function public.orby_replace_knowledge_chunks(uuid,jsonb) to service_role;
grant execute on function public.orby_save_chunk_embeddings(jsonb,jsonb,text) to service_role;
grant execute on function public.orby_search_knowledge(uuid,uuid,jsonb,integer,double precision,jsonb) to service_role;
grant execute on function public.orby_enqueue_intelligence_job(uuid,uuid,text,jsonb,integer,timestamptz,integer,text) to service_role;
grant execute on function public.orby_claim_intelligence_jobs(text,integer,integer) to service_role;
grant execute on function public.orby_complete_intelligence_job(uuid,text,jsonb) to service_role;
grant execute on function public.orby_fail_intelligence_job(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.orby_enqueue_due_intelligence_schedules(integer) to service_role;
grant execute on function public.orby_upsert_insight(jsonb,integer) to service_role;