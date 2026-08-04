-- MADAR V2.0 — ORBY must not bypass workspace expiry through SECURITY DEFINER
-- functions or direct Data API calls.

create or replace function public.orby_business_context(
  target_organization uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.assert_v2_organization_access(
    target_organization,
    false
  );
  return private.orby_business_context_impl(target_organization);
end;
$$;

revoke all on function private.orby_business_context_impl(uuid)
from public, anon, authenticated;
revoke all on function public.orby_business_context(uuid)
from public, anon;
grant execute on function public.orby_business_context(uuid)
to authenticated;

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

do $$
declare
  protected_table text;
  policy_name text := 'madar v2 orby access gate';
  trigger_name text := 'madar_v2_orby_access_guard';
begin
  foreach protected_table in array array[
    'orby_conversations',
    'orby_messages',
    'orby_insights',
    'orby_action_drafts',
    'orby_usage_daily',
    'orby_message_feedback'
  ] loop
    if to_regclass(format('public.%I', protected_table)) is null then
      raise exception 'EXPECTED_ORBY_TABLE_MISSING:%', protected_table;
    end if;
    if not exists (
      select 1
      from information_schema.columns column_definition
      where column_definition.table_schema = 'public'
        and column_definition.table_name = protected_table
        and column_definition.column_name = 'organization_id'
    ) then
      raise exception 'EXPECTED_ORBY_ORGANIZATION_COLUMN_MISSING:%', protected_table;
    end if;

    execute format('alter table public.%I enable row level security', protected_table);
    execute format('drop policy if exists %I on public.%I', policy_name, protected_table);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using ((select private.has_v2_workspace_access(organization_id))) with check ((select private.has_v2_workspace_access(organization_id)))',
      policy_name,
      protected_table
    );

    execute format('drop trigger if exists %I on public.%I', trigger_name, protected_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function private.enforce_orby_v2_workspace_access()',
      trigger_name,
      protected_table
    );
  end loop;
end;
$$;

comment on function public.orby_business_context(uuid) is
'MADAR V2 ORBY context endpoint. Requires the same server-valid workspace_access entitlement as every operational workspace RPC.';
comment on function private.enforce_orby_v2_workspace_access() is
'Prevents authenticated SECURITY DEFINER ORBY writes from bypassing subscription expiry; service jobs remain available.';
