import type {
 OrbyConfigurationScope,OrbyConfigurationStore,OrbyMessage,OrbyModelDescriptor,OrbyProviderHealth,OrbyRuntimeConfiguration,OrbySession,OrbySessionStore,
} from '../core/contracts';
import {OrbyError} from '../core/errors';
import {supabaseFetch} from '../../supabase/server';
import {IntegrationDatabase} from '../../integration/platform';
import type {JsonObject} from '../../integration/contracts';

type RuntimeConfigRow={id:string;organization_id:string|null;config:Partial<OrbyRuntimeConfiguration>;revision:number};
type SessionRow={id:string;organization_id:string;user_id:string;workspace_id:string|null;status:OrbySession['status'];metadata:OrbySession['metadata'];expires_at:string|null;created_at:string;updated_at:string};
type MessageRow={id:string;role:OrbyMessage['role'];content:string;metadata:OrbyMessage['metadata'];created_at:string};
type ModelRow={id:string;provider_id:string;provider_model:string;display_name:string;enabled:boolean;priority:number;capabilities:OrbyModelDescriptor['capabilities'];limits:{contextWindow?:number;maxOutputTokens?:number};pricing:{inputCostPerMillion?:number;outputCostPerMillion?:number;currency?:string};metadata:OrbyModelDescriptor['metadata']&{tags?:string[]}};

function session(row:SessionRow):OrbySession{return {id:row.id,organizationId:row.organization_id,userId:row.user_id,workspaceId:row.workspace_id||undefined,status:row.status,metadata:row.metadata,expiresAt:row.expires_at||undefined,createdAt:row.created_at,updatedAt:row.updated_at};}
function message(row:MessageRow):OrbyMessage{return {id:row.id,role:row.role,content:row.content,metadata:row.metadata,createdAt:row.created_at};}
function scopeQuery(scope:OrbyConfigurationScope){return scope.organizationId?`organization_id=eq.${encodeURIComponent(scope.organizationId)}`:'organization_id=is.null';}

export class SupabaseOrbyConfigurationStore implements OrbyConfigurationStore {
 constructor(private readonly database?:IntegrationDatabase){}
 private async row(scope:OrbyConfigurationScope){
  if(this.database){const query=new URLSearchParams({select:'id,organization_id,config,revision',limit:'1'});query.set('organization_id',scope.organizationId?`eq.${scope.organizationId}`:'is.null');return(await this.database.select<RuntimeConfigRow>('orby_runtime_config',query))[0];}
  const rows=await supabaseFetch(`/rest/v1/orby_runtime_config?${scopeQuery(scope)}&select=id,organization_id,config,revision&limit=1`) as RuntimeConfigRow[];return rows[0];
 }
 async get(scope:OrbyConfigurationScope){
  if(this.database)return(await this.row(scope))?.config||null;
  if(!scope.organizationId)return null;
  return await supabaseFetch('/rest/v1/rpc/orby_resolve_runtime_config',{method:'POST',body:JSON.stringify({target_organization:scope.organizationId})}) as Partial<OrbyRuntimeConfiguration>|null;
 }
 async set(scope:OrbyConfigurationScope,value:Partial<OrbyRuntimeConfiguration>){const row=await this.row(scope),payload={config:value,revision:(row?.revision||0)+1,updated_at:new Date().toISOString()} as unknown as JsonObject;if(row){if(this.database)await this.database.update('orby_runtime_config',`id=eq.${encodeURIComponent(row.id)}`,payload);else await supabaseFetch(`/rest/v1/orby_runtime_config?id=eq.${encodeURIComponent(row.id)}`,{method:'PATCH',body:JSON.stringify(payload)});return;}const created={organization_id:scope.organizationId||null,config:value} as unknown as JsonObject;if(this.database)await this.database.insert('orby_runtime_config',created);else await supabaseFetch('/rest/v1/orby_runtime_config',{method:'POST',body:JSON.stringify(created)});}
}

