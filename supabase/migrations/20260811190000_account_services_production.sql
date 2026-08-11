-- MADAR production account/services model.
-- Registration creates an account/profile only. Organizations are provisioned
-- only after an independently paid service request is approved by an admin.

alter table public.subscription_plans
  add column if not exists service_code text,
  add column if not exists is_available boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.subscription_plans
  drop constraint if exists subscription_plans_currency_check;
alter table public.subscription_plans
  add constraint subscription_plans_currency_check
  check (currency in ('YER', 'SAR', 'USD'));

update public.subscription_plans
set
  service_code = case code
    when 'COMPANY-MONTHLY' then 'CONNECT_EXISTING'
    when 'MERCHANT-MONTHLY' then 'BUILD_ON_MADAR'
    when 'INDIVIDUAL-MONTHLY' then 'MADAR_RETAIL'
    else service_code
  end,
  name = case code
    when 'COMPANY-MONTHLY' then 'ربط تجارة قائمة بمَدار'
    when 'MERCHANT-MONTHLY' then 'بناء تجارة جديدة على مَدار'
    when 'INDIVIDUAL-MONTHLY' then 'MADAR Retail'
    else name
  end,
  description = case code
    when 'COMPANY-MONTHLY' then 'ربط نظام تجارة قائم بمحرك Connector الموجود.'
    when 'MERCHANT-MONTHLY' then 'إنشاء وتشغيل تجارة جديدة باستخدام أدوات مَدار.'
    when 'INDIVIDUAL-MONTHLY' then 'نظام تشغيل خفيف وآمن لمتاجر التجزئة الصغيرة.'
    else description
  end,
  is_available = true,
  updated_at = now()
where code in ('COMPANY-MONTHLY', 'MERCHANT-MONTHLY', 'INDIVIDUAL-MONTHLY');

alter table public.subscription_plans
  alter column service_code set not null;
alter table public.subscription_plans
  add constraint subscription_plans_service_code_check
  check (service_code in ('CONNECT_EXISTING', 'BUILD_ON_MADAR', 'MADAR_RETAIL'));
create unique index if not exists subscription_plans_one_per_service_uidx
  on public.subscription_plans(service_code);

drop trigger if exists subscription_plans_updated on public.subscription_plans;
create trigger subscription_plans_updated
before update on public.subscription_plans
for each row execute function public.touch_updated_at();

create or replace function private.audit_service_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  entity uuid := case when tg_op = 'DELETE' then old.id else new.id end;
  configuration_code text := case
    when tg_table_name = 'subscription_plans' then coalesce(new.service_code, old.service_code)
    else coalesce(new.code, old.code)
  end;
begin
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    actor,
    case when tg_table_name = 'subscription_plans'
      then 'service.plan.' || lower(tg_op)
      else 'service.payment_method.' || lower(tg_op) end,
    tg_table_name,
    entity,
    jsonb_build_object('code', configuration_code)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_service_plan_configuration on public.subscription_plans;
create trigger audit_service_plan_configuration
after insert or update or delete on public.subscription_plans
for each row execute function private.audit_service_configuration_change();

drop trigger if exists audit_payment_method_configuration on public.payment_methods;
create trigger audit_payment_method_configuration
after insert or update or delete on public.payment_methods
for each row execute function private.audit_service_configuration_change();

alter table public.workspace_requests
  add column if not exists service_code text,
  add column if not exists request_kind text not null default 'ACTIVATION',
  add column if not exists onboarding_state text not null default 'PAYMENT_REQUIRED',
  add column if not exists setup_payload jsonb not null default '{}'::jsonb,
  add column if not exists existing_subscription_id uuid references public.workspace_subscriptions(id) on delete set null;

update public.workspace_requests request
set service_code = plan.service_code
from public.subscription_plans plan
where request.plan_id = plan.id and request.service_code is null;

update public.workspace_requests
set service_code = 'BUILD_ON_MADAR'
where service_code is null;

