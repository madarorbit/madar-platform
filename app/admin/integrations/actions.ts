'use server';

import {revalidatePath} from 'next/cache';
import {requireSuperAdmin} from '@/src/lib/auth';
import type {JsonObject} from '@/src/lib/integration/contracts';
import {IntegrationDatabase} from '@/src/lib/integration/platform';

function required(formData:FormData,key:string){const value=formData.get(key);if(typeof value!=='string'||!value.trim())throw new Error(`Missing ${key}`);return value.trim();}
async function rpc(name:string,body:JsonObject){await requireSuperAdmin();await new IntegrationDatabase().rpc(name,body);revalidatePath('/admin/integrations');revalidatePath('/admin/integrations/audit');}

export async function setIntegrationFlag(formData:FormData){await rpc('integration_admin_set_feature_flag',{flag_key:required(formData,'flag_key'),flag_enabled:required(formData,'flag_enabled')==='true',target_organization:null});}
export async function setConnectionState(formData:FormData){await rpc('integration_admin_set_connection_state',{target_connection:required(formData,'connection_id'),target_status:required(formData,'status')});}
export async function enqueueConnectionSync(formData:FormData){await rpc('integration_admin_enqueue_sync',{target_connection:required(formData,'connection_id'),sync_mode:required(formData,'sync_mode')});}
export async function backfillRawBatches(formData:FormData){const limit=Math.max(1,Math.min(1000,Number(formData.get('limit')||100)));await rpc('integration_admin_backfill_raw_batches',{batch_limit:limit});}
export async function resolveQualityIssue(formData:FormData){await rpc('integration_admin_resolve_quality_issue',{target_issue:required(formData,'issue_id'),target_status:required(formData,'status'),resolution:typeof formData.get('resolution')==='string'?String(formData.get('resolution')).trim()||null:null});}
