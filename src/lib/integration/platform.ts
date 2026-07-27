import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {integrationDatabaseConfig,integrationSecretsConfig} from '@/src/lib/env';
import type {ConnectorCheckpoint,EncryptedSecret,JsonObject,JsonValue,StoredIntegrationJob} from './contracts';
import {IntegrationError} from './errors';

export class IntegrationDatabase {
 private readonly url:string;
 private readonly key:string;
 constructor(config=integrationDatabaseConfig()){this.url=config.url;this.key=config.serviceRoleKey;}
 private async request<T>(path:string,init:RequestInit={}){
  const headers=new Headers(init.headers);headers.set('apikey',this.key);headers.set('Authorization',`Bearer ${this.key}`);headers.set('Content-Type','application/json');headers.set('Prefer',headers.get('Prefer')||'return=representation');
  const response=await fetch(`${this.url}${path}`,{...init,headers,cache:'no-store'});
  if(!response.ok){const payload=await response.json().catch(()=>null) as {code?:string;message?:string;details?:string}|null;throw new IntegrationError('تعذر تنفيذ عملية قاعدة بيانات محرك الربط.','DATABASE_ERROR',response.status>=500||response.status===429,{status:response.status,code:payload?.code||null,path:path.split('?')[0]},payload);}
  if(response.status===204)return undefined as T;
  return response.json() as Promise<T>;
 }
 select<T>(table:string,params:URLSearchParams){return this.request<T[]>(`/rest/v1/${table}?${params.toString()}`);}
 insert<T>(table:string,value:JsonObject|JsonObject[],prefer='return=representation'){return this.request<T[]>(`/rest/v1/${table}`,{method:'POST',headers:{Prefer:prefer},body:JSON.stringify(value)});}
 update<T>(table:string,filter:string,value:JsonObject,prefer='return=representation'){return this.request<T[]>(`/rest/v1/${table}?${filter}`,{method:'PATCH',headers:{Prefer:prefer},body:JSON.stringify(value)});}
 upsert<T>(table:string,value:JsonObject,onConflict:string,prefer='resolution=merge-duplicates,return=representation'){return this.request<T[]>(`/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,{method:'POST',headers:{Prefer:prefer},body:JSON.stringify(value)});}
 rpc<T>(functionName:string,args:JsonObject={}){return this.request<T>(`/rest/v1/rpc/${functionName}`,{method:'POST',body:JSON.stringify(args)});}
}

function parseMasterKey(value:string){
 const raw=value.startsWith('hex:')?Buffer.from(value.slice(4),'hex'):Buffer.from(value.startsWith('base64:')?value.slice(7):value,'base64');
 if(raw.length!==32)throw new IntegrationError('مفتاح تشفير أسرار الربط يجب أن يكون 32 بايت بصيغة Base64 أو Hex.','CONFIGURATION_ERROR',false);
 return raw;
}

export class SecretsManager {
 private readonly key:Buffer;
 private readonly keyVersion:number;
 constructor(config=integrationSecretsConfig()){this.key=parseMasterKey(config.masterKey);this.keyVersion=config.keyVersion;}
 encrypt(secret:JsonObject):EncryptedSecret{
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,iv);cipher.setAAD(Buffer.from(`madar-integration:v${this.keyVersion}`));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(secret),'utf8'),cipher.final()]);
  return {ciphertext:ciphertext.toString('base64'),iv:iv.toString('base64'),authTag:cipher.getAuthTag().toString('base64'),keyVersion:this.keyVersion,algorithm:'aes-256-gcm'};
 }
 decrypt(record:EncryptedSecret){
  if(record.algorithm!=='aes-256-gcm')throw new IntegrationError('خوارزمية تشفير سر الاتصال غير مدعومة.','CONFIGURATION_ERROR',false);
  const decipher=createDecipheriv('aes-256-gcm',this.key,Buffer.from(record.iv,'base64'));decipher.setAAD(Buffer.from(`madar-integration:v${record.keyVersion}`));decipher.setAuthTag(Buffer.from(record.authTag,'base64'));
  try{return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]).toString('utf8')) as JsonObject;}catch(error){throw new IntegrationError('تعذر فك تشفير بيانات اتصال النظام الخارجي.','AUTHENTICATION_FAILED',false,{keyVersion:record.keyVersion},error);}
 }
}

export type IntegrationFeatureFlag='integration_engine_enabled'|'integration_worker_enabled'|'integration_scheduler_enabled'|'integration_write_enabled'|'integration_pipeline_enabled'|'integration_quality_center_enabled'|'integration_readiness_lab_enabled';
const DEFAULT_FLAGS:Record<IntegrationFeatureFlag,boolean>={integration_engine_enabled:false,integration_worker_enabled:false,integration_scheduler_enabled:false,integration_write_enabled:false,integration_pipeline_enabled:false,integration_quality_center_enabled:false,integration_readiness_lab_enabled:false};
type FeatureFlagRow={key:IntegrationFeatureFlag;enabled:boolean;config:JsonObject};

export class FeatureFlagService {
 constructor(private readonly database:IntegrationDatabase){}
 private async row(key:IntegrationFeatureFlag,organizationId:string|null){
  const params=new URLSearchParams({select:'key,enabled,config',key:`eq.${key}`,limit:'1'});params.set('organization_id',organizationId?`eq.${organizationId}`:'is.null');
  return (await this.database.select<FeatureFlagRow>('integration_feature_flags',params))[0];
 }
 async resolve(key:IntegrationFeatureFlag,organizationId?:string){const scoped=organizationId?await this.row(key,organizationId):undefined,global=scoped||await this.row(key,null);return {enabled:global?.enabled??DEFAULT_FLAGS[key],config:global?.config||{}};}
 async require(key:IntegrationFeatureFlag,organizationId?:string){const result=await this.resolve(key,organizationId);if(!result.enabled)throw new IntegrationError('هذه الوظيفة من محرك الربط غير مفعلة حاليًا.','FEATURE_DISABLED',false,{feature:key});return result;}
}

type EnqueueInput={organizationId:string;connectionId?:string;jobType:StoredIntegrationJob['job_type'];payload?:JsonObject;priority?:number;availableAt?:string;maxAttempts?:number;idempotencyKey?:string;createdBy?:string};
export class IntegrationQueue {
 constructor(private readonly database:IntegrationDatabase){}
 async enqueue(input:EnqueueInput){return this.database.rpc<StoredIntegrationJob>('integration_enqueue_job',{target_organization:input.organizationId,target_connection:input.connectionId||null,job_type:input.jobType,job_payload:input.payload||{},job_priority:input.priority??100,job_available_at:input.availableAt||new Date().toISOString(),job_max_attempts:input.maxAttempts??8,job_idempotency_key:input.idempotencyKey||null,job_created_by:input.createdBy||null});}
 async claim(workerId:string,limit=5,leaseSeconds=120){return this.database.rpc<StoredIntegrationJob[]>('integration_claim_jobs',{worker_id:workerId,claim_limit:Math.min(20,Math.max(1,limit)),lease_seconds:Math.min(900,Math.max(30,leaseSeconds))});}
 async heartbeat(jobId:string,workerId:string,leaseSeconds=120){return this.database.rpc<boolean>('integration_heartbeat_job',{target_job:jobId,worker_id:workerId,lease_seconds:leaseSeconds});}
 async complete(jobId:string,workerId:string,result:JsonObject={}){return this.database.rpc<boolean>('integration_complete_job',{target_job:jobId,worker_id:workerId,job_result:result});}
 async fail(jobId:string,workerId:string,errorCode:string,errorMessage:string,nextAttemptAt:string|null){return this.database.rpc<boolean>('integration_fail_job',{target_job:jobId,worker_id:workerId,error_code:errorCode,error_message:errorMessage,next_attempt_at:nextAttemptAt});}
 async enqueueDueSchedules(limit=50){return this.database.rpc<number>('integration_enqueue_due_schedules',{schedule_limit:Math.min(200,Math.max(1,limit))});}
}

type CheckpointRow={stream_key:string;cursor:JsonValue|null;watermark:string|null;version:number};
export class CheckpointStore {
 constructor(private readonly database:IntegrationDatabase){}
 async list(connectionId:string){const params=new URLSearchParams({select:'stream_key,cursor,watermark,version',connection_id:`eq.${connectionId}`});const rows=await this.database.select<CheckpointRow>('integration_sync_checkpoints',params);return Object.fromEntries(rows.map(row=>[row.stream_key,{streamKey:row.stream_key,cursor:row.cursor,watermark:row.watermark,version:row.version} satisfies ConnectorCheckpoint]));}
 async save(organizationId:string,connectionId:string,checkpoint:ConnectorCheckpoint){const value={organization_id:organizationId,connection_id:connectionId,stream_key:checkpoint.streamKey,cursor:checkpoint.cursor,watermark:checkpoint.watermark,version:checkpoint.version,updated_at:new Date().toISOString()} satisfies JsonObject;await this.database.upsert('integration_sync_checkpoints',value,'connection_id,stream_key');}
}

export class RawBatchStore {
 constructor(private readonly database:IntegrationDatabase){}
 async persist(input:{organizationId:string;connectionId:string;syncRunId:string;streamKey:string;records:readonly JsonObject[];cursor:JsonValue|null;watermark:string|null;idempotencyKey:string;metadata?:JsonObject}){
  const value={organization_id:input.organizationId,connection_id:input.connectionId,sync_run_id:input.syncRunId,stream_key:input.streamKey,records:input.records as JsonValue,record_count:input.records.length,cursor:input.cursor,watermark:input.watermark,idempotency_key:input.idempotencyKey,metadata:input.metadata||{}} satisfies JsonObject;
  return this.database.upsert<{id:string}>('integration_raw_batches',value,'connection_id,idempotency_key','resolution=ignore-duplicates,return=representation');
 }
}