alter table public.workspace_requests
  alter column service_code set not null;
alter table public.workspace_requests
  add constraint workspace_requests_service_code_check
  check (service_code in ('CONNECT_EXISTING', 'BUILD_ON_MADAR', 'MADAR_RETAIL'));
alter table public.workspace_requests
  add constraint workspace_requests_request_kind_check
  check (request_kind in ('ACTIVATION', 'RENEWAL'));
alter table public.workspace_requests
  add constraint workspace_requests_onboarding_state_check
  check (onboarding_state in ('PAYMENT_REQUIRED', 'PENDING_APPROVAL', 'PROVISIONING', 'ACTIVE', 'REJECTED'));
alter table public.workspace_requests
  add constraint workspace_requests_setup_payload_check
  check (jsonb_typeof(setup_payload) = 'object' and octet_length(setup_payload::text) <= 20000);

drop index if exists public.workspace_requests_one_pending_user_idx;
create unique index if not exists workspace_requests_one_pending_service_uidx
  on public.workspace_requests(user_id, service_code)
  where status in ('pending_payment', 'pending_review');
create index if not exists workspace_requests_service_status_idx
  on public.workspace_requests(service_code, status, created_at desc);
create index if not exists workspace_requests_existing_subscription_idx
  on public.workspace_requests(existing_subscription_id)
  where existing_subscription_id is not null;

alter table public.workspace_subscriptions
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists service_code text,
  add column if not exists activation_state text not null default 'ACTIVE',
  add column if not exists external_workspace_id uuid,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text;

update public.workspace_subscriptions subscription
set
  user_id = organization.created_by,
  service_code = plan.service_code,
  activation_state = case
    when subscription.status = 'active' then 'ACTIVE'
    when subscription.status = 'expired' then 'EXPIRED'
    else 'SUSPENDED'
  end
from public.organizations organization, public.subscription_plans plan
where organization.id = subscription.organization_id
  and plan.id = subscription.plan_id
  and (subscription.user_id is null or subscription.service_code is null);

alter table public.workspace_subscriptions
  alter column user_id set not null,
  alter column service_code set not null;
alter table public.workspace_subscriptions
  drop constraint if exists workspace_subscriptions_status_check;
alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_status_check
  check (status in ('active', 'past_due', 'cancelled', 'expired', 'suspended', 'provisioning'));
alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_service_code_check
  check (service_code in ('CONNECT_EXISTING', 'BUILD_ON_MADAR', 'MADAR_RETAIL'));
alter table public.workspace_subscriptions
  add constraint workspace_subscriptions_activation_state_check
  check (activation_state in ('PROVISIONING', 'ACTIVE', 'EXPIRED', 'SUSPENDED'));
create unique index if not exists workspace_subscriptions_user_service_uidx
  on public.workspace_subscriptions(user_id, service_code);
create index if not exists workspace_subscriptions_service_state_idx
  on public.workspace_subscriptions(service_code, activation_state, status, ends_at);
create index if not exists workspace_subscriptions_user_state_idx
  on public.workspace_subscriptions(user_id, activation_state, ends_at desc);

drop trigger if exists workspace_request_assign_plan on public.workspace_requests;
drop trigger if exists enforce_workspace_creation_switch on public.workspace_requests;
drop trigger if exists organization_members_v2_space_guard on public.organization_members;

-- Account-only profile synchronization for Email and Google registration.
create or replace function private.handle_new_user_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_provider text := lower(coalesce(new.raw_app_meta_data->>'provider', 'email'));
  provider_subject text := case
    when selected_provider = 'google'
      then nullif(coalesce(new.raw_user_meta_data->>'sub', new.raw_user_meta_data->>'provider_id'), '')
    else null
  end;
