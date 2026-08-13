-- Guest ORBY quota regression: PL/pgSQL input parameter visitor_hash conflicted
-- with the ON CONFLICT column name. Use the named primary-key constraint so the
-- same centralized guest meter can enforce 5/day without ambiguous references.
create or replace function public.reserve_orby_guest_request(visitor_hash text,submitted_characters integer)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  role_name text:=coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.role()::text,'');
  today date:=(timezone('UTC',now()))::date;
  row_value public.orby_guest_usage_daily%rowtype;
begin
  if role_name<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if visitor_hash is null or char_length(visitor_hash) not between 32 and 128 or submitted_characters<1 or submitted_characters>12000 then raise exception 'INVALID_GUEST_REQUEST'; end if;
  row_value.visitor_hash:=null;
  insert into public.orby_guest_usage_daily(visitor_hash,usage_date,requests,input_characters)
  values(visitor_hash,today,1,submitted_characters)
  on conflict on constraint orby_guest_usage_daily_pkey do update set
    requests=public.orby_guest_usage_daily.requests+1,
    input_characters=public.orby_guest_usage_daily.input_characters+excluded.input_characters,
    updated_at=now()
  where public.orby_guest_usage_daily.requests<5
    and public.orby_guest_usage_daily.input_characters+excluded.input_characters<=60000
  returning * into row_value;
  if row_value.visitor_hash is null then raise exception 'ORBY_GUEST_DAILY_LIMIT'; end if;
  return jsonb_build_object('tier','guest','daily_limit',5,'used',row_value.requests,'remaining',greatest(5-row_value.requests,0),'usage_date',today,'timezone','UTC');
end $$;
revoke all on function public.reserve_orby_guest_request(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_orby_guest_request(text,integer) to service_role;
