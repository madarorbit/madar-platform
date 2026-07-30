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
 assert.match(provider,/require_parameters:true/);
 assert.match(provider,/data_collection:'deny'/);
 assert.match(provider,/reasoning:\{enabled:false,exclude:true\}/);
 assert.match(index,/ORBY_OPENROUTER_API_KEY/);
 assert.doesNotMatch(`${provider}\n${index}\n${env}`,/sk-or-v1-[A-Za-z0-9_-]{20,}/);
});

test('Mistral OCR processes PDF and images without persisting credentials',async()=>{
 const [ocr,env,server]=await Promise.all([read('src/lib/orby/intelligence/mistral-ocr.ts'),read('src/lib/env.ts'),read('src/lib/orby/intelligence/server.ts')]);
 assert.match(ocr,/mistral-ocr-2512/);
 assert.match(ocr,/\/ocr`/);
 assert.match(ocr,/type:kind/);
 assert.match(ocr,/data:\$\{input\.mimeType\};base64/);
 assert.match(ocr,/table_format:'markdown'/);
 assert.match(ocr,/extract_header:true/);
 assert.match(ocr,/extract_footer:true/);
 assert.match(env,/ORBY_MISTRAL_OCR_API_KEY/);
 assert.match(server,/new MistralOcrService/);
 assert.doesNotMatch(`${ocr}\n${env}\n${server}`,/apiKey:\s*['"][^'"]{16,}['"]/);
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

test('DeepSeek V3.2 becomes the only approved primary activation model',async()=>{
 const sql=await read('supabase/migrations/20260731102000_orby_primary_model_deepseek_v32.sql');
 assert.match(sql,/'deepseek-v3\.2','openrouter','deepseek\/deepseek-v3\.2'/);
 assert.match(sql,/target_model text default 'deepseek-v3\.2'/);
 assert.match(sql,/target_model<>'deepseek-v3\.2'/);
 assert.match(sql,/openrouter-deepseek-v3\.2-mistral-ocr3/);
 assert.match(sql,/reasoningDefaultEnabled',false/);
 assert.match(sql,/where provider_id='openrouter'/);
 assert.doesNotMatch(sql,/api_key\s+(text|jsonb)|provider_secret\s+(text|jsonb)/i);
});

test('admin activation probes both services before opening runtime gates',async()=>{
 const [actions,page]=await Promise.all([read('app/admin/orby-os/actions.ts'),read('app/admin/orby-os/models/page.tsx')]);
 assert.match(actions,/requireSuperAdmin/);
 assert.match(actions,/provider\.health\(\)/);
 assert.match(actions,/deepseek\/deepseek-v3\.2/);
 assert.match(actions,/ORBY_RUNTIME_OK/);
 assert.match(actions,/maxOutputTokens:64/);
 assert.match(actions,/reasoning:\{enabled:false,exclude:true\}/);
 assert.match(actions,/target_model:'deepseek-v3\.2'/);
 assert.match(actions,/MistralOcrService/);
 assert.match(actions,/ocrHealth\.ok/);
 assert.match(actions,/orby_os_activate_external_runtime/);
 assert.match(page,/فحص المفاتيح وتفعيل التشغيل/);
 assert.match(page,/DeepSeek V3\.2/);
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
 assert.match(actions,/openrouter-credit-required/);
 assert.match(page,/رصيد OpenRouter غير كافٍ/);
 assert.match(page,/خطة Mistral لا تسمح بطلب OCR/);
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