begin
  insert into public.profiles(
    id, email, full_name, phone, email_verified, account_type,
    account_type_selected_at, account_migration_source, reonboarding_required,
    auth_provider, google_user_id, oauth_avatar_url, auth_provider_updated_at
  ) values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.phone,
    new.email_confirmed_at is not null,
    'PERSONAL',
    now(),
    'MADAR_ACCOUNT',
    false,
    case when selected_provider = 'google' then 'google' else 'email' end,
    provider_subject,
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = coalesce(excluded.phone, public.profiles.phone),
    email_verified = excluded.email_verified,
    full_name = case
      when nullif(public.profiles.full_name, '') is null then excluded.full_name
      else public.profiles.full_name
    end,
    auth_provider = case
      when excluded.auth_provider = 'google' then 'google'
      else public.profiles.auth_provider
    end,
    google_user_id = coalesce(excluded.google_user_id, public.profiles.google_user_id),
    oauth_avatar_url = coalesce(public.profiles.oauth_avatar_url, excluded.oauth_avatar_url),
    auth_provider_updated_at = now(),
    account_type_selected_at = coalesce(public.profiles.account_type_selected_at, now()),
    account_migration_source = 'MADAR_ACCOUNT',
    reonboarding_required = false;
  return new;
end;
$$;

update public.profiles
set reonboarding_required = false,
    account_type_selected_at = coalesce(account_type_selected_at, now())
where reonboarding_required or account_type_selected_at is null;

create or replace function private.create_service_request_impl(
  requested_service text,
  requested_setup jsonb default '{}'::jsonb
)
returns public.workspace_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  service text := upper(coalesce(requested_service, ''));
  setup jsonb := coalesce(requested_setup, '{}'::jsonb);
  selected_plan public.subscription_plans%rowtype;
  existing_subscription public.workspace_subscriptions%rowtype;
  created public.workspace_requests;
  request_id uuid := gen_random_uuid();
  trade_name text := btrim(coalesce(setup->>'trade_name', ''));
  request_slug text;
  request_type public.organization_type;
  kind text := 'ACTIVATION';
  subtype text;
  currency_value text;
  specialization_id uuid;
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  if not exists (select 1 from public.profiles where id = actor and status = 'active') then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;
  if service not in ('CONNECT_EXISTING', 'BUILD_ON_MADAR', 'MADAR_RETAIL') then
    raise exception 'SERVICE_NOT_FOUND';
  end if;
  if jsonb_typeof(setup) <> 'object' or octet_length(setup::text) > 20000 then
    raise exception 'INVALID_SERVICE_SETUP';
  end if;
  if char_length(trade_name) not between 2 and 120 then
    raise exception 'TRADE_NAME_REQUIRED';
  end if;

  select * into selected_plan
  from public.subscription_plans
  where service_code = service and is_active and is_available
  for share;
  if selected_plan.id is null then raise exception 'SERVICE_UNAVAILABLE'; end if;

  select * into existing_subscription
  from public.workspace_subscriptions
  where user_id = actor and service_code = service
  order by created_at desc
  limit 1
  for update;

  if existing_subscription.id is not null then
    if existing_subscription.activation_state = 'ACTIVE'
      and existing_subscription.status = 'active'
      and existing_subscription.ends_at > now() then
      raise exception 'SERVICE_ALREADY_ACTIVE';
    end if;
    kind := 'RENEWAL';
  end if;

  if exists (
    select 1 from public.workspace_requests
    where user_id = actor and service_code = service
      and status in ('pending_payment', 'pending_review')
  ) then raise exception 'SERVICE_REQUEST_ALREADY_PENDING'; end if;

  if service = 'MADAR_RETAIL' then
    subtype := upper(coalesce(setup->>'subtype', 'GENERAL_RETAIL'));
    currency_value := upper(coalesce(setup->>'currency', 'YER'));
    if subtype not in ('CLOTHING','PERFUME','GROCERY','ELECTRONICS','ACCESSORIES','SPARE_PARTS','GENERAL_RETAIL','OTHER') then
      raise exception 'INVALID_RETAIL_SUBTYPE';
    end if;
    if currency_value not in ('YER','SAR','USD') then raise exception 'INVALID_CURRENCY'; end if;
    if upper(coalesce(setup->>'invoice_prefix', 'MR')) !~ '^[A-Z0-9-]{1,8}$' then
      raise exception 'INVALID_INVOICE_PREFIX';
    end if;
    request_type := 'MERCHANT';
  elsif service = 'CONNECT_EXISTING' then
    if char_length(btrim(coalesce(setup->>'external_system_name', ''))) not between 2 and 120 then
      raise exception 'EXTERNAL_SYSTEM_REQUIRED';
    end if;
    request_type := 'COMPANY';
  else
    select id into specialization_id
    from public.activity_specializations
    where code = upper(coalesce(setup->>'specialization_code', 'GENERAL_COMMERCE'))
      and status = 'approved' and is_visible and launch_enabled;
    if specialization_id is null then raise exception 'VERTICAL_NOT_APPROVED'; end if;
    currency_value := upper(coalesce(setup->>'currency', 'YER'));
    if currency_value not in ('YER','SAR','USD') then raise exception 'INVALID_CURRENCY'; end if;
    request_type := 'MERCHANT';
  end if;

  request_slug := lower(replace(service, '_', '-')) || '-' || substr(replace(request_id::text, '-', ''), 1, 12);
  insert into public.workspace_requests(
    id, user_id, name, slug, type, status, plan_id, service_code,
    request_kind, onboarding_state, setup_payload, existing_subscription_id
  ) values (
    request_id, actor, trade_name, request_slug, request_type, 'pending_payment',
    selected_plan.id, service, kind, 'PAYMENT_REQUIRED', setup,
    existing_subscription.id
  ) returning * into created;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'service.request.created', 'workspace_request', created.id,
    jsonb_build_object('service_code', service, 'request_kind', kind));
  return created;
