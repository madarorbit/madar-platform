-- MADAR V2.0 — final SQL contract corrections after the access hardening pass.

-- This compatibility helper may persist an expired status through the strict
-- entitlement resolver, therefore it must remain VOLATILE rather than STABLE.
create or replace function private.current_v2_entitlement(
  target_organization uuid,
  entitlement text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and not private.is_admin()
     and not private.is_organization_member(target_organization) then
    raise exception 'ORGANIZATION_ACCESS_DENIED';
  end if;

  return private.v2_active_subscription_entitlement(
    target_organization,
    entitlement
  );
end;
$$;

revoke all on function private.current_v2_entitlement(uuid, text)
from public, anon, authenticated;
grant execute on function private.current_v2_entitlement(uuid, text)
to authenticated, service_role;

-- A policy is useful only when RLS is enabled. Enable it for every table that
-- received the restrictive MADAR V2 workspace gate in the prior migration.
do $$
declare
  protected_table text;
begin
  for protected_table in
    select policy.tablename
    from pg_catalog.pg_policies policy
    where policy.schemaname = 'public'
      and policy.policyname in (
        'madar v2 workspace access gate',
        'madar v2 orby access gate'
      )
  loop
    execute format(
      'alter table public.%I enable row level security',
      protected_table
    );
  end loop;
end;
$$;

-- Reject missing or malformed currency before the request reaches the private
-- implementation. The private function still verifies exact workspace match.
create or replace function public.submit_v2_local_payment(
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
security invoker
set search_path = ''
as $$
begin
  if upper(coalesce(target_currency, '')) not in ('SAR', 'USD', 'YER') then
    raise exception 'INVALID_PAYMENT_CURRENCY';
  end if;

  return private.submit_v2_local_payment_impl(
    target_organization,
    target_variant,
    target_method,
    upper(target_currency),
    reference,
    proof_path,
    proof_name,
    proof_mime,
    proof_size
  );
end;
$$;

revoke all on function public.submit_v2_local_payment(uuid, uuid, uuid, text, text, text, text, text, bigint)
from public, anon;
grant execute on function public.submit_v2_local_payment(uuid, uuid, uuid, text, text, text, text, text, bigint)
to authenticated;
