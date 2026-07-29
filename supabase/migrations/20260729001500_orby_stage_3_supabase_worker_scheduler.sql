-- ORBY Stage 3 production worker scheduler.
-- Supabase Cron invokes the protected Vercel worker every hour.
-- The raw worker token is stored only in Supabase Vault and never in source control.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.orby_dispatch_stage3_worker()
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
 worker_token text;
 request_id bigint;
begin
 select decrypted_secret
 into worker_token
 from vault.decrypted_secrets
 where name='orby_stage3_worker_token'
 order by updated_at desc
 limit 1;

 if nullif(worker_token,'') is null then
  raise exception 'ORBY_STAGE3_WORKER_TOKEN_MISSING';
 end if;

 select net.http_post(
  url:='https://www.orbitmadar.com/api/orby/intelligence/worker',
  headers:=jsonb_build_object(
   'Content-Type','application/json',
   'x-madar-cron-token',worker_token
  ),
  body:=jsonb_build_object(
   'source','supabase-cron',
   'requestedAt',now()
  ),
  timeout_milliseconds:=55000
 ) into request_id;

 return request_id;
end;
$$;

revoke all on function public.orby_dispatch_stage3_worker() from public,anon,authenticated;
grant execute on function public.orby_dispatch_stage3_worker() to service_role;

-- The production activation stores the token in Vault before applying this
-- migration. Other environments remain safe and unscheduled until configured.
do $do$
begin
 if exists(
  select 1 from vault.decrypted_secrets
  where name='orby_stage3_worker_token' and nullif(decrypted_secret,'') is not null
 ) then
  perform cron.schedule(
   'orby-stage3-worker-hourly',
   '7 * * * *',
   $job$select public.orby_dispatch_stage3_worker();$job$
  );
 end if;
end;
$do$;