end;
$$;

create or replace function public.create_service_request(
  requested_service text,
  requested_setup jsonb default '{}'::jsonb
)
returns public.workspace_requests
language sql
security invoker
set search_path = ''
as $$
  select private.create_service_request_impl(requested_service, requested_setup)
$$;

revoke all on function private.create_service_request_impl(text, jsonb) from public, anon;
revoke all on function public.create_service_request(text, jsonb) from public, anon;
grant execute on function private.create_service_request_impl(text, jsonb) to authenticated;
grant execute on function public.create_service_request(text, jsonb) to authenticated;

create or replace function private.submit_workspace_payment_v2_impl(
  target_request uuid,
  target_method uuid,
  reference text,
  proof_path text,
  proof_name text,
  proof_mime text,
  proof_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  request public.workspace_requests%rowtype;
  method public.payment_methods%rowtype;
  plan public.subscription_plans%rowtype;
  submission_id uuid;
begin
  select * into request from public.workspace_requests
  where id = target_request and user_id = actor for update;
  if request.id is null or request.status <> 'pending_payment' then
    raise exception 'REQUEST_NOT_PAYABLE';
  end if;
  select * into method from public.payment_methods where id = target_method and is_active;
  select * into plan from public.subscription_plans
  where id = request.plan_id and service_code = request.service_code and is_active and is_available;
  if method.id is null then raise exception 'PAYMENT_METHOD_UNAVAILABLE'; end if;
  if plan.id is null then raise exception 'PLAN_NOT_AVAILABLE'; end if;
  if method.currency <> plan.currency then raise exception 'PAYMENT_METHOD_CURRENCY_MISMATCH'; end if;
  if char_length(btrim(reference)) not between 3 and 120
    or proof_mime not in ('image/jpeg','image/png','image/webp','application/pdf')
    or proof_size not between 1 and 10485760 then
    raise exception 'INVALID_PAYMENT_PROOF';
  end if;

  insert into public.workspace_payment_submissions(
    workspace_request_id, user_id, payment_method_id, amount, currency,
    payment_reference, storage_path, original_filename, mime_type, file_size
  ) values (
    request.id, actor, method.id, plan.price, plan.currency,
    btrim(reference), proof_path, left(proof_name, 255), proof_mime, proof_size
  ) returning id into submission_id;

  update public.workspace_requests
  set payment_method_id = method.id,
      payment_reference = btrim(reference),
      payment_submitted_at = now(),
      status = 'pending_review',
      onboarding_state = 'PENDING_APPROVAL'
  where id = request.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'service.payment.submitted', 'workspace_request', request.id,
    jsonb_build_object('service_code', request.service_code, 'submission_id', submission_id));
  return submission_id;
