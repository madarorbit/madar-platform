import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
export const dynamic='force-dynamic';
export async function GET(){await requireSuperAdmin();const dashboard=await supabaseFetch('/rest/v1/rpc/orby_os_admin_dashboard',{method:'POST',body:'{}'});return Response.json({ok:true,system:'ORBY OS',version:'1.0.0',providerExecution:'deferred',ocr:'deferred',externalChannels:'deferred',dashboard},{headers:{'Cache-Control':'no-store'}});}
