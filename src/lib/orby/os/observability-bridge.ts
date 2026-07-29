import type {OrbyExecutionEventBus} from '../execution/contracts';
import {SupabaseOrbyOsRepository} from './repository';

const attached=new WeakSet<object>();
export function attachOrbyOsObservability(events:OrbyExecutionEventBus,repository=new SupabaseOrbyOsRepository()){
 if(attached.has(events as object))return;attached.add(events as object);
 const traceIds=new Map<string,string>(),workflowSpans=new Map<string,string>(),actionSpans=new Map<string,string>();
 const trace=async(runId:string,organizationId?:string,userId?:string)=>{const cached=traceIds.get(runId);if(cached)return cached;if(!organizationId)return null;const existing=await repository.traceByRequest(organizationId,runId),value=existing||await repository.startTrace({requestId:runId,identity:{organizationId,userId:userId||'system'},operation:'workflow.execute',metadata:{source:'orby-execution-events'}});traceIds.set(runId,value.id);return value.id;};
 events.on('workflow.queued',async payload=>{await trace(payload.runId,payload.organizationId,payload.userId);});
 events.on('workflow.started',async payload=>{const traceId=await trace(payload.runId,payload.organizationId,payload.userId);if(traceId){const span=await repository.startSpan(traceId,{name:'workflow',kind:'workflow',metadata:{runId:payload.runId}});workflowSpans.set(payload.runId,span.id);}});
 events.on('tool.started',async payload=>{const traceId=traceIds.get(payload.runId);if(!traceId)return;const span=await repository.startSpan(traceId,{parentSpanId:workflowSpans.get(payload.runId),name:payload.toolName,kind:'tool',metadata:{runId:payload.runId,actionId:payload.actionId,attempt:payload.attempt,mode:payload.mode}});actionSpans.set(payload.actionId,span.id);});
 events.on('tool.finished',async payload=>{const span=actionSpans.get(payload.actionId);if(span)await repository.finishSpan(span,'succeeded',{metadata:{durationMs:payload.durationMs}});});
 events.on('tool.failed',async payload=>{const span=actionSpans.get(payload.actionId);if(span)await repository.finishSpan(span,'failed',{errorCode:payload.errorCode,metadata:{attempt:payload.attempt}});});
 events.on('approval.requested',async payload=>{const traceId=traceIds.get(payload.runId);if(traceId)await repository.startSpan(traceId,{parentSpanId:workflowSpans.get(payload.runId),name:'approval',kind:'approval',metadata:{approvalId:payload.approvalId,scope:payload.scope}});});
 events.on('workflow.completed',async payload=>{const span=workflowSpans.get(payload.runId);if(span)await repository.finishSpan(span,'succeeded',{metadata:{durationMs:payload.durationMs}});const traceId=traceIds.get(payload.runId);if(traceId)await repository.finishTrace(traceId,'succeeded',{durationMs:payload.durationMs});});
 events.on('workflow.failed',async payload=>{const span=workflowSpans.get(payload.runId);if(span)await repository.finishSpan(span,'failed',{errorCode:payload.errorCode,metadata:{durationMs:payload.durationMs}});const traceId=traceIds.get(payload.runId);if(traceId)await repository.finishTrace(traceId,'failed',{errorCode:payload.errorCode,durationMs:payload.durationMs});});
 events.on('workflow.cancelled',async payload=>{const traceId=traceIds.get(payload.runId);if(traceId)await repository.finishTrace(traceId,'cancelled',{cancelledBy:payload.userId});});
}
