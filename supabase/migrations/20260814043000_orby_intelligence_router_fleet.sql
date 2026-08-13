-- ORBY Intelligence Router v1 model fleet.
-- ORBY Core remains provider-neutral; OpenRouter is the current transport while
-- model selection belongs to ORBY and can switch between model vendors per request.

insert into public.orby_model_registry(
 id,provider_id,provider_model,display_name,enabled,priority,capabilities,limits,pricing,metadata
)
values
 (
  'gpt-5.6-luna','openrouter','openai/gpt-5.6-luna','GPT-5.6 Luna',true,500,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":0.50,"outputCostPerMillion":3.00,"currency":"USD","source":"openrouter-catalog-2026-08-14"}'::jsonb,
  '{"tags":["low-latency","cost-efficient","production","privacy"],"vendor":"openai","storesSecrets":false,"routing":{"quality":4.3,"speed":4.9,"reasoning":3.8,"costEfficiency":4.5,"reliability":4.7,"privacy":4.6,"preferredFor":["conversation","information","monitoring"],"minComplexity":0,"highComplexityBoost":0.2}}'::jsonb
 ),
 (
  'gpt-5.6-terra','openrouter','openai/gpt-5.6-terra','GPT-5.6 Terra',true,480,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":1.25,"outputCostPerMillion":7.50,"currency":"USD","source":"openrouter-catalog-2026-08-14"}'::jsonb,
  '{"tags":["frontier","balanced","reasoning","production","privacy"],"vendor":"openai","storesSecrets":false,"routing":{"quality":4.7,"speed":4.2,"reasoning":4.6,"costEfficiency":4.0,"reliability":4.8,"privacy":4.6,"preferredFor":["information","task","execution"],"minComplexity":0.25,"highComplexityBoost":0.7}}'::jsonb
 ),
 (
  'claude-sonnet-5','openrouter','~anthropic/claude-sonnet-latest','Claude Sonnet 5',true,450,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":2.00,"outputCostPerMillion":10.00,"currency":"USD","source":"openrouter-catalog-2026-08-14"}'::jsonb,
  '{"tags":["frontier","reasoning","analysis","production","privacy"],"vendor":"anthropic","storesSecrets":false,"routing":{"quality":4.85,"speed":3.7,"reasoning":4.9,"costEfficiency":4.0,"reliability":4.85,"privacy":4.6,"preferredFor":["analysis","report","task"],"minComplexity":0.5,"highComplexityBoost":1.0}}'::jsonb
 ),
 (
  'gemini-3.6-flash','openrouter','google/gemini-3.6-flash','Gemini 3.6 Flash',true,430,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":1.50,"outputCostPerMillion":7.50,"currency":"USD","source":"openrouter-catalog-2026-08-14"}'::jsonb,
  '{"tags":["fast","reasoning","production","privacy"],"vendor":"google","storesSecrets":false,"routing":{"quality":4.6,"speed":4.6,"reasoning":4.4,"costEfficiency":4.0,"reliability":4.7,"privacy":4.6,"preferredFor":[],"minComplexity":0.2,"highComplexityBoost":0.5}}'::jsonb
 ),
 (
  'gpt-5.6-sol','openrouter','openai/gpt-5.6-sol','GPT-5.6 Sol',true,350,
  '{"text":true,"streaming":true,"json":true}'::jsonb,
  '{"contextWindow":1000000,"maxOutputTokens":65536}'::jsonb,
  '{"inputCostPerMillion":5.00,"outputCostPerMillion":30.00,"currency":"USD","source":"openrouter-catalog-2026-08-14"}'::jsonb,
  '{"tags":["frontier","heavy-reasoning","production","privacy"],"vendor":"openai","storesSecrets":false,"routing":{"quality":5.0,"speed":3.2,"reasoning":5.0,"costEfficiency":3.0,"reliability":4.9,"privacy":4.6,"preferredFor":["analysis:restricted","execution:restricted"],"minComplexity":0.78,"highComplexityBoost":1.6}}'::jsonb
 )
on conflict(id) do update set
 provider_id=excluded.provider_id,
 provider_model=excluded.provider_model,
 display_name=excluded.display_name,
 enabled=excluded.enabled,
 priority=excluded.priority,
 capabilities=excluded.capabilities,
 limits=excluded.limits,
 pricing=excluded.pricing,
 metadata=excluded.metadata,
 updated_at=now();

update public.orby_model_registry
set enabled=false,updated_at=now()
where provider_id='openrouter'
  and id not in ('gpt-5.6-luna','gpt-5.6-terra','claude-sonnet-5','gemini-3.6-flash','gpt-5.6-sol');

update public.orby_runtime_config
set config=coalesce(config,'{}'::jsonb)||jsonb_build_object(
  'enabled',true,
  'defaultModelId','gpt-5.6-terra',
  'allowedProviderIds',jsonb_build_array('openrouter'),
  'allowedModelIds',jsonb_build_array('gpt-5.6-luna','gpt-5.6-terra','claude-sonnet-5','gemini-3.6-flash','gpt-5.6-sol'),
  'modelSelectionMode','orby-intelligence-router-v1',
  'intelligentRouting',jsonb_build_object(
    'enabled',true,
    'allowModelSwitching',true,
    'sensitivityAware',true,
    'restrictedPrivacyFloor',4.3
  ),
  'maxAttempts',3
),revision=revision+1,updated_at=now()
where organization_id is null;

insert into public.orby_feature_flags(key,environment,enabled,rollout_percentage,configuration,updated_at)
values(
 'orby_intelligence_router_enabled',null,true,100,
 jsonb_build_object(
  'version','v1',
  'mode','provider-neutral-model-scoring',
  'transport','openrouter',
  'allowModelSwitching',true,
  'models',jsonb_build_array('gpt-5.6-luna','gpt-5.6-terra','claude-sonnet-5','gemini-3.6-flash','gpt-5.6-sol')
 ),now()
)
on conflict(key,scope_key) do update set
 enabled=excluded.enabled,
 rollout_percentage=excluded.rollout_percentage,
 configuration=excluded.configuration,
 updated_at=now();
