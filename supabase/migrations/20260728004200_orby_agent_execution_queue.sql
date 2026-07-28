-- ORBY Stage 2 durable queue and execution budget RPCs.
create or replace function public.orby_enqueue_execution_job(
 target_run uuid,target_organization uuid,job_priority integer default 100,job_available_at timestamptz default now(),job_max_attempts integer default 5,job_idempotency_key text default null
) returns public.orby_execution_queue
language plpgsql security definer set search_path=''
as $$
declare queued public.orby_execution_queue;
begin
 if not exists(select 1 from public.orby_workflow_runs r where r.id=target_run and r.organization_id=target_organization) then raise exception 'ORBY_RUN_NOT_FOUND'; end if;
 insert into public.orby_execution_queue(run_id,organization_id,priority,available_at,max_attempts,idempotency_key)
 values(target_run,target_organization,greatest(1,job_priority),job_available_at,least(20,greatest(1,job_max_attempts)),job_idempotency_key)
 on conflict(organization_id,idempotency_key) where idempotency_key is not null
 do update set available_at=least(public.orby_execution_queue.available_at,excluded.available_at),updated_at=now()
 returning * into queued;
 return queued;
end $$;

create or replace function public.orby_claim_execution_jobs(worker_id text,claim_limit integer default 5,lease_seconds integer default 120)
returns setof public.orby_execution_queue
language plpgsql security definer set search_path=''
as $$
begin
 return query
 with candidates as (
  select q.id from public.orby_execution_queue q
  where q.status in ('pending','retry','waiting') and q.available_at<=now() and (q.lease_expires_at is null or q.lease_expires_at<=now())
  order by q.priority asc,q.created_at asc
  for update skip locked
  limit least(20,greatest(1,claim_limit))
 )
 update public.orby_execution_queue q set status='running',locked_at=now(),locked_by=worker_id,lease_expires_at=now()+make_interval(secs=>least(900,greatest(30,lease_seconds))),attempts=q.attempts+1,updated_at=now()
 from candidates c where q.id=c.id returning q.*;
end $$;

create or replace function public.orby_heartbeat_execution_job(target_job uuid,worker_id text,lease_seconds integer default 120)
returns boolean language sql security definer set search_path=''
as $$
 update public.orby_execution_queue set lease_expires_at=now()+make_interval(secs=>least(900,greatest(30,lease_seconds))),updated_at=now()
 where id=target_job and status='running' and locked_by=worker_id returning true
$$;

create or replace function public.orby_complete_execution_job(target_job uuid,worker_id text,job_result jsonb default '{}'::jsonb)
returns boolean language sql security definer set search_path=''
as $$
 update public.orby_execution_queue set status='completed',result=coalesce(job_result,'{}'::jsonb),locked_at=null,locked_by=null,lease_expires_at=null,completed_at=now(),updated_at=now()
 where id=target_job and status='running' and locked_by=worker_id returning true
$$;

create or replace function public.orby_fail_execution_job(target_job uuid,worker_id text,error_code text,error_message text,next_attempt_at timestamptz default null)
returns boolean language sql security definer set search_path=''
as $$
 update public.orby_execution_queue set status=case when next_attempt_at is not null and attempts<max_attempts then 'retry' else 'failed' end,available_at=coalesce(next_attempt_at,available_at),last_error_code=error_code,last_error_message=left(error_message,2000),locked_at=null,locked_by=null,lease_expires_at=null,completed_at=case when next_attempt_at is null or attempts>=max_attempts then now() else null end,updated_at=now()
 where id=target_job and status='running' and locked_by=worker_id returning true
$$;

create or replace function public.orby_cancel_execution_run(target_run uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 update public.orby_execution_queue set status='cancelled',locked_at=null,locked_by=null,lease_expires_at=null,completed_at=now(),updated_at=now() where run_id=target_run and status not in ('completed','failed','cancelled');
 update public.orby_workflow_runs set status='cancelled',completed_at=coalesce(completed_at,now()),updated_at=now() where id=target_run and status not in ('completed','failed','cancelled');
 return found;
end $$;

create or replace function public.orby_consume_execution_budget(target_organization uuid,target_user uuid,daily_limit integer,minute_limit integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare day_start timestamptz:=date_trunc('day',now());minute_start timestamptz:=date_trunc('minute',now());daily_used integer;minute_used integer;
begin
 if not exists(select 1 from public.organization_members m where m.organization_id=target_organization and m.user_id=target_user) then raise exception 'NOT_AUTHORIZED'; end if;
 insert into public.orby_execution_usage(organization_id,user_id,bucket_type,bucket_start,used) values(target_organization,target_user,'day',day_start,1)
 on conflict(organization_id,user_id,bucket_type,bucket_start) do update set used=public.orby_execution_usage.used+1,updated_at=now() returning used into daily_used;
 insert into public.orby_execution_usage(organization_id,user_id,bucket_type,bucket_start,used) values(target_organization,target_user,'minute',minute_start,1)
 on conflict(organization_id,user_id,bucket_type,bucket_start) do update set used=public.orby_execution_usage.used+1,updated_at=now() returning used into minute_used;
 return jsonb_build_object('allowed',daily_used<=greatest(1,daily_limit) and minute_used<=greatest(1,minute_limit),'dailyUsed',daily_used,'minuteUsed',minute_used);
end $$;

revoke all on function public.orby_enqueue_execution_job(uuid,uuid,integer,timestamptz,integer,text) from public,anon,authenticated;
revoke all on function public.orby_claim_execution_jobs(text,integer,integer) from public,anon,authenticated;
revoke all on function public.orby_heartbeat_execution_job(uuid,text,integer) from public,anon,authenticated;
revoke all on function public.orby_complete_execution_job(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.orby_fail_execution_job(uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.orby_cancel_execution_run(uuid) from public,anon,authenticated;
revoke all on function public.orby_consume_execution_budget(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.orby_enqueue_execution_job(uuid,uuid,integer,timestamptz,integer,text) to service_role;
grant execute on function public.orby_claim_execution_jobs(text,integer,integer) to service_role;
grant execute on function public.orby_heartbeat_execution_job(uuid,text,integer) to service_role;
grant execute on function public.orby_complete_execution_job(uuid,text,jsonb) to service_role;
grant execute on function public.orby_fail_execution_job(uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.orby_cancel_execution_run(uuid) to service_role;
grant execute on function public.orby_consume_execution_budget(uuid,uuid,integer,integer) to service_role;
