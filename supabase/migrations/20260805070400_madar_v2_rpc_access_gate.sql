-- MADAR V2.0 — enforce paid access at the RPC boundary, not only in pages.
-- Billing recovery uses a separate membership-only guard so expired customers
-- can submit payment while every operational RPC remains fail-closed.

create or replace function private.assert_v2_organization_membership(
  target_organization uuid,
  require_manager boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  member_role public.organization_role;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select membership.role
  into member_role
  from public.organization_members membership
  where membership.organization_id = target_organization
    and membership.user_id = actor;

  if member_role is null then
    raise exception 'ORGANIZATION_ACCESS_DENIED';
  end if;
  if require_manager and member_role not in ('OWNER', 'ADMIN') then
    raise exception 'ORGANIZATION_MANAGER_REQUIRED';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    where profile.id = actor
      and profile.account_type = 'BUSINESS'
      and profile.status = 'active'
  ) then
    raise exception 'BUSINESS_ACCOUNT_REQUIRED';
  end if;

  return actor;
end;
$$;

revoke all on function private.assert_v2_organization_membership(uuid, boolean)
from public, anon, authenticated;
grant execute on function private.assert_v2_organization_membership(uuid, boolean)
to authenticated, service_role;

create or replace function private.assert_v2_organization_access(
  target_organization uuid,
  require_manager boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  organization_type public.organization_type;
  workspace_access jsonb;
begin
  actor := private.assert_v2_organization_membership(
    target_organization,
    require_manager
  );

  select organization.type
  into organization_type
  from public.organizations organization
  where organization.id = target_organization;

  if organization_type is null then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;
  if organization_type = 'STUDENT' then
    return actor;
  end if;

  workspace_access := private.v2_active_subscription_entitlement(
    target_organization,
    'workspace_access'
  );
  if coalesce((workspace_access #>> '{}')::boolean, false) is not true then
    raise exception 'V2_WORKSPACE_ACCESS_DISABLED';
  end if;

  return actor;
end;
$$;

revoke all on function private.assert_v2_organization_access(uuid, boolean)
from public, anon, authenticated;
grant execute on function private.assert_v2_organization_access(uuid, boolean)
to authenticated, service_role;

create or replace function private.submit_v2_local_payment_impl(
  target_organization uuid,
  target_variant uuid,
  target_method uuid,
  target_currency text,
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
  actor uuid;
  organization public.organizations%rowtype;
  variant public.pricing_variants;
  current_variant public.pricing_variants;
  book public.pricing_price_books;
  price public.pricing_variant_prices;
  method public.payment_methods;
  entitlements jsonb;
  request_id uuid;
begin
  actor := private.assert_v2_organization_membership(
    target_organization,
    true
  );

  select *
  into organization
  from public.organizations
  where id = target_organization
    and type <> 'STUDENT';
  if organization.id is null then
    raise exception 'BUSINESS_ORGANIZATION_REQUIRED';
  end if;
  if upper(target_currency) <> organization.currency then
    raise exception 'WORKSPACE_CURRENCY_MISMATCH';
  end if;

  select *
  into variant
  from public.pricing_variants
  where id = target_variant
    and is_active;
  if variant.id is null
     or variant.operating_mode <> organization.operating_mode then
    raise exception 'PRICING_VARIANT_NOT_AVAILABLE';
  end if;

  select pricing_variant.*
  into current_variant
  from public.pricing_subscription_snapshots subscription
  join public.pricing_variants pricing_variant
    on pricing_variant.id = subscription.variant_id
  where subscription.organization_id = target_organization
    and subscription.status in ('trialing', 'active', 'past_due')
  order by subscription.created_at desc
  limit 1;

  if current_variant.id is not null
     and (case variant.level_code when 'BASIC' then 1 when 'PREMIUM' then 2 else 3 end)
       < (case current_variant.level_code when 'BASIC' then 1 when 'PREMIUM' then 2 else 3 end) then
    raise exception 'DOWNGRADE_MUST_BE_SCHEDULED';
  end if;

  select *
  into book
  from public.pricing_price_books
  where is_default
    and status = 'active'
    and valid_from <= now()
    and (valid_until is null or valid_until > now())
  order by valid_from desc
  limit 1;
  if book.id is null then
    raise exception 'ACTIVE_PRICE_BOOK_NOT_FOUND';
  end if;

  select *
  into price
  from public.pricing_variant_prices
  where price_book_id = book.id
    and variant_id = variant.id
    and currency = organization.currency;

  select *
  into method
  from public.payment_methods
  where id = target_method
    and is_active
    and currency = organization.currency;

  if price.variant_id is null or method.id is null then
    raise exception 'PAYMENT_METHOD_OR_PRICE_UNAVAILABLE';
  end if;
  if char_length(trim(reference)) not between 3 and 120
     or proof_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
     or proof_size not between 1 and 10485760 then
    raise exception 'INVALID_PAYMENT_PROOF';
  end if;
  if exists (
    select 1
    from public.pricing_local_payment_requests payment
    where payment.organization_id = target_organization
      and payment.status = 'under_review'
  ) then
    raise exception 'PAYMENT_ALREADY_PENDING';
  end if;

  select coalesce(jsonb_object_agg(entitlement_key, value), '{}'::jsonb)
  into entitlements
  from public.pricing_variant_entitlements
  where variant_id = variant.id;

  insert into public.pricing_local_payment_requests(
    organization_id,
    requested_by,
    variant_id,
    price_book_id,
    payment_method_id,
    currency,
    amount,
    locked_entitlements,
    payment_reference,
    storage_path,
    original_filename,
    mime_type,
    file_size
  )
  values(
    target_organization,
    actor,
    variant.id,
    book.id,
    method.id,
    organization.currency,
    price.amount,
    entitlements,
    trim(reference),
    proof_path,
    proof_name,
    proof_mime,
    proof_size
  )
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function private.submit_v2_local_payment_impl(uuid, uuid, uuid, text, text, text, text, text, bigint)
from public, anon, authenticated;
grant execute on function private.submit_v2_local_payment_impl(uuid, uuid, uuid, text, text, text, text, text, bigint)
to authenticated;

create or replace function private.review_v2_local_payment_impl(
  target_request uuid,
  decision text,
  note text
)
returns public.pricing_local_payment_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.pricing_local_payment_requests;
  variant public.pricing_variants;
  current_sub public.pricing_subscription_snapshots;
begin
  if not private.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select *
  into request
  from public.pricing_local_payment_requests
  where id = target_request
    and status = 'under_review'
  for update;
  if request.id is null then
    raise exception 'PAYMENT_NOT_REVIEWABLE';
  end if;

  if decision = 'approve' then
    select *
    into variant
    from public.pricing_variants
    where id = request.variant_id;
    if variant.id is null then
      raise exception 'PRICING_VARIANT_NOT_FOUND';
    end if;

    select *
    into current_sub
    from public.pricing_subscription_snapshots
    where organization_id = request.organization_id
      and status in ('trialing', 'active', 'past_due')
    order by created_at desc
    limit 1
    for update;

    if current_sub.id is not null then
      update public.pricing_subscription_snapshots
      set status = 'cancelled', ends_at = now(), updated_at = now()
      where id = current_sub.id;

      update public.pricing_subscription_changes
      set status = 'cancelled'
      where subscription_snapshot_id = current_sub.id
        and status = 'scheduled';
    end if;

    insert into public.pricing_subscription_snapshots(
      organization_id,
      variant_id,
      price_book_id,
      currency,
      locked_amount,
      locked_entitlements,
      status,
      starts_at,
      ends_at,
      is_grandfathered
    )
    values(
      request.organization_id,
      request.variant_id,
      request.price_book_id,
      request.currency,
      request.amount,
      request.locked_entitlements,
      'active',
      now(),
      now() + (variant.term_months || ' months')::interval,
      false
    );

    update public.pricing_local_payment_requests
    set
      status = 'approved',
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = nullif(trim(note), '')
    where id = request.id
    returning * into request;

    insert into public.audit_logs(
      actor_id,
      action,
      entity_type,
      entity_id,
      metadata
    )
    values(
      (select auth.uid()),
      'pricing.v2_payment.approved',
      'organization',
      request.organization_id,
      jsonb_build_object(
        'payment_request_id', request.id,
        'variant_id', request.variant_id,
        'amount', request.amount,
        'currency', request.currency,
        'term_months', variant.term_months,
        'version', '2.0'
      )
    );

    insert into public.notifications(user_id, title, body, link)
    select distinct
      membership.user_id,
      'تم اعتماد اشتراك مَدار V2.0',
      'تم اعتماد إثبات الدفع وفتح مساحة العمل وفق الباقة والمدة المحددتين.',
      '/workspace'
    from public.organization_members membership
    where membership.organization_id = request.organization_id
      and membership.role in ('OWNER', 'ADMIN');

  elsif decision = 'reject' then
    update public.pricing_local_payment_requests
    set
      status = 'rejected',
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_note = nullif(trim(note), '')
    where id = request.id
    returning * into request;

    insert into public.notifications(user_id, title, body, link)
    select distinct
      membership.user_id,
      'تعذر اعتماد إثبات الدفع',
      coalesce(nullif(trim(note), ''), 'راجع بيانات التحويل وأرسل إثباتًا صحيحًا.'),
      '/account/subscription'
    from public.organization_members membership
    where membership.organization_id = request.organization_id
      and membership.role in ('OWNER', 'ADMIN');
  else
    raise exception 'INVALID_DECISION';
  end if;

  return request;
end;
$$;

revoke all on function private.review_v2_local_payment_impl(uuid, text, text)
from public, anon, authenticated;
grant execute on function private.review_v2_local_payment_impl(uuid, text, text)
to authenticated;

comment on function private.assert_v2_organization_access(uuid, boolean) is
'Authoritative operational guard: active business account, organization membership, and a server-valid MADAR V2 workspace_access entitlement.';
comment on function private.assert_v2_organization_membership(uuid, boolean) is
'Billing-recovery membership guard. It does not grant operational workspace access.';
