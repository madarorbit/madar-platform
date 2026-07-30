-- Governed automatic model selection for ORBY external runtime.
-- The server probes the live OpenRouter key and candidate models first, then calls
-- this founder-guarded RPC with the exact vetted model that succeeded.

insert into public.orby_model_registry(
 id,provider_id,provider_model,display_name,enabled,priority,capabilities,limits,pricing,metadata
)
values
 (
  'gemini-2.5-flash-lite','openrouter','google/gemini-2.5-flash-lite','Gemini 2.5 Flash Lite',false,10,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":0.10,"outputCostPerMillion":0.40,"currency":"USD","source":"openrouter-catalog-2026-07-31"}'::jsonb,
  '{"tags":["low-latency","arabic","cost-efficient","automatic-candidate"],"routingTier":"automatic-primary","defaultReasoningEnabled":false,"storesSecrets":false}'::jsonb
 ),
 (
  'gpt-4.1-nano','openrouter','openai/gpt-4.1-nano','GPT-4.1 Nano',false,20,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":32768}'::jsonb,
  '{"inputCostPerMillion":0.10,"outputCostPerMillion":0.40,"currency":"USD","source":"openrouter-catalog-2026-07-31"}'::jsonb,
  '{"tags":["low-latency","structured-output","cost-efficient","automatic-candidate"],"routingTier":"automatic-fallback","defaultReasoningEnabled":false,"storesSecrets":false}'::jsonb
 )
on conflict(id) do update set
 provider_id=excluded.provider_id,
 provider_model=excluded.provider_model,
 display_name=excluded.display_name,
 enabled=false,
 priority=excluded.priority,
 capabilities=excluded.capabilities,
 limits=excluded.limits,
 pricing=excluded.pricing,
 metadata=excluded.metadata,
 updated_at=now();

update public.orby_model_registry
set enabled=false,
    priority=case
      when id='gemini-2.5-flash-lite' then 10
      when id='gpt-4.1-nano' then 20
      when id='deepseek-v3.2' then 30
      when id='deepseek-v4-flash' then 50
      else priority
    end,
    metadata=case
      when id='deepseek-v3.2' then metadata||'{"routingTier":"automatic-fallback","automaticCandidate":true}'::jsonb
      when id='deepseek-v4-flash' then metadata||'{"routingTier":"manual-heavy-reasoning","automaticCandidate":false}'::jsonb
      else metadata
    end,
    updated_at=now()
where provider_id='openrouter';

create or replace function public.orby_os_activate_external_runtime(
 target_provider text default 'openrouter',
 target_model text default 'gemini-2.5-flash-lite',
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
 release_version text;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 if target_provider<>'openrouter' then raise exception 'ORBY_PROVIDER_NOT_APPROVED' using errcode='P0001'; end if;
 if target_model not in ('gemini-2.5-flash-lite','gpt-4.1-nano','deepseek-v3.2') then raise exception 'ORBY_MODEL_NOT_APPROVED' using errcode='P0001'; end if;
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
  'modelSelectionMode','governed-auto-probe',
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
  ('orby_provider_execution_enabled',null,true,100,jsonb_build_object('provider',target_provider,'model',target_model,'selectionMode','governed-auto-probe','credentialSource','vercel-environment'),auth.uid()),
  ('orby_ocr_enabled',null,true,100,jsonb_build_object('provider','mistral','model',target_ocr_model,'credentialSource','vercel-environment'),auth.uid())
 on conflict(key,scope_key) do update set
  enabled=excluded.enabled,
  rollout_percentage=excluded.rollout_percentage,
  configuration=excluded.configuration,
  updated_by=auth.uid(),
  updated_at=now();

 release_version:='openrouter-auto-'||target_model||'-mistral-ocr3';
 insert into public.orby_os_releases(
  organization_id,component,component_key,version,status,rollout_percentage,previous_version,metadata,created_by,activated_at
 )
 values(
  null,'model_config','orby-external-runtime',release_version,'active',100,'openrouter-deepseek-v3.2-mistral-ocr3',
  jsonb_build_object(
   'provider',target_provider,
   'model',target_model,
   'selectionMode','governed-auto-probe',
   'candidateModels',jsonb_build_array('gemini-2.5-flash-lite','gpt-4.1-nano','deepseek-v3.2'),
   'ocrProvider','mistral',
   'ocrModel',target_ocr_model,
   'credentialsStoredOutsideDatabase',true,
   'externalChannelsActive',false
  ),
  auth.uid(),now()
 )
 on conflict(component,component_key,version,scope_key) do update set
  status='active',rollout_percentage=100,metadata=excluded.metadata,activated_at=now()
 returning id into release_id;

 return jsonb_build_object(
  'active',true,
  'provider',target_provider,
  'model',target_model,
  'selection_mode','governed-auto-probe',
  'ocr_provider','mistral',
  'ocr_model',target_ocr_model,
  'runtime_config_id',runtime_id,
  'release_id',release_id,
  'external_channels_active',false
 );
end $$;

revoke all on function public.orby_os_activate_external_runtime(text,text,text) from public,anon,authenticated;
grant execute on function public.orby_os_activate_external_runtime(text,text,text) to authenticated,service_role;
