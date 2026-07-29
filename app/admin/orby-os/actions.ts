'use server';

import {revalidatePath} from 'next/cache';
import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';

const text=(form:FormData,key:string)=>String(form.get(key)||'').trim();
export async function setOrbyFlag(form:FormData){await requireSuperAdmin();const key=text(form,'key'),enabled=text(form,'enabled')==='true',rollout=Math.max(0,Math.min(100,Number(text(form,'rollout')||100)));if(!key)throw new Error('ORBY_FLAG_KEY_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_set_feature_flag',{method:'POST',body:JSON.stringify({target_key:key,target_enabled:enabled,target_rollout:rollout,target_configuration:{}})});revalidatePath('/admin/orby-os');}
export async function setPluginState(form:FormData){await requireSuperAdmin();const plugin=text(form,'plugin_id'),status=text(form,'status');if(!plugin||!status)throw new Error('ORBY_PLUGIN_STATE_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_set_plugin_state',{method:'POST',body:JSON.stringify({target_plugin:plugin,target_status:status})});revalidatePath('/admin/orby-os');}
export async function setPolicyState(form:FormData){await requireSuperAdmin();const policy=text(form,'policy_id'),enabled=text(form,'enabled')==='true';if(!policy)throw new Error('ORBY_POLICY_REQUIRED');await supabaseFetch('/rest/v1/rpc/orby_os_set_policy_state',{method:'POST',body:JSON.stringify({target_policy:policy,target_enabled:enabled})});revalidatePath('/admin/orby-os');}
export async function createOrbyBackup(){await requireSuperAdmin();await supabaseFetch('/rest/v1/rpc/orby_os_create_backup',{method:'POST',body:JSON.stringify({target_organization:null,target_type:'full_control_plane'})});revalidatePath('/admin/orby-os');}