end;
$$;

create or replace function public.activate_workspace_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_plan public.subscription_plans%rowtype;
  subscription_end timestamptz;
  target_subscription public.workspace_subscriptions%rowtype;
  initial_status text;
  initial_state text;
begin
  if new.status = 'approved' and old.status is distinct from new.status and new.organization_id is not null then
    select * into selected_plan from public.subscription_plans where id = new.plan_id for share;
    if selected_plan.id is null or selected_plan.service_code <> new.service_code then
      raise exception 'SERVICE_PLAN_MISMATCH';
    end if;
    initial_status := case when new.service_code = 'MADAR_RETAIL' then 'provisioning' else 'active' end;
    initial_state := case when new.service_code = 'MADAR_RETAIL' then 'PROVISIONING' else 'ACTIVE' end;

    if new.request_kind = 'RENEWAL' then
      select * into target_subscription from public.workspace_subscriptions
      where id = new.existing_subscription_id and user_id = new.user_id
        and service_code = new.service_code for update;
      if target_subscription.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
      subscription_end := greatest(target_subscription.ends_at, now())
        + make_interval(months => selected_plan.billing_months);
      update public.workspace_subscriptions
      set plan_id = selected_plan.id,
          status = initial_status,
          activation_state = initial_state,
          starts_at = case when target_subscription.ends_at <= now() then now() else starts_at end,
          ends_at = subscription_end,
          grace_ends_at = subscription_end + make_interval(days => selected_plan.grace_days),
          approved_request_id = new.id,
          renewal_count = renewal_count + 1,
          last_payment_at = now(),
          suspended_at = null,
          suspension_reason = null
      where id = target_subscription.id;
    else
      subscription_end := now() + make_interval(months => selected_plan.billing_months);
      insert into public.workspace_subscriptions(
        organization_id, user_id, service_code, plan_id, status,
        activation_state, starts_at, ends_at, grace_ends_at,
        approved_request_id, last_payment_at, is_beta_founder
      ) values (
        new.organization_id, new.user_id, new.service_code, selected_plan.id,
        initial_status, initial_state, now(), subscription_end,
        subscription_end + make_interval(days => selected_plan.grace_days),
        new.id, now(), false
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.review_workspace_request_impl(
  target_request uuid,
  decision text,
  reason text default null
)
returns public.workspace_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  request public.workspace_requests%rowtype;
  created public.organizations%rowtype;
  existing_subscription public.workspace_subscriptions%rowtype;
  specialization public.activity_specializations%rowtype;
  mode text;
  source text;
  currency_value text;
  organization_status public.organization_status;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into request from public.workspace_requests where id = target_request for update;
  if request.id is null or request.status <> 'pending_review' then
    raise exception 'REQUEST_NOT_REVIEWABLE';
  end if;

  if decision = 'approve' then
    if not exists (
      select 1 from public.workspace_payment_submissions
      where workspace_request_id = request.id and status = 'under_review'
    ) then raise exception 'PAYMENT_PROOF_REQUIRED'; end if;

    if request.request_kind = 'RENEWAL' then
      select * into existing_subscription from public.workspace_subscriptions
      where id = request.existing_subscription_id and user_id = request.user_id
        and service_code = request.service_code for update;
      if existing_subscription.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
      created.id := existing_subscription.organization_id;
    else
      mode := case when request.service_code = 'CONNECT_EXISTING' then 'CONNECTED_EXTERNAL' else 'MADAR_NATIVE' end;
      source := case when request.service_code = 'CONNECT_EXISTING' then 'EXTERNAL' else 'MADAR' end;
      currency_value := upper(coalesce(request.setup_payload->>'currency', 'YER'));
      if currency_value not in ('YER','SAR','USD') then currency_value := 'YER'; end if;
      organization_status := case when request.service_code = 'MADAR_RETAIL'
        then 'suspended'::public.organization_status else 'active'::public.organization_status end;

      insert into public.organizations(
        name, slug, type, status, created_by, country, city, whatsapp,
        logo_path, currency, industry, operating_mode, source_of_truth, setup_status
      ) values (
        request.name, request.slug, request.type, organization_status, request.user_id,
        nullif(request.setup_payload->>'country', ''),
        nullif(request.setup_payload->>'city', ''),
        nullif(request.setup_payload->>'phone', ''),
        nullif(request.setup_payload->>'logo_path', ''),
        currency_value,
        case when request.service_code = 'MADAR_RETAIL'
          then coalesce(request.setup_payload->>'subtype', 'GENERAL_RETAIL')
          else nullif(request.setup_payload->>'specialization_code', '') end,
        mode, source,
        case when request.service_code = 'BUILD_ON_MADAR' then 'not_started'
          when request.service_code = 'CONNECT_EXISTING' then 'in_progress'
          else 'ready' end
      ) returning * into created;

      insert into public.organization_members(organization_id, user_id, role)
      values(created.id, request.user_id, 'OWNER');

      update public.profiles
      set default_commercial_organization_id = coalesce(default_commercial_organization_id, created.id),
          updated_at = now()
      where id = request.user_id;

      if request.service_code in ('BUILD_ON_MADAR', 'CONNECT_EXISTING') then
        select * into specialization
        from public.activity_specializations
        where code = case when request.service_code = 'BUILD_ON_MADAR'
          then upper(coalesce(request.setup_payload->>'specialization_code', 'GENERAL_COMMERCE'))
          else 'GENERAL_COMMERCE' end
          and status = 'approved' and is_visible and launch_enabled;
        if specialization.id is not null then
          perform private.activate_sector_package_impl(created.id, specialization.id, request.user_id);
        end if;
      end if;
    end if;

    update public.workspace_payment_submissions
    set status = 'approved', reviewed_by = actor, reviewed_at = now(),
        review_note = nullif(btrim(reason), '')
    where workspace_request_id = request.id and status = 'under_review';

    update public.workspace_requests
    set status = 'approved', reviewed_by = actor, reviewed_at = now(),
        organization_id = created.id, rejection_reason = null,
        onboarding_state = case when service_code = 'MADAR_RETAIL' then 'PROVISIONING' else 'ACTIVE' end
    where id = request.id returning * into request;

    insert into public.notifications(user_id, title, body, link)
    values(request.user_id,
      case when request.service_code = 'MADAR_RETAIL' then 'جارٍ تجهيز MADAR Retail' else 'تم تفعيل خدمتك' end,
      case when request.service_code = 'MADAR_RETAIL'
        then 'اعتمدت الإدارة الدفع ويجري الآن تجهيز مساحة Retail الآمنة.'
        else 'اعتمدت الإدارة الدفع وأصبحت الخدمة متاحة من حسابك.' end,
      '/account');
  elsif decision = 'reject' then
    update public.workspace_payment_submissions
    set status = 'rejected', reviewed_by = actor, reviewed_at = now(),
        review_note = nullif(btrim(reason), '')
    where workspace_request_id = request.id and status = 'under_review';
    update public.workspace_requests
    set status = 'rejected', reviewed_by = actor, reviewed_at = now(),
        rejection_reason = nullif(btrim(reason), ''), onboarding_state = 'REJECTED'
    where id = request.id returning * into request;
    insert into public.notifications(user_id, title, body, link)
    values(request.user_id, 'تعذر اعتماد طلب الخدمة',
      coalesce(nullif(btrim(reason), ''), 'راجع الطلب وأعد تقديم إثبات صحيح.'), '/account');
  else
    raise exception 'INVALID_DECISION';
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'service.request.' || decision, 'workspace_request', request.id,
    jsonb_build_object('service_code', request.service_code, 'request_kind', request.request_kind,
      'organization_id', request.organization_id, 'reason', nullif(btrim(reason), '')));
  return request;
