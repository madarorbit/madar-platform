-- ORBY model priority is consistently descending across the core registry,
-- routing index and ORBY OS router. Larger numbers mean higher preference.

update public.orby_model_registry
set priority=case
 when id='gemini-2.5-flash-lite' then 400
 when id='gpt-4.1-nano' then 300
 when id='deepseek-v3.2' then 200
 when id='deepseek-v4-flash' then 100
 else priority
end,
updated_at=now()
where provider_id='openrouter'
 and id in ('gemini-2.5-flash-lite','gpt-4.1-nano','deepseek-v3.2','deepseek-v4-flash');
