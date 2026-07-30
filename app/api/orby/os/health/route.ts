import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
export const dynamic='force-dynamic';
type RuntimeFlag={key:string;enabled:boolean;rollout_percentage:number};
const state=(flags:RuntimeFlag[],key:string)=>flags.some(flag=>flag.key===key&&flag.enabled&&flag.rollout_percentage>0)?'active':'deferred';
export async function GET(){
 await requireSuperAdmin();
 const [dashboard,flagsRaw]=await Promise.all([
  supabaseFetch('/rest/v1/rpc/orby_os_admin_dashboard',{method:'POST',body:'{}'}),
  supabaseFetch('/rest/v1/orby_feature_flags?key=in.(orby_provider_execution_enabled,orby_ocr_enabled,orby_external_channels_enabled)&organization_id=is.null&workspace_id=is.null&user_id=is.null&select=key,enabled,rollout_percentage'),
 ]);
 const flags=flagsRaw as RuntimeFlag[];
 return Response.json({ok:true,system:'ORBY OS',version:'1.0.0',providerExecution:state(flags,'orby_provider_execution_enabled'),ocr:state(flags,'orby_ocr_enabled'),externalChannels:state(flags,'orby_external_channels_enabled'),dashboard},{headers:{'Cache-Control':'no-store'}});
}