end;
$$;

create or replace function public.review_service_request(
  target_request uuid,
  decision text,
  reason text default null
)
returns public.workspace_requests
language sql
security invoker
set search_path = ''
as $$
  select private.review_workspace_request_impl(target_request, decision, reason)
$$;

create or replace function public.review_workspace_request(
  target_request uuid,
  decision text,
  reason text default null
)
returns public.workspace_requests
language sql
security invoker
set search_path = ''
as $$
  select private.review_workspace_request_impl(target_request, decision, reason)
$$;

revoke all on function public.review_service_request(uuid, text, text) from public, anon;
grant execute on function public.review_service_request(uuid, text, text) to authenticated;

create or replace function private.finalize_retail_service_activation_impl(
  target_request uuid,
  retail_workspace uuid
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  request public.workspace_requests%rowtype;
  subscription public.workspace_subscriptions%rowtype;
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into request from public.workspace_requests
  where id = target_request and service_code = 'MADAR_RETAIL' and status = 'approved' for update;
  if request.id is null then raise exception 'RETAIL_REQUEST_NOT_APPROVED'; end if;
  select * into subscription from public.workspace_subscriptions
  where user_id = request.user_id and service_code = request.service_code for update;
  if subscription.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;

  update public.workspace_subscriptions
  set status = 'active', activation_state = 'ACTIVE', external_workspace_id = retail_workspace,
      suspended_at = null, suspension_reason = null, updated_at = now()
  where id = subscription.id returning * into subscription;
  update public.organizations set status = 'active', updated_at = now()
  where id = subscription.organization_id;
  update public.workspace_requests set onboarding_state = 'ACTIVE', updated_at = now()
  where id = request.id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'service.retail.provisioned', 'workspace_subscription', subscription.id,
    jsonb_build_object('request_id', request.id, 'retail_workspace_id', retail_workspace));
  insert into public.notifications(user_id, title, body, link)
  values(request.user_id, 'MADAR Retail جاهز', 'أصبحت مساحة تجارتك جاهزة وآمنة للاستخدام.', '/retail/workspace');
  return subscription;
