import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);const read=path=>readFile(new URL(path,root),'utf8');

test('OpenRouter is isolated behind server-only environment configuration',async()=>{
 const [provider,index,env]=await Promise.all([read('src/lib/orby/providers/openrouter.ts'),read('src/lib/orby/providers/index.ts'),read('src/lib/env.ts')]);
 assert.match(provider,/https:\/\/openrouter\.ai\/api\/v1/);
 assert.match(provider,/X-OpenRouter-Title/);
 assert.match(provider,/X-OpenRouter-Metadata/);
 assert.match(provider,/allow_fallbacks:true/);
 assert.match(provider,/data_collection:'deny'/);
 assert.doesNotMatch(provider,/require_parameters:true/);
 assert.doesNotMatch(provider,/requestDefaults:\{\s*reasoning:/);
 assert.match(index,/ORBY_OPENROUTER_API_KEY/);
 assert.doesNotMatch(`${provider}\n${index}\n${env}`,/sk-or-v1-[A-Za-z0-9_-]{20,}/);
});

test('OpenRouter activation validates key type and auto-selects a working low-cost model',async()=>{
 const selector=await read('src/lib/orby/providers/openrouter-runtime.ts');
 assert.match(selector,/\/key`/);
 assert.match(selector,/is_management_key/);
 assert.match(selector,/ORBY_OPENROUTER_MANAGEMENT_KEY/);
 assert.match(selector,/limit_remaining/);
 assert.match(selector,/\/models`/);
 assert.match(selector,/google\/gemini-2\.5-flash-lite/);
 assert.match(selector,/openai\/gpt-4\.1-nano/);
 assert.match(selector,/deepseek\/deepseek-v3\.2/);
 assert.match(selector,/ORBY_RUNTIME_OK/);
 assert.match(selector,/data_collection:'deny'/);
 assert.match(selector,/routedAttempts\.every\(item=>item\.status===503\)/);
 assert.match(selector,/ORBY_OPENROUTER_NO_ELIGIBLE_PROVIDER/);
 assert.match(selector,/ORBY_OPENROUTER_NO_WORKING_MODEL/);
 assert.doesNotMatch(selector,/sk-or-v1-[A-Za-z0-9_-]{20,}/);
});

test('Mistral OCR processes documents and includes a real credential-free probe image',async()=>{
 const [ocr,env,server,probe]=await Promise.all([read('src/lib/orby/intelligence/mistral-ocr.ts'),read('src/lib/env.ts'),read('src/lib/orby/intelligence/server.ts'),read('src/lib/orby/intelligence/ocr-probe.ts')]);
 assert.match(ocr,/mistral-ocr-2512/);
 assert.match(ocr,/\/ocr`/);
 assert.match(ocr,/type:kind/);
 assert.match(ocr,/data:\$\{input\.mimeType\};base64/);
 assert.match(ocr,/table_format:'markdown'/);
 assert.match(ocr,/extract_header:true/);
 assert.match(ocr,/extract_footer:true/);
 assert.match(probe,/orbyOcrProbeInput/);
 assert.match(probe,/Buffer\.from\(PROBE_PNG_BASE64,'base64'\)/);
 assert.match(probe,/image\/png/);
 assert.match(env,/ORBY_MISTRAL_OCR_API_KEY/);
 assert.match(server,/new MistralOcrService/);
 assert.doesNotMatch(`${ocr}\n${env}\n${server}\n${probe}`,/apiKey:\s*['"][^'"]{16,}['"]/);
});

test('database catalog starts disabled and activation is founder guarded',async()=>{
 const sql=await read('supabase/migrations/20260729224500_orby_external_runtime_openrouter_mistral_ocr.sql');
 assert.match(sql,/'openrouter','OpenRouter',false/);
 assert.match(sql,/'deepseek-v4-flash'.+false/s);
 assert.match(sql,/orby_os_activate_external_runtime/);
 assert.match(sql,/private\.is_admin\(\)/);
 assert.match(sql,/ORBY_PROVIDER_NOT_APPROVED/);
 assert.match(sql,/ORBY_MODEL_NOT_APPROVED/);
 assert.match(sql,/orby_provider_execution_enabled'.+true,100/s);
 assert.match(sql,/orby_ocr_enabled'.+true,100/s);
 assert.match(sql,/credentialsStoredOutsideDatabase/);
 assert.match(sql,/orby_os_deactivate_external_runtime/);
 assert.doesNotMatch(sql,/api_key\s+(text|jsonb)|provider_secret\s+(text|jsonb)/i);
});

test('automatic selection migration registers only vetted activation candidates',async()=>{
 const sql=await read('supabase/migrations/20260731113000_orby_external_runtime_auto_selection.sql');
 assert.match(sql,/'gemini-2\.5-flash-lite','openrouter','google\/gemini-2\.5-flash-lite'/);
 assert.match(sql,/'gpt-4\.1-nano','openrouter','openai\/gpt-4\.1-nano'/);
 assert.match(sql,/target_model not in \('gemini-2\.5-flash-lite','gpt-4\.1-nano','deepseek-v3\.2'\)/);
 assert.match(sql,/modelSelectionMode','governed-auto-probe'/);
 assert.match(sql,/candidateModels/);
 assert.match(sql,/externalChannelsActive',false/);
 assert.match(sql,/private\.is_admin\(\)/);
 assert.doesNotMatch(sql,/api_key\s+(text|jsonb)|provider_secret\s+(text|jsonb)/i);
});

test('admin activation runs live model and OCR probes before opening runtime gates',async()=>{
 const [actions,page]=await Promise.all([read('app/admin/orby-os/actions.ts'),read('app/admin/orby-os/models/page.tsx')]);
 assert.match(actions,/requireSuperAdmin/);
 assert.match(actions,/selectOpenRouterRuntime/);
 assert.match(actions,/ORBY_OPENROUTER_API_KEY/);
 assert.match(actions,/selection\.id/);
 assert.match(actions,/MistralOcrService/);
 assert.match(actions,/ocrHealth\.ok/);
 assert.match(actions,/orbyOcrProbeInput/);
 assert.match(actions,/ocrService\.extract/);
 assert.match(actions,/ORBY_MISTRAL_OCR_PROBE_FAILED/);
 assert.match(actions,/orby_os_activate_external_runtime/);
 assert.match(actions,/activation=success&model=/);
 assert.match(page,/فحص شامل واختيار النموذج والتفعيل/);
 assert.match(page,/Gemini 2\.5 Flash Lite/);
 assert.match(page,/GPT-4\.1 Nano/);
 assert.match(page,/DeepSeek V3\.2/);
 assert.match(page,/صورة OCR تجريبية فعلية/);
 assert.match(page,/المفاتيح تبقى داخل متغيرات Vercel المشفرة/);
});

test('provider activation failures are safe, explicit and never render a generic error page',async()=>{
 const [common,ocr,actions,page]=await Promise.all([read('src/lib/orby/providers/common.ts'),read('src/lib/orby/intelligence/mistral-ocr.ts'),read('app/admin/orby-os/actions.ts'),read('app/admin/orby-os/models/page.tsx')]);
 assert.match(common,/status===402/);
 assert.match(common,/رصيد مزود أوربي غير كافٍ/);
 assert.match(common,/await response\.text\(\)/);
 assert.match(common,/body===null/);
 assert.match(ocr,/MISTRAL_PAYMENT_REQUIRED/);
 assert.match(ocr,/MISTRAL_EMPTY_RESPONSE/);
 assert.match(ocr,/safePayload/);
 assert.match(actions,/externalRuntimeFailureCode/);
 assert.match(actions,/activation=error&code=/);
 assert.match(actions,/openrouter-management-key/);
 assert.match(actions,/openrouter-guardrail-blocked/);
 assert.match(actions,/mistral-probe-failed/);
 assert.match(page,/المفتاح من نوع Management Key/);
 assert.match(page,/قيود OpenRouter تمنع النماذج/);
 assert.match(page,/خطة Mistral لا تسمح بطلب OCR/);
 assert.match(page,/اختبار OCR الفعلي لم ينجح/);
 assert.match(page,/role="status"/);
});

test('OpenAI-compatible adapter handles reasoning controls and embedded OpenRouter errors',async()=>{
 const [contracts,adapter]=await Promise.all([read('src/lib/orby/core/contracts.ts'),read('src/lib/orby/providers/openai.ts')]);
 assert.match(contracts,/OrbyReasoningEffort/);
 assert.match(contracts,/reasoning\?:OrbyReasoningOptions/);
 assert.match(adapter,/payload\.reasoning=reasoning/);
 assert.match(adapter,/embeddedProviderError/);
 assert.match(adapter,/reasoningOnly/);
 assert.match(adapter,/responseText/);
});
