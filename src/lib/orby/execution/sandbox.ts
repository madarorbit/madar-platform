import {randomUUID} from 'node:crypto';
import type {OrbyIdentity} from '../core/contracts';
import type {OrbyActionRecord,OrbyExecutionEventBus,OrbyExecutionRepository} from './contracts';
import {OrbyExecutionError,normalizeExecutionError} from './errors';
import {OrbyToolDispatcher} from './tools';
import {errorResult,now} from './workflow-helpers';

export class OrbySandboxRunner {
 constructor(private readonly dispatcher:OrbyToolDispatcher,private readonly repository:OrbyExecutionRepository,private readonly events:OrbyExecutionEventBus){}
 async execute(input:{action:OrbyActionRecord;identity:OrbyIdentity;reason:string;timeoutMs:number;signal?:AbortSignal}){
  const manifest=this.dispatcher.registry.get(input.action.toolName).metadata();if(!manifest.supportsSandbox)throw new OrbyExecutionError('الأداة لا توفر وضع Sandbox المطلوب.','POLICY_DENIED',false,{toolName:manifest.name});
  const context={requestId:randomUUID(),runId:input.action.runId,actionId:input.action.id,identity:input.identity,reason:input.reason,mode:'sandbox' as const,metadata:{sandbox:true}};
  await this.repository.saveSandbox({runId:input.action.runId,actionId:input.action.id,organizationId:input.identity.organizationId,userId:input.identity.userId,toolName:input.action.toolName,status:'running',input:input.action.input,createdAt:now()});
  try{const dispatched=await this.dispatcher.dispatch({toolName:input.action.toolName,payload:input.action.input,context,timeoutMs:input.timeoutMs,signal:input.signal,mode:'sandbox'});await this.repository.saveSandbox({runId:input.action.runId,actionId:input.action.id,organizationId:input.identity.organizationId,userId:input.identity.userId,toolName:input.action.toolName,status:'completed',input:input.action.input,result:dispatched.result,createdAt:input.action.createdAt,completedAt:now()});await this.events.emit('sandbox.completed',{runId:input.action.runId,actionId:input.action.id,toolName:input.action.toolName,ok:dispatched.result.ok});return dispatched.result;}catch(error){const normalized=normalizeExecutionError(error,'TOOL_FAILED');await this.repository.saveSandbox({runId:input.action.runId,actionId:input.action.id,organizationId:input.identity.organizationId,userId:input.identity.userId,toolName:input.action.toolName,status:'failed',input:input.action.input,result:errorResult(normalized),createdAt:input.action.createdAt,completedAt:now()});await this.events.emit('sandbox.completed',{runId:input.action.runId,actionId:input.action.id,toolName:input.action.toolName,ok:false});throw normalized;}
 }
}