end;
$$;

create or replace function public.finalize_retail_service_activation(
  target_request uuid,
  retail_workspace uuid
)
returns public.workspace_subscriptions
language sql
security invoker
set search_path = ''
as $$
  select private.finalize_retail_service_activation_impl(target_request, retail_workspace)
$$;
revoke all on function private.finalize_retail_service_activation_impl(uuid, uuid) from public, anon;
revoke all on function public.finalize_retail_service_activation(uuid, uuid) from public, anon;
grant execute on function private.finalize_retail_service_activation_impl(uuid, uuid) to authenticated;
grant execute on function public.finalize_retail_service_activation(uuid, uuid) to authenticated;

create or replace function private.set_service_subscription_state_impl(
  target_subscription uuid,
  requested_state text,
  reason text default null
)
returns public.workspace_subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  subscription public.workspace_subscriptions%rowtype;
  normalized text := upper(coalesce(requested_state, ''));
begin
  if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if normalized not in ('ACTIVE', 'SUSPENDED', 'EXPIRED') then raise exception 'INVALID_SERVICE_STATE'; end if;
  select * into subscription from public.workspace_subscriptions where id = target_subscription for update;
  if subscription.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if normalized = 'ACTIVE' and subscription.ends_at <= now() then
    raise exception 'RENEWAL_REQUIRED';
  end if;
  update public.workspace_subscriptions
  set activation_state = normalized,
      status = case normalized when 'ACTIVE' then 'active' when 'EXPIRED' then 'expired' else 'suspended' end,
      suspended_at = case when normalized = 'SUSPENDED' then now() else null end,
      suspension_reason = case when normalized = 'SUSPENDED' then nullif(btrim(reason), '') else null end,
      updated_at = now()
  where id = subscription.id returning * into subscription;
  update public.organizations
  set status = case when normalized = 'ACTIVE' then 'active'::public.organization_status else 'suspended'::public.organization_status end,
      updated_at = now()
  where id = subscription.organization_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(actor, 'service.subscription.state_changed', 'workspace_subscription', subscription.id,
    jsonb_build_object('service_code', subscription.service_code, 'state', normalized,
      'reason', nullif(btrim(reason), '')));
  return subscription;
