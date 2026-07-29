-- ORBY external runtime: OpenRouter + DeepSeek V4 Flash + Mistral OCR 3.
-- Catalog records are safe metadata only. Runtime remains disabled until the
-- founder adds server-side credentials and executes the guarded activation RPC.

insert into public.orby_provider_registry(
 id,display_name,enabled,priority,capabilities,limits,routing_policy,metadata
)
values(
 'openrouter','OpenRouter',false,10,
 '{"text":true,"streaming":true,"json":true}'::jsonb,
 '{"requestTimeoutMs":45000,"maxAttempts":2}'::jsonb,
 '{"mode":"balanced","allowFallbacks":true,"dataCollection":"deny"}'::jsonb,
 '{"credentialSource":"vercel-environment","credentialVariable":"ORBY_OPENROUTER_API_KEY","selectedFor":["speed","efficiency","low-cost"],"storesSecrets":false}'::jsonb
)
on conflict(id) do update set
 display_name=excluded.display_name,
 priority=excluded.priority,
 capabilities=excluded.capabilities,
 limits=excluded.limits,
 routing_policy=excluded.routing_policy,
 metadata=excluded.metadata,
 updated_at=now();

insert into public.orby_model_registry(
 id,provider_id,provider_model,display_name,enabled,priority,capabilities,limits,pricing,metadata
)
values
 (
  'deepseek-v4-flash','openrouter','deepseek/deepseek-v4-flash','DeepSeek V4 Flash',false,10,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":0.09,"outputCostPerMillion":0.18,"currency":"USD","source":"openrouter-catalog-2026-07-29"}'::jsonb,
  '{"tags":["tools","reasoning","arabic","cost-efficient","primary"],"routingTier":"primary","storesSecrets":false}'::jsonb
 ),
 (
  'deepseek-v4-pro','openrouter','deepseek/deepseek-v4-pro','DeepSeek V4 Pro',false,40,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":0.435,"outputCostPerMillion":0.87,"currency":"USD","source":"openrouter-catalog-2026-07-29"}'::jsonb,
  '{"tags":["tools","reasoning","arabic","fallback"],"routingTier":"manual-fallback","storesSecrets":false}'::jsonb
 )
on conflict(id) do update set
 provider_id=excluded.provider_id,
 provider_model=excluded.provider_model,
 display_name=excluded.display_name,
 priority=excluded.priority,
 capabilities=excluded.capabilities,
 limits=excluded.limits,
 pricing=excluded.pricing,
 metadata=excluded.metadata,
 updated_at=now();

