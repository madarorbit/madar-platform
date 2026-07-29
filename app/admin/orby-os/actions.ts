'use server';

import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireSuperAdmin} from '@/src/lib/auth';
import {orbyOcrConfig} from '@/src/lib/env';
import {supabaseFetch} from '@/src/lib/supabase/server';
import type {OrbyJsonObject} from '@/src/lib/orby/core/contracts';
import {recordSupabaseOrbyProviderHealth} from '@/src/lib/orby/adapters/supabase';
import {providersFromEnvironment} from '@/src/lib/orby/providers';
import {MistralOcrService} from '@/src/lib/orby/intelligence/mistral-ocr';
import type {OrbyWorkflowNode} from '@/src/lib/orby/execution/contracts';
import {validateWorkflow} from '@/src/lib/orby/os/workflow';
import {runOrbyOsProductionBenchmark} from '@/src/lib/orby/os/benchmark-runner';

const text=(form:FormData,key:string)=>String(form.get(key)||'').trim();
const json=(form:FormData,key:string,fallback:unknown)=>{const value=text(form,key);if(!value)return fallback;try{return JSON.parse(value);}catch{throw new Error(`ORBY_INVALID_JSON:${key}`);}};
const refresh=()=>{for(const path of ['/admin/orby-os','/admin/orby-os/workflows','/admin/orby-os/prompts','/admin/orby-os/models','/admin/orby-os/evaluations','/admin/orby-os/observability','/admin/orby-os/data','/admin/orby-os/releases'])revalidatePath(path);};

export async function setOrbyFlag(form:FormData){await requireSuperAdmin();const key=text(form,'key'),enabled=text(form,'enabled')==='true',rollout=Math.max(0,Math.min(100,Number(text(form,'rollout')||100)));if(!key)throw new Error('ORBY_FLAG_KEY_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_set_feature_flag',{method:'POST',body:JSON.stringify({target_key:key,target_enabled:enabled,target_rollout:rollout,target_configuration:{}})});refresh();}
export async function setPluginState(form:FormData){await requireSuperAdmin();const plugin=text(form,'plugin_id'),status=text(form,'status');if(!plugin||!status)throw new Error('ORBY_PLUGIN_STATE_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_set_plugin_state',{method:'POST',body:JSON.stringify({target_plugin:plugin,target_status:status})});refresh();}
export async function setPolicyState(form:FormData){await requireSuperAdmin();const policy=text(form,'policy_id'),enabled=text(form,'enabled')==='true';if(!policy)throw new Error('ORBY_POLICY_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_set_policy_state',{method:'POST',body:JSON.stringify({target_policy:policy,target_enabled:enabled})});refresh();}
export async function createOrbyBackup(){await requireSuperAdmin();await supabaseFetch('/rest/v1/rpc/orby_os_create_backup',{method:'POST',body:JSON.stringify({target_organization:null,target_type:'full_control_plane'})});refresh();}
export async function restoreOrbyBackup(form:FormData){await requireSuperAdmin();const backup=text(form,'backup_id'),confirmed=text(form,'confirmed')==='true';if(!backup||!confirmed)throw new Error('ORBY_BACKUP_CONFIRMATION_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_restore_backup',{method:'POST',body:JSON.stringify({target_backup:backup,dry_run:false})});refresh();}

