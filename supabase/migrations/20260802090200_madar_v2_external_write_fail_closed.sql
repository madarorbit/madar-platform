-- MADAR V2 production opens the connector engine for setup, mapping and reads,
-- but reverse writes stay globally closed until a real customer pilot passes
-- the approved stability and recovery gates.
insert into public.integration_feature_flags(organization_id,key,enabled,config)
values(
  null,
  'integration_write_enabled',
  false,
  jsonb_build_object(
    'release','V2.0',
    'confirmation_required',true,
    'fail_closed',true,
    'activation_requires_real_pilot',true,
    'required_stable_days',7
  )
)
on conflict(key) where organization_id is null
do update set enabled=false,config=excluded.config,updated_at=now();

insert into public.audit_logs(actor_id,action,entity_type,metadata)
values(
  null,
  'v2.integration.external_write_fail_closed',
  'platform',
  jsonb_build_object('release','V2.0','reason','real_customer_pilot_required')
);
