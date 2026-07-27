begin;

create or replace function public.integration_rotate_connection_secret(
 target_organization uuid,
 target_connection uuid,
 new_encrypted_payload text,
 new_secret_iv text,
 new_secret_auth_tag text,
 new_secret_algorithm text,
 new_secret_key_version integer,
 new_secret_metadata jsonb default '{}'::jsonb,
 actor_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path=public,private,auth
as $$
declare
 new_secret_id uuid;
 effective_actor uuid:=coalesce(actor_id,auth.uid());
begin
 if auth.role()<>'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 if new_secret_algorithm<>'aes-256-gcm' or new_secret_key_version<1 then
  raise exception 'Invalid secret envelope' using errcode='22023';
 end if;
 if not exists(
  select 1 from public.integration_connections c
  where c.id=target_connection
   and c.organization_id=target_organization
   and c.deleted_at is null
 ) then
  raise exception 'Connection not found' using errcode='P0002';
 end if;

 perform pg_advisory_xact_lock(hashtextextended(target_connection::text,0));

 update public.integration_connection_secrets
 set revoked_at=now(),revoked_by=effective_actor
 where connection_id=target_connection
  and organization_id=target_organization
  and revoked_at is null;

 insert into public.integration_connection_secrets(
  organization_id,connection_id,encrypted_payload,iv,auth_tag,algorithm,key_version,metadata,created_by
 ) values(
  target_organization,target_connection,new_encrypted_payload,new_secret_iv,new_secret_auth_tag,
  new_secret_algorithm,new_secret_key_version,coalesce(new_secret_metadata,'{}'::jsonb),effective_actor
 ) returning id into new_secret_id;

 update public.integration_connections
 set secret_id=new_secret_id,
     status='verifying',
     last_error_code=null,
     last_error_message=null,
     updated_by=effective_actor,
     updated_at=now()
 where id=target_connection and organization_id=target_organization;

 return new_secret_id;
end;
$$;

revoke all on function public.integration_rotate_connection_secret(uuid,uuid,text,text,text,text,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.integration_rotate_connection_secret(uuid,uuid,text,text,text,text,integer,jsonb,uuid) to service_role;
comment on function public.integration_rotate_connection_secret(uuid,uuid,text,text,text,text,integer,jsonb,uuid) is 'Atomically revokes the previous connection secret and installs a new encrypted envelope.';

notify pgrst,'reload schema';
commit;
