-- Align ORBY router pricing metadata with the current OpenRouter catalog snapshot.
update public.orby_model_registry
set pricing='{"inputCostPerMillion":0.10,"outputCostPerMillion":0.60,"currency":"USD","source":"openrouter-catalog-2026-08-14-current"}'::jsonb,
    updated_at=now()
where id='gpt-5.6-luna';

update public.orby_model_registry
set pricing='{"inputCostPerMillion":1.00,"outputCostPerMillion":6.00,"currency":"USD","source":"openrouter-catalog-2026-08-14-current"}'::jsonb,
    updated_at=now()
where id='gpt-5.6-terra';