end;
$$;

create or replace function public.set_service_subscription_state(
  target_subscription uuid,
  requested_state text,
  reason text default null
)
returns public.workspace_subscriptions
language sql
security invoker
set search_path = ''
as $$
  select private.set_service_subscription_state_impl(target_subscription, requested_state, reason)
$$;
revoke all on function private.set_service_subscription_state_impl(uuid, text, text) from public, anon;
revoke all on function public.set_service_subscription_state(uuid, text, text) from public, anon;
grant execute on function private.set_service_subscription_state_impl(uuid, text, text) to authenticated;
grant execute on function public.set_service_subscription_state(uuid, text, text) to authenticated;

drop policy if exists "public reads active plans" on public.subscription_plans;
create policy "users read available service plans"
on public.subscription_plans for select to anon, authenticated
using ((is_active and is_available) or (select private.is_admin()));

drop policy if exists "members read subscriptions" on public.workspace_subscriptions;
create policy "users read own service subscriptions"
on public.workspace_subscriptions for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
  or (select private.is_organization_member(organization_id))
);

-- Service logos live in a private, account-scoped bucket.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('service-assets', 'service-assets', false, 5242880,
  array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "service asset owner insert" on storage.objects;
create policy "service asset owner insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'service-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
drop policy if exists "service asset owner read" on storage.objects;
create policy "service asset owner read" on storage.objects
for select to authenticated
using (
  bucket_id = 'service-assets'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
);
drop policy if exists "service asset owner delete" on storage.objects;
create policy "service asset owner delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'service-assets'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
);

-- Student Space is preserved in madarorbit/madar-student and detached from the
-- Platform runtime. Keep legacy tables for safe history, but remove client access.
revoke all on table
  public.student_ai_history,
  public.student_courses,
  public.student_documents,
  public.student_events,
  public.student_goals,
  public.student_notes,
  public.student_schedule,
  public.student_study_sessions,
  public.student_tasks
from anon, authenticated;
revoke execute on function public.ensure_student_workspace() from anon, authenticated;
revoke execute on function public.sync_student_reminders(uuid) from anon, authenticated;
drop policy if exists "student library member delete" on storage.objects;
drop policy if exists "student library member insert" on storage.objects;
drop policy if exists "student library member read" on storage.objects;

-- Remove Student from ORBY's active platform catalog while retaining an
-- auditable, non-runnable record of the historical configuration.
update public.orby_domain_plugins
set enabled = false, updated_at = now()
where domain_key = 'student';
update public.orby_workflow_templates
set enabled = false, updated_at = now()
where domain = 'student' or key like 'student.%';
update public.orby_workflow_definitions
set status = 'archived', updated_at = now()
where domain = 'student' or key like 'student.%';
update public.orby_vertical_installations
set status = 'archived', updated_at = now()
where vertical_key = 'student';
update public.orby_plugins
set status = 'archived', updated_at = now()
where key like '%student%' or entrypoint like '%student%';

comment on column public.subscription_plans.service_code is
'Exactly one centrally managed plan belongs to each MADAR service.';
comment on table public.workspace_requests is
'Service activation/renewal requests. The legacy table name is retained to avoid a parallel subscription system.';
comment on table public.workspace_subscriptions is
'Independent service subscriptions keyed by account and service_code.';
