-- subscription_plans uses service_code while payment_methods uses code. Read
-- the trigger row generically so audit logging never references a column that
-- is absent from the current table.

create or replace function private.audit_service_configuration_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  row_data jsonb;
  entity uuid;
  configuration_code text;
begin
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity := nullif(row_data->>'id', '')::uuid;
  configuration_code := coalesce(
    nullif(row_data->>'service_code', ''),
    nullif(row_data->>'code', '')
  );

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
end
$$;

revoke all on function private.audit_service_configuration_change()
from public, anon, authenticated;