create or replace function public.orby_os_activate_external_runtime(
 target_provider text default 'openrouter',
 target_model text default 'deepseek-v4-flash',
 target_ocr_model text default 'mistral-ocr-2512'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 runtime_id uuid;
 current_config jsonb;
 release_id uuid;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_provider<>'openrouter' then raise exception 'ORBY_PROVIDER_NOT_APPROVED' using errcode='P0001'; end if;
 if target_model<>'deepseek-v4-flash' then raise exception 'ORBY_MODEL_NOT_APPROVED' using errcode='P0001'; end if;
 if target_ocr_model not in ('mistral-ocr-2512','mistral-ocr-latest') then raise exception 'ORBY_OCR_MODEL_NOT_APPROVED' using errcode='P0001'; end if;
 if not exists(select 1 from public.orby_provider_registry where id=target_provider) then raise exception 'ORBY_PROVIDER_NOT_REGISTERED' using errcode='P0002'; end if;
 if not exists(select 1 from public.orby_model_registry where id=target_model and provider_id=target_provider) then raise exception 'ORBY_MODEL_NOT_REGISTERED' using errcode='P0002'; end if;

 update public.orby_provider_registry
 set enabled=(id=target_provider),updated_by=auth.uid(),updated_at=now()
 where id=target_provider;
 update public.orby_model_registry
 set enabled=(id=target_model),updated_by=auth.uid(),updated_at=now()
 where provider_id=target_provider;

 select id,config into runtime_id,current_config
 from public.orby_runtime_config
 where organization_id is null
 order by updated_at desc,id desc
 limit 1
 for update;
 current_config:=coalesce(current_config,'{}'::jsonb)||jsonb_build_object(
  'enabled',true,
  'defaultModelId',target_model,
  'allowedProviderIds',jsonb_build_array(target_provider),
  'allowedModelIds',jsonb_build_array(target_model),
  'maxContextCharacters',120000,
  'sessionHistoryLimit',30,
  'sessionTtlSeconds',604800,
  'requestTimeoutMs',45000,
  'maxAttempts',2,
  'retryBaseDelayMs',350,
  'logLevel','info'
 );
 if runtime_id is null then
  insert into public.orby_runtime_config(organization_id,config,revision,created_by,updated_by)
  values(null,current_config,1,auth.uid(),auth.uid()) returning id into runtime_id;
 else
  update public.orby_runtime_config
  set config=current_config,revision=revision+1,updated_by=auth.uid(),updated_at=now()
  where id=runtime_id;
 end if;

 insert into public.orby_feature_flags(key,environment,enabled,rollout_percentage,configuration,updated_by)
 values
  ('orby_provider_execution_enabled',null,true,100,jsonb_build_object('provider',target_provider,'model',target_model,'credentialSource','vercel-environment'),auth.uid()),
  ('orby_ocr_enabled',null,true,100,jsonb_build_object('provider','mistral','model',target_ocr_model,'credentialSource','vercel-environment'),auth.uid())
 on conflict(key,scope_key) do update set
  enabled=excluded.enabled,
  rollout_percentage=excluded.rollout_percentage,
  configuration=excluded.configuration,
  updated_by=auth.uid(),
  updated_at=now();

 insert into public.orby_os_releases(
  organization_id,component,component_key,version,status,rollout_percentage,previous_version,metadata,created_by,activated_at
 )
 values(
  null,'model_config','orby-external-runtime','openrouter-deepseek-v4-flash-mistral-ocr3','active',100,null,
  jsonb_build_object('provider',target_provider,'model',target_model,'ocrProvider','mistral','ocrModel',target_ocr_model,'credentialsStoredOutsideDatabase',true),
  auth.uid(),now()
 )
 on conflict(component,component_key,version,scope_key) do update set
  status='active',rollout_percentage=100,metadata=excluded.metadata,activated_at=now()
 returning id into release_id;

 return jsonb_build_object(
  'active',true,
  'provider',target_provider,
  'model',target_model,
  'ocr_provider','mistral',
  'ocr_model',target_ocr_model,
  'runtime_config_id',runtime_id,
  'release_id',release_id,
  'external_channels_active',false
 );
end $$;

create or replace function public.orby_os_deactivate_external_runtime()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 update public.orby_provider_registry set enabled=false,updated_by=auth.uid(),updated_at=now() where id='openrouter';
 update public.orby_model_registry set enabled=false,updated_by=auth.uid(),updated_at=now() where provider_id='openrouter';
 update public.orby_runtime_config
 set config=config||jsonb_build_object('enabled',false,'allowedProviderIds','[]'::jsonb,'allowedModelIds','[]'::jsonb),revision=revision+1,updated_by=auth.uid(),updated_at=now()
 where organization_id is null;
 update public.orby_feature_flags
 set enabled=false,rollout_percentage=0,configuration=configuration||jsonb_build_object('disabledAt',now()),updated_by=auth.uid(),updated_at=now()
 where key in ('orby_provider_execution_enabled','orby_ocr_enabled') and scope_key='*:*:*:*';
 return jsonb_build_object('active',false,'provider','openrouter','ocr_provider','mistral','external_channels_active',false);
end $$;

revoke all on function public.orby_os_activate_external_runtime(text,text,text) from public,anon,authenticated;
revoke all on function public.orby_os_deactivate_external_runtime() from public,anon,authenticated;
grant execute on function public.orby_os_activate_external_runtime(text,text,text) to authenticated,service_role;
grant execute on function public.orby_os_deactivate_external_runtime() to authenticated,service_role;
