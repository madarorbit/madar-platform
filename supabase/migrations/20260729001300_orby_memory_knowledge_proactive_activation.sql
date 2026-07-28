-- ORBY Stage 3 conservative activation.
-- Enables memory summaries, proactive detectors, in-app notifications and periodic reports for existing organizations.
-- Long-term memory, external notification delivery, external writes and deletes remain disabled.

insert into public.orby_memory_policies(organization_id,enabled,policy,created_by,updated_by)
select o.id,true,jsonb_build_object(
 'enabled',true,'allowConversationHistory',true,'allowSummaries',true,'allowShortTerm',true,
 'allowLongTerm',false,'allowPreferences',true,'allowWorkspaceMemory',true,'requireExplicitLongTermConsent',true,
 'maximumConversationMessages',24,'summaryTriggerMessages',30,'shortTermTtlSeconds',604800,
 'maximumMemoriesPerScope',500,'blockedKeys',jsonb_build_array('password','secret','token','api_key','credential','private_key'),
 'blockedPatterns',jsonb_build_array('-----BEGIN PRIVATE KEY-----','Bearer ','sk-'),
 'allowedSensitivities',jsonb_build_array('public','internal','sensitive')
),owner_member.user_id,owner_member.user_id
from public.organizations o
left join lateral (
 select m.user_id from public.organization_members m where m.organization_id=o.id and m.role='OWNER' order by m.user_id asc limit 1
) owner_member on true
where not exists(select 1 from public.orby_memory_policies p where p.organization_id=o.id);

insert into public.orby_notification_preferences(organization_id,user_id,workspace_id,workspace_scope,enabled,channels,minimum_severity,digest_mode,detector_settings,cooldown_minutes,metadata)
select m.organization_id,m.user_id,null,'00000000-0000-0000-0000-000000000000'::uuid,true,'["in_app"]'::jsonb,'medium','immediate','{}'::jsonb,180,'{"source":"orby-stage-3-default"}'::jsonb
from public.organization_members m
where m.role='OWNER'
 and not exists(select 1 from public.orby_notification_preferences p where p.organization_id=m.organization_id and p.user_id=m.user_id and p.workspace_id is null);

-- The only execution tool activated by Stage 3 creates an internal draft. It cannot modify business records directly.
insert into public.orby_tool_catalog(name,version,category,status,enabled,manifest)
values(
 'madar.business.action.draft','1.0.0','business','active',true,
 '{"name":"madar.business.action.draft","description":"إنشاء مسودة إجراء أعمال لا تُنفذ إلا بعد المرور بمسار الموافقة والتأكيد.","version":"1.0.0","category":"business","requiredPermissions":["business.action.draft"],"executionType":"write","inputSchema":{"type":"object","properties":{"actionType":{"type":"string","minLength":2,"maxLength":100},"payload":{"type":"object","additionalProperties":true}},"required":["actionType","payload"],"additionalProperties":false},"outputSchema":{"type":"object","additionalProperties":true},"riskLevel":"low","status":"active","support":"stable","requirements":["orby-action-drafts"],"maxTimeoutMs":15000,"supportsSandbox":true,"operation":"business.action.draft"}'::jsonb
)
on conflict(name) do update set enabled=true,status='active',version=excluded.version,category=excluded.category,manifest=excluded.manifest,updated_at=now();

insert into public.orby_execution_config(organization_id,enabled,config,created_by,updated_by)
select o.id,true,jsonb_build_object(
 'planningEnabled',false,'maxWorkflowSteps',30,'maxParallelActions',4,'maxLoopIterations',20,
 'defaultToolTimeoutMs',15000,'maxToolTimeoutMs',60000,'maxAttempts',3,'retryBaseDelayMs',1000,'retryMaxDelayMs',30000,
 'approvalTtlSeconds',604800,'dailyActionLimit',100,'perMinuteActionLimit',10,'maxPayloadBytes',262144,
 'allowExternalWrites',false,'allowDeletes',false,'sandboxRequiredForHighRisk',true
),owner_member.user_id,owner_member.user_id
from public.organizations o
left join lateral (select m.user_id from public.organization_members m where m.organization_id=o.id and m.role='OWNER' order by m.user_id asc limit 1) owner_member on true
where not exists(select 1 from public.orby_execution_config c where c.organization_id=o.id);

-- Kernel activation is safe only when an enabled model already exists. Otherwise RAG uses the extractive grounded fallback.
insert into public.orby_runtime_config(organization_id,config,created_by,updated_by)
select o.id,'{"enabled":true}'::jsonb,owner_member.user_id,owner_member.user_id
from public.organizations o
left join lateral (select m.user_id from public.organization_members m where m.organization_id=o.id and m.role='OWNER' order by m.user_id asc limit 1) owner_member on true
where exists(select 1 from public.orby_model_registry model where model.enabled)
 and not exists(select 1 from public.orby_runtime_config c where c.organization_id=o.id);

-- Automatic detectors, daily/weekly reports and retention. One deterministic owner is selected per organization.
with owners as (
 select distinct on (m.organization_id) m.organization_id,m.user_id
 from public.organization_members m
 where m.role='OWNER'
 order by m.organization_id,m.user_id
)
insert into public.orby_intelligence_schedules(organization_id,job_type,cron_expression,interval_seconds,payload,enabled,timezone,next_run_at,created_by)
select m.organization_id,'detector.run','0 * * * *',3600,jsonb_build_object('userId',m.user_id,'cooldownMinutes',180,'stage3Default','detector'),true,'Asia/Aden',now()+interval '10 minutes',m.user_id
from owners m
where not exists(select 1 from public.orby_intelligence_schedules s where s.organization_id=m.organization_id and s.job_type='detector.run' and s.payload->>'stage3Default'='detector')
union all
select m.organization_id,'report.generate','0 8 * * *',86400,jsonb_build_object('userId',m.user_id,'reportType','daily','stage3Default','daily-report'),true,'Asia/Aden',((date_trunc('day',now() at time zone 'Asia/Aden')+interval '1 day 8 hours') at time zone 'Asia/Aden'),m.user_id
from owners m
where not exists(select 1 from public.orby_intelligence_schedules s where s.organization_id=m.organization_id and s.job_type='report.generate' and s.payload->>'stage3Default'='daily-report')
union all
select m.organization_id,'report.generate','0 8 * * 6',604800,jsonb_build_object('userId',m.user_id,'reportType','weekly','stage3Default','weekly-report'),true,'Asia/Aden',now()+interval '7 days',m.user_id
from owners m
where not exists(select 1 from public.orby_intelligence_schedules s where s.organization_id=m.organization_id and s.job_type='report.generate' and s.payload->>'stage3Default'='weekly-report')
union all
select m.organization_id,'retention.cleanup','30 3 * * *',86400,jsonb_build_object('userId',m.user_id,'stage3Default','retention'),true,'Asia/Aden',now()+interval '1 day',m.user_id
from owners m
where not exists(select 1 from public.orby_intelligence_schedules s where s.organization_id=m.organization_id and s.job_type='retention.cleanup' and s.payload->>'stage3Default'='retention');
