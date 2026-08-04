-- MADAR V2.0 — explicit trigger return paths for PostgreSQL compatibility.

create or replace function private.enforce_orby_v2_workspace_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization uuid;
begin
  if tg_op = 'DELETE' then
    target_organization := old.organization_id;
  else
    target_organization := new.organization_id;
  end if;

  -- Trusted database workers and service-role jobs run without an end-user
  -- auth.uid(). Authenticated customer calls must always pass the V2 gate.
  if (select auth.uid()) is not null
     and coalesce((select auth.role()), '') <> 'service_role'
     and not private.is_admin()
     and not private.has_v2_workspace_access(target_organization) then
    raise exception 'V2_WORKSPACE_ACCESS_REQUIRED';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_orby_v2_workspace_access()
from public, anon, authenticated;
