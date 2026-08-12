-- MADAR Production — unified ORBY account access, centralized usage, and ORBY Plus.
-- Applied to the existing primary Supabase project. Reuses ORBY Core, currencies,
-- exchange_rates, payment_methods, workspace_subscriptions, conversations and memory.

grant execute on function public.orby_os_admin_dashboard() to authenticated;

alter table public.subscription_plans drop constraint if exists subscription_plans_service_code_check;
alter table public.subscription_plans add constraint subscription_plans_service_code_check
  check (service_code in ('CONNECT_EXISTING','BUILD_ON_MADAR','MADAR_RETAIL','ORBY_PLUS'));
alter table public.subscription_plans drop constraint if exists subscription_plans_currency_check;
alter table public.subscription_plans drop constraint if exists subscription_plans_currency_fkey;
alter table public.subscription_plans add constraint subscription_plans_currency_fkey
  foreign key (currency) references public.currencies(code) on update cascade on delete restrict;

create table if not exists public.orby_plus_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  status text not null default 'active' check (status in ('active','expired','suspended','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  approved_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orby_plus_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  original_amount numeric(30,12) not null check (original_amount >= 0),
  original_currency text not null references public.currencies(code) on update cascade on delete restrict,
  payment_amount numeric(30,12) not null check (payment_amount >= 0),
  payment_currency text not null references public.currencies(code) on update cascade on delete restrict,
  exchange_rate numeric(30,12) not null check (exchange_rate > 0),
  exchange_rate_id uuid references public.exchange_rates(id) on delete set null,
  payment_reference text not null check (char_length(payment_reference) between 3 and 120),
  storage_path text,
  original_filename text,
  mime_type text,
  file_size bigint,
  status text not null default 'under_review' check (status in ('under_review','approved','rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orby_plus_proof_metadata_check check (
    (storage_path is null and original_filename is null and mime_type is null and file_size is null)
    or (storage_path is not null and original_filename is not null and mime_type is not null and file_size between 1 and 10485760)
  )
);
alter table public.orby_plus_subscriptions drop constraint if exists orby_plus_subscriptions_approved_request_id_fkey;
alter table public.orby_plus_subscriptions add constraint orby_plus_subscriptions_approved_request_id_fkey
  foreign key (approved_request_id) references public.orby_plus_payment_requests(id) on delete set null;
create unique index if not exists orby_plus_one_pending_request_uidx on public.orby_plus_payment_requests(user_id) where status='under_review';
create index if not exists orby_plus_requests_status_idx on public.orby_plus_payment_requests(status,created_at desc);
create index if not exists orby_plus_subscriptions_status_idx on public.orby_plus_subscriptions(status,ends_at);
alter table public.orby_plus_subscriptions enable row level security;
alter table public.orby_plus_payment_requests enable row level security;
drop policy if exists "orby plus users read own subscription" on public.orby_plus_subscriptions;
create policy "orby plus users read own subscription" on public.orby_plus_subscriptions for select to authenticated
  using (user_id=(select auth.uid()) or private.is_admin());
drop policy if exists "orby plus users read own payments" on public.orby_plus_payment_requests;
create policy "orby plus users read own payments" on public.orby_plus_payment_requests for select to authenticated
  using (user_id=(select auth.uid()) or private.is_admin());

alter table public.orby_conversations alter column organization_id drop not null;
alter table public.orby_conversations add column if not exists service_code text;
alter table public.orby_conversations add column if not exists context_scope text not null default 'general';
update public.orby_conversations set context_scope='workspace' where organization_id is not null;
alter table public.orby_conversations drop constraint if exists orby_conversations_service_code_check;
alter table public.orby_conversations add constraint orby_conversations_service_code_check check (service_code is null or service_code in ('CONNECT_EXISTING','BUILD_ON_MADAR','MADAR_RETAIL'));
alter table public.orby_conversations drop constraint if exists orby_conversations_context_scope_check;
alter table public.orby_conversations add constraint orby_conversations_context_scope_check check (context_scope in ('general','workspace'));
alter table public.orby_conversations drop constraint if exists orby_conversations_context_consistency_check;
alter table public.orby_conversations add constraint orby_conversations_context_consistency_check
  check ((context_scope='general' and organization_id is null) or (context_scope='workspace' and organization_id is not null));

alter table public.orby_messages alter column organization_id drop not null;
alter table public.orby_messages add column if not exists service_code text;
alter table public.orby_messages drop constraint if exists orby_messages_service_code_check;
alter table public.orby_messages add constraint orby_messages_service_code_check check (service_code is null or service_code in ('CONNECT_EXISTING','BUILD_ON_MADAR','MADAR_RETAIL'));
alter table public.orby_messages drop constraint if exists orby_messages_mode_check;
alter table public.orby_messages add constraint orby_messages_mode_check check (mode in ('GENERAL','ANALYZE','PLAN','REPORT','MARKETING'));

alter table public.orby_memories alter column organization_id drop not null;
drop policy if exists "orby_memories_user_select" on public.orby_memories;
create policy "orby_memories_user_select" on public.orby_memories for select to authenticated using (
  (user_id=(select auth.uid()) and (organization_id is null or private.is_organization_member(organization_id)))
  or (user_id is null and organization_id is not null and private.is_organization_member(organization_id))
);

drop policy if exists "madar v2 orby access gate" on public.orby_conversations;
drop policy if exists "users read own orby conversations" on public.orby_conversations;
drop policy if exists "orby account conversations" on public.orby_conversations;
create policy "orby account conversations" on public.orby_conversations for all to authenticated
  using (user_id=(select auth.uid()) and (organization_id is null or private.is_organization_member(organization_id)))
  with check (user_id=(select auth.uid()) and (organization_id is null or private.is_organization_member(organization_id)));
drop policy if exists "madar v2 orby access gate" on public.orby_messages;
drop policy if exists "users read own orby messages" on public.orby_messages;
drop policy if exists "orby account messages" on public.orby_messages;
create policy "orby account messages" on public.orby_messages for all to authenticated
  using (user_id=(select auth.uid()) and (organization_id is null or private.is_organization_member(organization_id)))
  with check (user_id=(select auth.uid()) and (organization_id is null or private.is_organization_member(organization_id)));

do $$ begin
  if exists (select 1 from public.orby_usage_daily group by user_id,usage_date having count(*)>1) then
    raise exception 'ORBY_USAGE_ACCOUNT_MERGE_REQUIRED';
  end if;
end $$;
drop trigger if exists enforce_orby_switch on public.orby_usage_daily;
drop trigger if exists madar_v2_orby_access_guard on public.orby_usage_daily;
alter table public.orby_usage_daily drop constraint if exists orby_usage_daily_pkey;
alter table public.orby_usage_daily alter column organization_id drop not null;
update public.orby_usage_daily set organization_id=null;
alter table public.orby_usage_daily add constraint orby_usage_daily_pkey primary key(user_id,usage_date);
drop policy if exists "madar v2 orby access gate" on public.orby_usage_daily;
drop policy if exists "users read own orby usage" on public.orby_usage_daily;
drop policy if exists "orby users read account usage" on public.orby_usage_daily;
create policy "orby users read account usage" on public.orby_usage_daily for select to authenticated using (user_id=(select auth.uid()));

alter table public.orby_execution_usage alter column organization_id drop not null;
create unique index if not exists orby_execution_usage_account_bucket_uidx
  on public.orby_execution_usage(user_id,bucket_type,bucket_start) where organization_id is null;

create table if not exists public.orby_guest_usage_daily (
  visitor_hash text not null check (char_length(visitor_hash) between 32 and 128),
  usage_date date not null,
  requests integer not null default 0 check (requests>=0),
  input_characters integer not null default 0 check (input_characters>=0),
  updated_at timestamptz not null default now(),
  primary key(visitor_hash,usage_date)
);
alter table public.orby_guest_usage_daily enable row level security;

create or replace function private.orby_account_tier_impl(target_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plus_row public.orby_plus_subscriptions%rowtype; paid boolean:=false;
begin
  if target_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.orby_plus_subscriptions set status='expired',updated_at=now()
    where user_id=target_user and status='active' and ends_at<=now();
  select * into plus_row from public.orby_plus_subscriptions where user_id=target_user and status='active' and ends_at>now() limit 1;
  if plus_row.id is not null then return jsonb_build_object('tier','plus','daily_limit',-1,'plus_ends_at',plus_row.ends_at,'paid_service',true); end if;
  select exists(select 1 from public.workspace_subscriptions s where s.user_id=target_user and s.status='active' and s.activation_state='ACTIVE' and s.ends_at>now()) into paid;
  if paid then return jsonb_build_object('tier','customer','daily_limit',20,'plus_ends_at',null,'paid_service',true); end if;
  return jsonb_build_object('tier','registered','daily_limit',5,'plus_ends_at',null,'paid_service',false);
end $$;
revoke all on function private.orby_account_tier_impl(uuid) from public,anon,authenticated;

create or replace function public.orby_usage_status()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); info jsonb; used integer:=0; today date:=(timezone('UTC',now()))::date; lim integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  info:=private.orby_account_tier_impl(actor);
  select coalesce(requests,0) into used from public.orby_usage_daily where user_id=actor and usage_date=today;
  lim:=(info->>'daily_limit')::integer;
  return info||jsonb_build_object('used',used,'remaining',case when lim=-1 then -1 else greatest(lim-used,0) end,'usage_date',today,'timezone','UTC');
end $$;
revoke all on function public.orby_usage_status() from public,anon;
grant execute on function public.orby_usage_status() to authenticated;

create or replace function private.consume_orby_account_quota_impl(submitted_characters integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=(select auth.uid()); info jsonb; tier text; lim integer; usage_row public.orby_usage_daily%rowtype;
  today date:=(timezone('UTC',now()))::date; minute_bucket timestamptz:=date_trunc('minute',now()); day_bucket timestamptz:=date_trunc('day',now());
  burst_used integer; fair_day_used integer; character_ceiling integer;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if submitted_characters<1 or submitted_characters>12000 then raise exception 'INVALID_PROMPT_SIZE'; end if;
  info:=private.orby_account_tier_impl(actor); tier:=info->>'tier'; lim:=(info->>'daily_limit')::integer;
  if tier='plus' then
    burst_used:=null;
    insert into public.orby_execution_usage(organization_id,user_id,bucket_type,bucket_start,used) values(null,actor,'minute',minute_bucket,1)
    on conflict (user_id,bucket_type,bucket_start) where organization_id is null do update set used=public.orby_execution_usage.used+1,updated_at=now()
      where public.orby_execution_usage.used<30 returning used into burst_used;
    if burst_used is null then raise exception 'ORBY_FAIR_USE_RATE_LIMIT'; end if;
    fair_day_used:=null;
    insert into public.orby_execution_usage(organization_id,user_id,bucket_type,bucket_start,used) values(null,actor,'day',day_bucket,1)
    on conflict (user_id,bucket_type,bucket_start) where organization_id is null do update set used=public.orby_execution_usage.used+1,updated_at=now()
      where public.orby_execution_usage.used<1000 returning used into fair_day_used;
    if fair_day_used is null then raise exception 'ORBY_FAIR_USE_DAILY_LIMIT'; end if;
    character_ceiling:=4000000;
  else
    character_ceiling:=greatest(100000,lim*12000);
  end if;
  usage_row.user_id:=null;
  insert into public.orby_usage_daily(organization_id,user_id,usage_date,requests,input_characters) values(null,actor,today,1,submitted_characters)
  on conflict(user_id,usage_date) do update set requests=public.orby_usage_daily.requests+1,input_characters=public.orby_usage_daily.input_characters+excluded.input_characters,updated_at=now()
  where (tier='plus' or public.orby_usage_daily.requests<lim) and public.orby_usage_daily.input_characters+excluded.input_characters<=character_ceiling
  returning * into usage_row;
  if usage_row.user_id is null then if tier='plus' then raise exception 'ORBY_FAIR_USE_CHARACTER_LIMIT'; else raise exception 'ORBY_DAILY_LIMIT'; end if; end if;
  return info||jsonb_build_object('requests',usage_row.requests,'used',usage_row.requests,'remaining',case when lim=-1 then -1 else greatest(lim-usage_row.requests,0) end,'usage_date',today,'timezone','UTC');
end $$;
revoke all on function private.consume_orby_account_quota_impl(integer) from public,anon,authenticated;
create or replace function public.consume_orby_account_quota(submitted_characters integer)
returns jsonb language sql security invoker set search_path='' as $$ select private.consume_orby_account_quota_impl(submitted_characters) $$;
revoke all on function public.consume_orby_account_quota(integer) from public,anon;
grant execute on function public.consume_orby_account_quota(integer) to authenticated;
grant execute on function private.consume_orby_account_quota_impl(integer) to authenticated;

create or replace function private.consume_orby_quota_impl(target_organization uuid,submitted_characters integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if (select auth.uid()) is null or not private.is_organization_member(target_organization) then raise exception 'NOT_AUTHORIZED'; end if;
  return private.consume_orby_account_quota_impl(submitted_characters)||jsonb_build_object('organization_id',target_organization,'source','MADAR_ACCOUNT_USAGE');
end $$;
create or replace function public.consume_orby_quota(target_organization uuid,submitted_characters integer)
returns jsonb language sql security invoker set search_path='' as $$ select private.consume_orby_quota_impl(target_organization,submitted_characters) $$;
revoke all on function public.consume_orby_quota(uuid,integer) from public,anon;
grant execute on function public.consume_orby_quota(uuid,integer) to authenticated;
grant execute on function private.consume_orby_quota_impl(uuid,integer) to authenticated;

create or replace function private.save_orby_exchange_impl(
  target_organization uuid,target_conversation uuid,conversation_title text,conversation_mode text,user_prompt text,assistant_response text,response_source text,response_metadata jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); conversation_id uuid:=target_conversation; service text:=nullif(coalesce(response_metadata,'{}'::jsonb)->>'service_code',''); today date:=(timezone('UTC',now()))::date;
begin
  if actor is null then raise exception 'NOT_AUTHORIZED'; end if;
  if target_organization is not null and not private.is_organization_member(target_organization) then raise exception 'NOT_AUTHORIZED'; end if;
  if conversation_mode not in ('GENERAL','ANALYZE','PLAN','REPORT','MARKETING') or response_source not in ('ai','smart-fallback') then raise exception 'INVALID_ORBY_EXCHANGE'; end if;
  if service is not null and service not in ('CONNECT_EXISTING','BUILD_ON_MADAR','MADAR_RETAIL') then service:=null; end if;
  if char_length(user_prompt) not between 1 and 12000 or char_length(assistant_response) not between 1 and 20000 then raise exception 'INVALID_ORBY_EXCHANGE'; end if;
  if conversation_id is null then
    insert into public.orby_conversations(organization_id,user_id,title,service_code,context_scope)
    values(target_organization,actor,left(coalesce(nullif(btrim(conversation_title),''),user_prompt),160),service,case when target_organization is null then 'general' else 'workspace' end)
    returning id into conversation_id;
  elsif not exists(select 1 from public.orby_conversations c where c.id=conversation_id and c.user_id=actor and c.status='active' and c.organization_id is not distinct from target_organization) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;
  insert into public.orby_messages(conversation_id,organization_id,user_id,role,mode,content,source,service_code)
    values(conversation_id,target_organization,actor,'user',conversation_mode,user_prompt,'ai',service);
  insert into public.orby_messages(conversation_id,organization_id,user_id,role,mode,content,source,metadata,service_code)
    values(conversation_id,target_organization,actor,'assistant',conversation_mode,assistant_response,response_source,coalesce(response_metadata,'{}'::jsonb),service);
  update public.orby_conversations set last_message_at=now(),updated_at=now(),service_code=coalesce(service_code,service) where id=conversation_id;
  update public.orby_usage_daily set output_characters=output_characters+char_length(assistant_response),updated_at=now() where user_id=actor and usage_date=today;
  return conversation_id;
end $$;
create or replace function public.save_orby_exchange(
  target_organization uuid,target_conversation uuid,conversation_title text,conversation_mode text,user_prompt text,assistant_response text,response_source text,response_metadata jsonb default '{}'::jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.save_orby_exchange_impl(target_organization,target_conversation,conversation_title,conversation_mode,user_prompt,assistant_response,response_source,response_metadata)
$$;
revoke all on function public.save_orby_exchange(uuid,uuid,text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.save_orby_exchange(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function private.save_orby_exchange_impl(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.reserve_orby_guest_request(visitor_hash text,submitted_characters integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text:=coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.role()::text,''); today date:=(timezone('UTC',now()))::date; row_value public.orby_guest_usage_daily%rowtype;
begin
  if role_name<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED'; end if;
  if visitor_hash is null or char_length(visitor_hash) not between 32 and 128 or submitted_characters<1 or submitted_characters>12000 then raise exception 'INVALID_GUEST_REQUEST'; end if;
  row_value.visitor_hash:=null;
  insert into public.orby_guest_usage_daily(visitor_hash,usage_date,requests,input_characters) values(visitor_hash,today,1,submitted_characters)
  on conflict(visitor_hash,usage_date) do update set requests=public.orby_guest_usage_daily.requests+1,input_characters=public.orby_guest_usage_daily.input_characters+excluded.input_characters,updated_at=now()
    where public.orby_guest_usage_daily.requests<5 and public.orby_guest_usage_daily.input_characters+excluded.input_characters<=60000
  returning * into row_value;
  if row_value.visitor_hash is null then raise exception 'ORBY_GUEST_DAILY_LIMIT'; end if;
  return jsonb_build_object('tier','guest','daily_limit',5,'used',row_value.requests,'remaining',greatest(5-row_value.requests,0),'usage_date',today,'timezone','UTC');
end $$;
revoke all on function public.reserve_orby_guest_request(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_orby_guest_request(text,integer) to service_role;

create or replace function public.configure_orby_plus_plan(target_price numeric,target_currency text,target_billing_months integer,target_available boolean)
returns public.subscription_plans language plpgsql security definer set search_path='' as $$
declare plan public.subscription_plans%rowtype; currency_value text:=upper(trim(target_currency));
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if target_price is null or target_price<0 or target_billing_months<1 or target_billing_months>36 then raise exception 'INVALID_PLUS_PLAN'; end if;
  if not exists(select 1 from public.currencies where code=currency_value and is_active) then raise exception 'CURRENCY_INACTIVE'; end if;
  insert into public.subscription_plans(code,name,organization_type,price,currency,billing_months,is_active,description,member_limit,product_limit,storage_mb,orby_daily_limit,import_rows_limit,grace_days,features,service_code,is_available)
  values('ORBY-PLUS','ORBY Plus','INDIVIDUAL',target_price,currency_value,target_billing_months,true,'اشتراك مستقل لأوربي مع استخدام غير محدود من منظور المنتج وحماية Fair-use خلفية.',1,1,1,20,1,0,jsonb_build_object('orby_plus',true),'ORBY_PLUS',target_available)
  on conflict(code) do update set price=excluded.price,currency=excluded.currency,billing_months=excluded.billing_months,is_active=true,is_available=excluded.is_available,description=excluded.description,updated_at=now()
  returning * into plan;
  return plan;
end $$;
revoke all on function public.configure_orby_plus_plan(numeric,text,integer,boolean) from public,anon;
grant execute on function public.configure_orby_plus_plan(numeric,text,integer,boolean) to authenticated;

create or replace function public.create_orby_plus_payment_request(
  target_method uuid,target_payment_currency text,reference text,proof_path text default null,proof_name text default null,proof_mime text default null,proof_size bigint default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid:=(select auth.uid()); plan public.subscription_plans%rowtype; method public.payment_methods%rowtype; request_id uuid:=gen_random_uuid();
  payment_currency_value text:=upper(trim(target_payment_currency)); original_currency_value text; decimals integer; rate numeric(30,12):=1; rate_id uuid; amount numeric(30,12); clean_reference text:=nullif(btrim(reference),'');
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if clean_reference is null or char_length(clean_reference) not between 3 and 120 then raise exception 'PAYMENT_REFERENCE_REQUIRED'; end if;
  if exists(select 1 from public.orby_plus_payment_requests where user_id=actor and status='under_review') then raise exception 'PLUS_PAYMENT_ALREADY_PENDING'; end if;
  select * into plan from public.subscription_plans where service_code='ORBY_PLUS' and code='ORBY-PLUS' and is_active and is_available and price>0 limit 1 for share;
  if plan.id is null then raise exception 'ORBY_PLUS_NOT_CONFIGURED'; end if;
  original_currency_value:=upper(plan.currency);
  if not exists(select 1 from public.currencies where code=original_currency_value and is_active) then raise exception 'ORIGINAL_CURRENCY_INACTIVE'; end if;
  select decimal_places into decimals from public.currencies where code=payment_currency_value and is_active;
  if not found then raise exception 'PAYMENT_CURRENCY_INACTIVE'; end if;
  select * into method from public.payment_methods where id=target_method and is_active for share;
  if method.id is null then raise exception 'PAYMENT_METHOD_UNAVAILABLE'; end if;
  if not method.currency_agnostic and not exists(select 1 from public.payment_method_currencies where payment_method_id=method.id and currency_code=payment_currency_value) then raise exception 'PAYMENT_METHOD_CURRENCY_UNAVAILABLE'; end if;
  if original_currency_value<>payment_currency_value then
    select id,rate into rate_id,rate from public.exchange_rates where base_currency=original_currency_value and quote_currency=payment_currency_value and status='active' limit 1;
    if not found then
      select id,(1/rate) into rate_id,rate from public.exchange_rates where base_currency=payment_currency_value and quote_currency=original_currency_value and status='active' limit 1;
      if not found then raise exception 'FX_RATE_MISSING'; end if;
    end if;
  end if;
  amount:=round(plan.price*rate,decimals);
  if proof_path is not null and (proof_name is null or proof_mime is null or proof_size is null or proof_size not between 1 and 10485760) then raise exception 'INVALID_PROOF_METADATA'; end if;
  insert into public.orby_plus_payment_requests(id,user_id,plan_id,payment_method_id,original_amount,original_currency,payment_amount,payment_currency,exchange_rate,exchange_rate_id,payment_reference,storage_path,original_filename,mime_type,file_size)
  values(request_id,actor,plan.id,method.id,plan.price,original_currency_value,amount,payment_currency_value,rate,rate_id,clean_reference,proof_path,proof_name,proof_mime,proof_size);
  insert into public.notifications(user_id,title,body,link) values(actor,'تم إرسال طلب ORBY Plus','استلمنا رقم العملية وسيتم إشعارك بعد مراجعة الإدارة.','/orby/plus');
  return request_id;
end $$;
revoke all on function public.create_orby_plus_payment_request(uuid,text,text,text,text,text,bigint) from public,anon;
grant execute on function public.create_orby_plus_payment_request(uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function public.review_orby_plus_payment_request(target_request uuid,decision text,note text default null)
returns public.orby_plus_payment_requests language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); request public.orby_plus_payment_requests%rowtype; plan public.subscription_plans%rowtype; new_end timestamptz; current_sub public.orby_plus_subscriptions%rowtype;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into request from public.orby_plus_payment_requests where id=target_request for update;
  if request.id is null or request.status<>'under_review' then raise exception 'PLUS_PAYMENT_NOT_REVIEWABLE'; end if;
  if decision='approve' then
    select * into plan from public.subscription_plans where id=request.plan_id for share;
    if plan.id is null or plan.service_code<>'ORBY_PLUS' then raise exception 'ORBY_PLUS_PLAN_MISSING'; end if;
    select * into current_sub from public.orby_plus_subscriptions where user_id=request.user_id for update;
    new_end:=greatest(coalesce(current_sub.ends_at,now()),now())+make_interval(months=>plan.billing_months);
    insert into public.orby_plus_subscriptions(user_id,plan_id,status,starts_at,ends_at,approved_request_id)
    values(request.user_id,plan.id,'active',now(),new_end,request.id)
    on conflict(user_id) do update set plan_id=excluded.plan_id,status='active',starts_at=case when public.orby_plus_subscriptions.ends_at<=now() then now() else public.orby_plus_subscriptions.starts_at end,ends_at=new_end,approved_request_id=request.id,updated_at=now();
    update public.orby_plus_payment_requests set status='approved',reviewed_by=actor,reviewed_at=now(),review_note=nullif(btrim(note),''),updated_at=now() where id=request.id returning * into request;
    insert into public.notifications(user_id,title,body,link) values(request.user_id,'ORBY Plus أصبح فعالًا','تم اعتماد الدفع وتفعيل ORBY Plus على حسابك.','/orby');
  elsif decision='reject' then
    update public.orby_plus_payment_requests set status='rejected',reviewed_by=actor,reviewed_at=now(),review_note=nullif(btrim(note),''),updated_at=now() where id=request.id returning * into request;
    insert into public.notifications(user_id,title,body,link) values(request.user_id,'تعذر اعتماد ORBY Plus',coalesce(nullif(btrim(note),''),'راجع بيانات التحويل ثم أعد المحاولة.'),'/orby/plus');
  else raise exception 'INVALID_DECISION'; end if;
  return request;
end $$;
revoke all on function public.review_orby_plus_payment_request(uuid,text,text) from public,anon;
grant execute on function public.review_orby_plus_payment_request(uuid,text,text) to authenticated;
