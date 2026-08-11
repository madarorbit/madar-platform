-- complete_retail_onboarding needs an authenticated owner context internally.
-- The bridge must restore the incoming service-role claims before returning so
-- retries in the same transaction/session remain valid and side-effect free.

alter function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
)
rename to activate_retail_service_context_impl;

revoke all on function public.activate_retail_service_context_impl(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) from public, anon, authenticated, service_role;

create function public.activate_retail_service(
  actor_user uuid,
  platform_organization uuid,
  platform_request uuid,
  service_setup jsonb,
  subscription_ends_at timestamptz,
  subscription_grace_ends_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_sub text := current_setting('request.jwt.claim.sub', true);
  previous_role text := current_setting('request.jwt.claim.role', true);
  previous_claims text := current_setting('request.jwt.claims', true);
  caller_role text := coalesce(
    nullif(previous_role, ''),
    auth.role()::text,
    ''
  );
  result jsonb;
begin
  if caller_role <> 'service_role' then
    raise exception 'PLATFORM_BRIDGE_SERVICE_ROLE_REQUIRED';
  end if;

  result := public.activate_retail_service_context_impl(
    actor_user,
    platform_organization,
    platform_request,
    service_setup,
    subscription_ends_at,
    subscription_grace_ends_at
  );

  perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(previous_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
  return result;
exception
  when others then
    perform set_config('request.jwt.claim.sub', coalesce(previous_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(previous_role, ''), true);
    perform set_config('request.jwt.claims', coalesce(previous_claims, ''), true);
    raise;
end
$$;

revoke all on function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) to service_role;

comment on function public.activate_retail_service(
  uuid, uuid, uuid, jsonb, timestamptz, timestamptz
) is 'Idempotent MADAR Platform bridge that restores its incoming JWT context after provisioning.';
