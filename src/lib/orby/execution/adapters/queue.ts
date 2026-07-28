import type {OrbyJsonObject} from '../../core/contracts';
import type {OrbyExecutionQueue} from '../contracts';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {queue,type QueueRow} from './supabase-shared';

export class SupabaseOrbyExecutionQueue implements OrbyExecutionQueue {
 constructor(private readonly database=new IntegrationDatabase()){}
 async enqueue(input:{runId:string;organizationId:string;priority?:number;availableAt?:string;maxAttempts?:number;idempotencyKey?:string}){return queue(await this.database.rpc<QueueRow>('orby_enqueue_execution_job',{target_run:input.runId,target_organization:input.organizationId,job_priority:input.priority??100,job_available_at:input.availableAt||new Date().toISOString(),job_max_attempts:input.maxAttempts??5,job_idempotency_key:input.idempotencyKey||null}));}
 async claim(workerId:string,limit=5,leaseSeconds=120){return(await this.database.rpc<QueueRow[]>('orby_claim_execution_jobs',{worker_id:workerId,claim_limit:Math.min(20,Math.max(1,limit)),lease_seconds:Math.min(900,Math.max(30,leaseSeconds))})).map(queue);}
 heartbeat(jobId:string,workerId:string,leaseSeconds=120){return this.database.rpc<boolean>('orby_heartbeat_execution_job',{target_job:jobId,worker_id:workerId,lease_seconds:leaseSeconds});}
 complete(jobId:string,workerId:string,result:OrbyJsonObject={}){return this.database.rpc<boolean>('orby_complete_execution_job',{target_job:jobId,worker_id:workerId,job_result:result});}
 fail(jobId:string,workerId:string,errorCode:string,errorMessage:string,nextAttemptAt:string|null=null){return this.database.rpc<boolean>('orby_fail_execution_job',{target_job:jobId,worker_id:workerId,error_code:errorCode,error_message:errorMessage,next_attempt_at:nextAttemptAt});}
 async cancelRun(runId:string){await this.database.rpc('orby_cancel_execution_run',{target_run:runId});}
}
