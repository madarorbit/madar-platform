import type {OrbyJsonObject} from '../core/contracts';

export type OrbyExecutionErrorCode=
 |'EXECUTION_DISABLED'|'PLANNING_DISABLED'|'PLAN_INVALID'|'TOOL_NOT_FOUND'|'TOOL_DISABLED'|'TOOL_INVALID'|'TOOL_UNAUTHORIZED'
 |'POLICY_DENIED'|'APPROVAL_REQUIRED'|'APPROVAL_REJECTED'|'APPROVAL_EXPIRED'|'PERMISSION_DENIED'|'LIMIT_EXCEEDED'
 |'TOOL_TIMEOUT'|'TOOL_FAILED'|'RESULT_INVALID'|'WORKFLOW_NOT_FOUND'|'RUN_NOT_FOUND'|'ACTION_NOT_FOUND'|'QUEUE_ERROR'
 |'WORKFLOW_PAUSED'|'WORKFLOW_CANCELLED'|'ROLLBACK_FAILED'|'DATABASE_ERROR'|'INTERNAL_ERROR';

export class OrbyExecutionError extends Error {
 constructor(
  message:string,
  public readonly code:OrbyExecutionErrorCode,
  public readonly retryable=false,
  public readonly details:OrbyJsonObject={},
  public readonly cause?:unknown,
 ){super(message);this.name='OrbyExecutionError';}
}

export class OrbyExecutionPause extends OrbyExecutionError {
 constructor(public readonly pause:{reason:string;resumeAt?:string;approvalId?:string}){
  super('تم إيقاف سير العمل مؤقتًا بانتظار شرط استئناف.','WORKFLOW_PAUSED',false,{reason:pause.reason,resumeAt:pause.resumeAt||null,approvalId:pause.approvalId||null});
 }
}

export function normalizeExecutionError(error:unknown,fallback:OrbyExecutionErrorCode='INTERNAL_ERROR'){
 if(error instanceof OrbyExecutionError)return error;
 if(error instanceof DOMException&&error.name==='AbortError')return new OrbyExecutionError('أُلغي تنفيذ أداة أوربي.','WORKFLOW_CANCELLED',false,{},error);
 const message=error instanceof Error?error.message:'حدث خطأ غير معروف في محرك تنفيذ أوربي.';
 return new OrbyExecutionError(message,fallback,false,{},error);
}
