-- Reconcile ORBY OS tables created by the earlier Stage 4 foundation with
-- the final ORBY V2 O4-O7 contracts. This migration is additive and preserves
-- all existing rows and legacy columns.

alter table public.orby_data_governance_requests
  add column if not exists scope jsonb not null default '[]'::jsonb,
  add column if not exists decision_reason text,
  add column if not exists decided_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz;

update public.orby_data_governance_requests
set scope=coalesce(scope,'[]'::jsonb),
    decision_reason=coalesce(decision_reason,reason),
    decided_by=coalesce(decided_by,approved_by),
    created_at=coalesce(created_at,requested_at,now());

alter table public.orby_data_governance_requests
  alter column scope set default '[]'::jsonb,
  alter column scope set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.orby_data_governance_requests
  drop constraint if exists orby_data_governance_requests_request_type_check,
  drop constraint if exists orby_data_governance_requests_status_check;

alter table public.orby_data_governance_requests
  add constraint orby_data_governance_requests_request_type_check check(request_type in (
    'export','delete','correct','export_user','delete_user','export_workspace','delete_workspace','export_knowledge','delete_memory'
  )),
  add constraint orby_data_governance_requests_status_check check(status in (
    'pending','approved','processing','completed','rejected','failed','cancelled'
  ));

-- The connector registry is keyed by connector_key, not by a synthetic UUID.
do $$
declare connector_type text;
begin
  select data_type into connector_type
  from information_schema.columns
  where table_schema='public' and table_name='orby_source_of_truth_states' and column_name='connector_id';

  if connector_type is not null and connector_type<>'text' then
    if exists(select 1 from public.orby_source_of_truth_states where connector_id is not null) then
      raise exception 'ORBY_SOURCE_CONNECTOR_TYPE_REQUIRES_MANUAL_REVIEW';
    end if;
    alter table public.orby_source_of_truth_states drop constraint if exists orby_source_of_truth_states_connector_id_fkey;
    alter table public.orby_source_of_truth_states alter column connector_id type text using connector_id::text;
  end if;
end $$;

alter table public.orby_source_of_truth_states
  drop constraint if exists orby_source_of_truth_states_connector_id_fkey;

alter table public.orby_source_of_truth_states
  add constraint orby_source_of_truth_states_connector_id_fkey
  foreign key(connector_id) references public.integration_connectors(connector_key) on delete set null;
