with suite as (select id from public.orby_evaluation_suites where key='orby-os-v1'),cases(case_key,name,category,dimensions,minimum_score) as (values
 ('tool-selection','اختيار الأداة الصحيحة','tools','["tool_selection","authorization"]'::jsonb,.8),
 ('provider-circuit','قاطع دائرة المزود','routing','["execution","security"]'::jsonb,.8),
 ('timeout-retry','المهلة وإعادة المحاولة','reliability','["execution","latency"]'::jsonb,.8),
 ('tenant-permissions','صلاحيات المؤسسات','security','["authorization","security"]'::jsonb,.95),
 ('proactive-quality','جودة الاستباقية','proactivity','["proactivity","accuracy"]'::jsonb,.8),
 ('long-running-resume','استئناف التدفق الطويل','workflow','["planning","execution"]'::jsonb,.8),
 ('release-rollback','الرجوع عن إصدار','release','["execution","security"]'::jsonb,.95)
)
insert into public.orby_evaluation_cases(suite_id,case_key,name,category,input,expected,dimensions,minimum_score,timeout_ms,tags,enabled)
select suite.id,c.case_key,c.name,c.category,'{}','{}',c.dimensions,c.minimum_score,15000,jsonb_build_array(c.category),true from suite cross join cases c
on conflict(suite_id,case_key) do update set name=excluded.name,category=excluded.category,dimensions=excluded.dimensions,minimum_score=excluded.minimum_score,enabled=true;