export async function publishWorkflowVersion(form:FormData){
 const profile=await requireSuperAdmin(),key=text(form,'key'),name=text(form,'name'),description=text(form,'description'),domain=text(form,'domain'),status=text(form,'status')||'testing';
 const root=json(form,'definition',null) as OrbyWorkflowNode|null,inputSchema=json(form,'input_schema',{}) as OrbyJsonObject,outputSchema=json(form,'output_schema',{}) as OrbyJsonObject,permissions=json(form,'permissions',[]) as string[],tags=json(form,'tags',[]) as string[];
 if(!root)throw new Error('ORBY_WORKFLOW_DEFINITION_REQUIRED');
 const now=new Date().toISOString(),validation=validateWorkflow({id:'builder-validation',key,name,description,domain,version:1,status:'testing',root,inputSchema,outputSchema,requiredPermissions:permissions,maxDurationSeconds:3600,tags,createdAt:now,updatedAt:now,metadata:{validatedBy:profile.id}});
 if(!validation.valid)throw new Error(`ORBY_WORKFLOW_INVALID:${validation.issues.join('|')}`);
 await supabaseFetch('/rest/v1/rpc/orby_os_publish_workflow_version',{method:'POST',body:JSON.stringify({target_key:key,target_name:name,target_description:description,target_domain:domain,target_definition:root,target_input_schema:inputSchema,target_output_schema:outputSchema,target_permissions:permissions,target_tags:tags,target_status:status})});refresh();
}
export async function publishPromptVersion(form:FormData){await requireSuperAdmin();const key=text(form,'key'),domain=text(form,'domain')||'core',content=text(form,'content'),status=text(form,'status')||'testing';if(!key||!content)throw new Error('ORBY_PROMPT_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_publish_prompt_version',{method:'POST',body:JSON.stringify({target_key:key,target_domain:domain,target_content:content,target_status:status,target_organization:null})});refresh();}
export async function runOrbyOsBenchmark(){await requireSuperAdmin();await runOrbyOsProductionBenchmark();refresh();}
export async function promoteOrbyRelease(form:FormData){await requireSuperAdmin();const release=text(form,'release_id'),rollout=Math.max(1,Math.min(100,Number(text(form,'rollout')||100)));if(!release)throw new Error('ORBY_RELEASE_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_promote_release',{method:'POST',body:JSON.stringify({target_release:release,target_rollout:rollout})});refresh();}
export async function rollbackOrbyRelease(form:FormData){await requireSuperAdmin();const release=text(form,'release_id'),confirmed=text(form,'confirmed')==='true';if(!release||!confirmed)throw new Error('ORBY_RELEASE_ROLLBACK_CONFIRMATION_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_rollback_release',{method:'POST',body:JSON.stringify({target_release:release})});refresh();}

export async function activateOrbyExternalRuntime(){
 await requireSuperAdmin();
 const provider=providersFromEnvironment().find(item=>item.id==='openrouter');
 if(!provider)throw new Error('ORBY_OPENROUTER_API_KEY_MISSING');
 const health=await provider.health();
 await recordSupabaseOrbyProviderHealth(health);
 if(!health.ok)throw new Error(`ORBY_OPENROUTER_HEALTH_FAILED:${health.message||'unknown'}`);
 const probe=await provider.generate({
  requestId:randomUUID(),
  model:'deepseek/deepseek-v4-flash',
  messages:[{role:'user',content:'Return exactly: ORBY_RUNTIME_OK'}],
  options:{temperature:0,maxOutputTokens:24,responseFormat:'text',timeoutMs:30_000},
 });
 if(!probe.text.includes('ORBY_RUNTIME_OK'))throw new Error('ORBY_OPENROUTER_MODEL_PROBE_FAILED');
 const ocr=orbyOcrConfig();
 if(!ocr||ocr.provider!=='mistral')throw new Error('ORBY_MISTRAL_OCR_API_KEY_MISSING');
 const ocrHealth=await new MistralOcrService({apiKey:ocr.apiKey,model:ocr.model,baseUrl:ocr.baseUrl,timeoutMs:ocr.timeoutMs,maxBytes:ocr.maxBytes}).health();
 if(!ocrHealth.ok)throw new Error(`ORBY_MISTRAL_OCR_HEALTH_FAILED:${ocrHealth.message||'unknown'}`);
 await supabaseFetch('/rest/v1/rpc/orby_os_activate_external_runtime',{
  method:'POST',
  body:JSON.stringify({target_provider:'openrouter',target_model:'deepseek-v4-flash',target_ocr_model:ocr.model}),
 });
 refresh();
}

export async function deactivateOrbyExternalRuntime(){
 await requireSuperAdmin();
 await supabaseFetch('/rest/v1/rpc/orby_os_deactivate_external_runtime',{method:'POST',body:'{}'});
 refresh();
}
