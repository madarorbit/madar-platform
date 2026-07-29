-- Seed the four built-in ORBY OS workflow templates after their version rows exist.
insert into public.orby_workflow_templates(key,workflow_version_id,name,description,domain,enabled,metadata)
select d.key,v.id,d.name,d.description,d.domain,true,'{"builtin":true}'::jsonb
from public.orby_workflow_definitions d
join public.orby_workflow_versions v on v.workflow_id=d.id and v.version=1
where d.organization_id is null
  and d.key in (
   'business.sales-drop-analysis',
   'store.inventory-review',
   'finance.overdue-payments-review',
   'student.weekly-plan'
  )
on conflict(key) do update set
 workflow_version_id=excluded.workflow_version_id,
 name=excluded.name,
 description=excluded.description,
 domain=excluded.domain,
 enabled=true,
 metadata=excluded.metadata,
 updated_at=now();
