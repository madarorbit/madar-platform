import {supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';export const dynamic='force-dynamic';
const VERSION='beta-1.0.0';
const RELEASED_AT='2026-07-24';
export async function GET(){
 const started=Date.now();
 try{
  const settings=(await supabaseFetch('/rest/v1/platform_settings?id=eq.1&select=beta_registration_open,workspace_creation_enabled,store_enabled,orby_enabled,maintenance_mode,updated_at'))?.[0];
  if(!settings)return Response.json({status:'degraded',database:'unreachable',version:VERSION,released_at:RELEASED_AT,timestamp:new Date().toISOString()},{status:503,headers:{'Cache-Control':'no-store'}});
  return Response.json({status:settings.maintenance_mode?'maintenance':'ok',database:'connected',version:VERSION,released_at:RELEASED_AT,latency_ms:Date.now()-started,features:{registration:settings.beta_registration_open,workspaces:settings.workspace_creation_enabled,store:settings.store_enabled,orby:settings.orby_enabled},settings_updated_at:settings.updated_at,timestamp:new Date().toISOString()},{status:200,headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({status:'degraded',database:'error',version:VERSION,released_at:RELEASED_AT,timestamp:new Date().toISOString()},{status:503,headers:{'Cache-Control':'no-store'}})}
}