export class SupabaseOrbySessionStore implements OrbySessionStore {
 constructor(private readonly database?:IntegrationDatabase){}
 async create(value:OrbySession){const payload={id:value.id,organization_id:value.organizationId,user_id:value.userId,workspace_id:value.workspaceId||null,status:value.status,metadata:value.metadata||{},expires_at:value.expiresAt||null,created_at:value.createdAt,updated_at:value.updatedAt} as unknown as JsonObject,rows=this.database?await this.database.insert<SessionRow>('orby_sessions',payload):await supabaseFetch('/rest/v1/orby_sessions',{method:'POST',body:JSON.stringify(payload)}) as SessionRow[];if(!rows[0])throw new OrbyError('تعذر إنشاء جلسة أوربي.','INTERNAL_ERROR');return session(rows[0]);}
 async get(sessionId:string){const rows=this.database?await this.database.select<SessionRow>('orby_sessions',new URLSearchParams({id:`eq.${sessionId}`,select:'id,organization_id,user_id,workspace_id,status,metadata,expires_at,created_at,updated_at',limit:'1'})):await supabaseFetch(`/rest/v1/orby_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,organization_id,user_id,workspace_id,status,metadata,expires_at,created_at,updated_at&limit=1`) as SessionRow[];return rows[0]?session(rows[0]):null;}
 async save(value:OrbySession){const payload={status:value.status,metadata:value.metadata||{},expires_at:value.expiresAt||null,updated_at:value.updatedAt} as unknown as JsonObject,rows=this.database?await this.database.update<SessionRow>('orby_sessions',`id=eq.${encodeURIComponent(value.id)}`,payload):await supabaseFetch(`/rest/v1/orby_sessions?id=eq.${encodeURIComponent(value.id)}`,{method:'PATCH',body:JSON.stringify(payload)}) as SessionRow[];if(!rows[0])throw new OrbyError('جلسة أوربي غير موجودة.','SESSION_NOT_FOUND');return session(rows[0]);}
 async listMessages(sessionId:string,limit:number){const safeLimit=Math.min(100,Math.max(1,limit)),rows=this.database?await this.database.select<MessageRow>('orby_session_messages',new URLSearchParams({session_id:`eq.${sessionId}`,select:'id,role,content,metadata,created_at',order:'created_at.desc,id.desc',limit:String(safeLimit)})):await supabaseFetch(`/rest/v1/orby_session_messages?session_id=eq.${encodeURIComponent(sessionId)}&select=id,role,content,metadata,created_at&order=created_at.desc,id.desc&limit=${safeLimit}`) as MessageRow[];return rows.reverse().map(message);}
 async appendMessages(sessionId:string,messages:readonly OrbyMessage[]){if(!messages.length)return;const payload=messages.map(item=>({id:item.id,session_id:sessionId,role:item.role,content:item.content,metadata:item.metadata||{},created_at:item.createdAt})) as unknown as JsonObject[];if(this.database)await this.database.insert('orby_session_messages',payload);else await supabaseFetch('/rest/v1/orby_session_messages',{method:'POST',body:JSON.stringify(payload)});}
}

export async function loadSupabaseOrbyModels(database?:IntegrationDatabase){const rows=database?await database.select<ModelRow>('orby_model_registry',new URLSearchParams({select:'id,provider_id,provider_model,display_name,enabled,priority,capabilities,limits,pricing,metadata',order:'priority.desc,id.asc'})):await supabaseFetch('/rest/v1/orby_model_registry?select=id,provider_id,provider_model,display_name,enabled,priority,capabilities,limits,pricing,metadata&order=priority.desc,id.asc') as ModelRow[];return rows.map((row):OrbyModelDescriptor=>({id:row.id,providerId:row.provider_id,providerModel:row.provider_model,displayName:row.display_name,enabled:row.enabled,priority:row.priority,capabilities:row.capabilities||{},contextWindow:row.limits?.contextWindow,maxOutputTokens:row.limits?.maxOutputTokens,inputCostPerMillion:row.pricing?.inputCostPerMillion,outputCostPerMillion:row.pricing?.outputCostPerMillion,currency:row.pricing?.currency,tags:row.metadata?.tags,metadata:row.metadata||{}}));}

export async function upsertSupabaseOrbyModel(model:OrbyModelDescriptor){const payload={id:model.id,provider_id:model.providerId,provider_model:model.providerModel,display_name:model.displayName,enabled:model.enabled,priority:model.priority,capabilities:model.capabilities,limits:{contextWindow:model.contextWindow,maxOutputTokens:model.maxOutputTokens},pricing:{inputCostPerMillion:model.inputCostPerMillion,outputCostPerMillion:model.outputCostPerMillion,currency:model.currency},metadata:{...(model.metadata||{}),tags:model.tags||[]},updated_at:new Date().toISOString()};await supabaseFetch('/rest/v1/orby_model_registry?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});}
export async function recordSupabaseOrbyProviderHealth(health:OrbyProviderHealth){await supabaseFetch('/rest/v1/orby_provider_health?on_conflict=provider_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({provider_id:health.providerId,ok:health.ok,latency_ms:health.latencyMs,message:health.message||null,checked_at:health.checkedAt})});}
