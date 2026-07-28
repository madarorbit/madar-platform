import {randomUUID} from 'node:crypto';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyActionRecord,OrbyApprovalScope,OrbyExecutionConfiguration,OrbyExecutionEventBus,OrbyExecutionMode,OrbyExecutionRepository,OrbyRetryPolicy,OrbyToolManifest,OrbyWorkflowNode,OrbyWorkflowRun} from './contracts';
import {OrbyExecutionError,OrbyExecutionPause,normalizeExecutionError} from './errors';
import {OrbyApprovalEngine,OrbyExecutionLimitsManager,OrbyPermissionEngine,OrbyPolicyEngine} from './governance';
import {OrbyToolDispatcher} from './tools';
import {OrbySandboxRunner} from './sandbox';
import {now,sleep,template} from './workflow-helpers';

export class OrbyActionEngine {
 constructor(
  private readonly repository:OrbyExecutionRepository,
  private readonly dispatcher:OrbyToolDispatcher,
  private readonly permissions:OrbyPermissionEngine,
  private readonly policies:OrbyPolicyEngine,
  private readonly approvals:OrbyApprovalEngine,
  private readonly limits:OrbyExecutionLimitsManager,
  private readonly sandbox:OrbySandboxRunner,
  private readonly events:OrbyExecutionEventBus,
 ){}
 private retryPolicy(configuration:OrbyExecutionConfiguration,node:Extract<OrbyWorkflowNode,{type:'action'}>):OrbyRetryPolicy{return{maxAttempts:Math.min(configuration.maxAttempts,Math.max(1,node.retry?.maxAttempts||configuration.maxAttempts)),strategy:node.retry?.strategy||'exponential',baseDelayMs:node.retry?.baseDelayMs||configuration.retryBaseDelayMs,maxDelayMs:node.retry?.maxDelayMs||configuration.retryMaxDelayMs,retryableCodes:node.retry?.retryableCodes};}
 private async policy(identity:OrbyIdentity,manifest:OrbyToolManifest,configuration:OrbyExecutionConfiguration,mode:OrbyExecutionMode){const membership=await this.permissions.authorize(identity,manifest),decision=this.policies.evaluate({manifest,configuration,mode,membership});if(decision.effect==='deny')throw new OrbyExecutionError(decision.reason,'POLICY_DENIED',false,{toolName:manifest.name,policyId:decision.policyId});return decision;}
 async execute(input:{run:OrbyWorkflowRun;stepKey:string;node:Extract<OrbyWorkflowNode,{type:'action'}>;configuration:OrbyExecutionConfiguration;environment:OrbyJsonObject;signal?:AbortSignal}){
  const identity:OrbyIdentity={organizationId:input.run.organizationId,userId:input.run.userId,workspaceId:input.run.workspaceId};let action=await this.repository.actionByStep(input.run.id,input.stepKey);if(action?.status==='completed'||action?.status==='compensated')return action.result?.data??null;if(action?.status==='cancelled')throw new OrbyExecutionError('الإجراء ملغى.','WORKFLOW_CANCELLED');
  const tool=this.dispatcher.registry.get(input.node.toolName),manifest=tool.metadata(),payload=template(input.node.input,input.environment) as OrbyJsonObject,retry=this.retryPolicy(input.configuration,input.node),mode=input.node.mode||'production';
  if(!action){const timestamp=now();action=await this.repository.createAction({id:randomUUID(),runId:input.run.id,organizationId:input.run.organizationId,userId:input.run.userId,stepKey:input.stepKey,toolName:manifest.name,operation:manifest.operation,status:'pending',input:payload,attempt:0,maxAttempts:retry.maxAttempts,riskLevel:manifest.riskLevel,executionMode:mode,compensation:input.node.compensation,createdAt:timestamp,updatedAt:timestamp});}
  const decision=await this.policy(identity,manifest,input.configuration,mode);await this.repository.appendAudit({runId:input.run.id,actionId:action.id,organizationId:input.run.organizationId,actorId:input.run.userId,eventType:'policy.evaluated',reason:decision.reason,outcome:decision.effect,metadata:{policyId:decision.policyId,toolName:manifest.name}});
  if(decision.requireSandbox&&mode!=='sandbox'&&!action.result?.metrics?.sandboxPassed){const preview=await this.sandbox.execute({action,identity,reason:input.run.reason,timeoutMs:this.limits.toolTimeout(input.configuration,manifest),signal:input.signal});action=await this.repository.updateAction(action.id,{result:{...preview,metrics:{...(preview.metrics||{}),sandboxPassed:true}},updatedAt:now()});}
  if(decision.effect==='require_approval'){
   const approval=await this.approvals.require({runId:input.run.id,action,identity,scope:decision.approvalScope||'user',reason:decision.reason,ttlSeconds:input.configuration.approvalTtlSeconds,metadata:{toolName:manifest.name,policyId:decision.policyId}});
   if(approval.status!=='approved'){await this.repository.updateAction(action.id,{status:'waiting_approval',updatedAt:now()});throw new OrbyExecutionPause({reason:'approval',approvalId:approval.id});}
  }
  await this.limits.consume(identity,input.configuration);
  for(let attempt=Math.max(1,action.attempt+1);attempt<=retry.maxAttempts;attempt++){
   const started=Date.now();action=await this.repository.updateAction(action.id,{status:'running',attempt,startedAt:now(),updatedAt:now()});await this.repository.appendEvent({runId:input.run.id,actionId:action.id,organizationId:input.run.organizationId,eventType:'tool.started',payload:{toolName:manifest.name,attempt,mode}});await this.events.emit('tool.started',{runId:input.run.id,actionId:action.id,toolName:manifest.name,attempt,mode});
   try{
    const dispatched=await this.dispatcher.dispatch({toolName:manifest.name,payload,context:{requestId:randomUUID(),runId:input.run.id,actionId:action.id,identity,reason:input.run.reason,mode,metadata:{stepKey:input.stepKey}},timeoutMs:this.limits.toolTimeout(input.configuration,manifest),signal:input.signal,mode});
    if(!dispatched.result.ok){const problem=dispatched.result.error!;throw new OrbyExecutionError(problem.message,'TOOL_FAILED',problem.retryable,{toolName:manifest.name,toolErrorCode:problem.code,...(problem.details||{})});}
    action=await this.repository.updateAction(action.id,{status:'completed',result:dispatched.result,errorCode:undefined,errorMessage:undefined,completedAt:now(),updatedAt:now()});await this.repository.appendEvent({runId:input.run.id,actionId:action.id,organizationId:input.run.organizationId,eventType:'tool.finished',payload:{toolName:manifest.name,durationMs:Date.now()-started}});await this.repository.appendAudit({runId:input.run.id,actionId:action.id,organizationId:input.run.organizationId,actorId:input.run.userId,eventType:'tool.executed',reason:input.run.reason,outcome:'completed',metadata:{toolName:manifest.name,attempt,durationMs:Date.now()-started}});await this.events.emit('tool.finished',{runId:input.run.id,actionId:action.id,toolName:manifest.name,durationMs:Date.now()-started});return dispatched.result.data;
   }catch(error){const normalized=normalizeExecutionError(error,'TOOL_FAILED'),retryAllowed=normalized.retryable&&attempt<retry.maxAttempts&&(!retry.retryableCodes||retry.retryableCodes.includes(normalized.code)||retry.retryableCodes.includes(String(normalized.details.toolErrorCode||'')));await this.repository.updateAction(action.id,{status:retryAllowed?'retry':'failed',errorCode:normalized.code,errorMessage:normalized.message,updatedAt:now(),completedAt:retryAllowed?undefined:now()});await this.repository.appendEvent({runId:input.run.id,actionId:action.id,organizationId:input.run.organizationId,eventType:'tool.failed',payload:{toolName:manifest.name,errorCode:normalized.code,attempt,retry:retryAllowed}});await this.events.emit('tool.failed',{runId:input.run.id,actionId:action.id,toolName:manifest.name,errorCode:normalized.code,attempt});if(!retryAllowed)throw normalized;const delay=Math.min(retry.maxDelayMs,retry.strategy==='exponential'?retry.baseDelayMs*2**(attempt-1):retry.baseDelayMs);await sleep(delay,input.signal);}
  }
  throw new OrbyExecutionError('استُنفدت محاولات تنفيذ الأداة.','TOOL_FAILED');
 }
 async approvalNode(input:{run:OrbyWorkflowRun;stepKey:string;scope:OrbyApprovalScope;reason:string;configuration:OrbyExecutionConfiguration}){
  let action=await this.repository.actionByStep(input.run.id,input.stepKey);const timestamp=now();if(!action)action=await this.repository.createAction({id:randomUUID(),runId:input.run.id,organizationId:input.run.organizationId,userId:input.run.userId,stepKey:input.stepKey,toolName:'orby.approval',operation:'approval',status:'pending',input:{reason:input.reason},attempt:0,maxAttempts:1,riskLevel:'medium',executionMode:'production',createdAt:timestamp,updatedAt:timestamp});
  if(action.status==='completed')return true;const approval=await this.approvals.require({runId:input.run.id,action,identity:{organizationId:input.run.organizationId,userId:input.run.userId,workspaceId:input.run.workspaceId},scope:input.scope,reason:input.reason,ttlSeconds:input.configuration.approvalTtlSeconds});if(approval.status!=='approved'){await this.repository.updateAction(action.id,{status:'waiting_approval',updatedAt:now()});throw new OrbyExecutionPause({reason:'approval',approvalId:approval.id});}await this.repository.updateAction(action.id,{status:'completed',result:{ok:true,data:{approvalId:approval.id,status:'approved'}},completedAt:now(),updatedAt:now()});return true;
 }
 async compensate(input:{run:OrbyWorkflowRun;action:OrbyActionRecord;configuration:OrbyExecutionConfiguration;signal?:AbortSignal}){
  const compensation=input.action.compensation;if(!compensation)return false;const stepKey=`rollback/${input.action.stepKey}`,node={id:stepKey,type:'action' as const,toolName:compensation.toolName,input:compensation.input,mode:'production' as const,retry:{maxAttempts:1}};await this.execute({run:input.run,stepKey,node,configuration:input.configuration,environment:{results:{}},signal:input.signal});await this.repository.updateAction(input.action.id,{status:'compensated',updatedAt:now()});return true;
 }
 async cancel(action:OrbyActionRecord,run:OrbyWorkflowRun){await this.dispatcher.cancel(action.toolName,{requestId:randomUUID(),runId:run.id,actionId:action.id,identity:{organizationId:run.organizationId,userId:run.userId,workspaceId:run.workspaceId},reason:'cancelled',mode:action.executionMode});await this.repository.updateAction(action.id,{status:'cancelled',completedAt:now(),updatedAt:now()});}
}
