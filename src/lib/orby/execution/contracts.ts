import type {OrbyIdentity,OrbyJsonObject,OrbyJsonValue} from '../core/contracts';

export type OrbyToolCategory='data'|'files'|'platform'|'business'|'intelligence'|'integration';
export type OrbyToolExecutionType='read'|'write'|'delete'|'external'|'analysis';
export type OrbyRiskLevel='low'|'medium'|'high'|'critical';
export type OrbyToolStatus='active'|'disabled'|'deprecated'|'internal';
export type OrbyToolSupport='stable'|'beta'|'experimental';
export type OrbyApprovalScope='user'|'manager'|'system';
export type OrbyExecutionMode='production'|'sandbox';

export type OrbyJsonSchema={type?:'object'|'array'|'string'|'number'|'integer'|'boolean'|'null';description?:string;properties?:Record<string,OrbyJsonSchema>;required?:readonly string[];items?:OrbyJsonSchema;enum?:readonly OrbyJsonValue[];minLength?:number;maxLength?:number;minimum?:number;maximum?:number;additionalProperties?:boolean};
export type OrbyToolManifest={name:string;description:string;version:string;category:OrbyToolCategory;requiredPermissions:readonly string[];executionType:OrbyToolExecutionType;inputSchema:OrbyJsonSchema;outputSchema:OrbyJsonSchema;riskLevel:OrbyRiskLevel;status:OrbyToolStatus;support:OrbyToolSupport;requirements:readonly string[];maxTimeoutMs:number;supportsSandbox:boolean;operation:string;metadata?:OrbyJsonObject};
export type OrbyToolContext={requestId:string;runId:string;actionId:string;identity:OrbyIdentity;reason:string;mode:OrbyExecutionMode;signal:AbortSignal;metadata?:OrbyJsonObject};
export type OrbyToolValidation={valid:true;normalizedInput:OrbyJsonObject}|{valid:false;issues:readonly {path:string;message:string}[]};
export type OrbyToolAuthorization={allowed:true}|{allowed:false;reason:string;code?:string};
export type OrbyToolResult={ok:boolean;data:OrbyJsonValue;warnings?:readonly string[];metrics?:OrbyJsonObject;error?:{code:string;message:string;retryable:boolean;details?:OrbyJsonObject}};
export type OrbyToolHealth={ok:boolean;checkedAt:string;latencyMs:number;message?:string;metadata?:OrbyJsonObject};
export interface OrbyTool{metadata():OrbyToolManifest;validate(input:unknown,context:Omit<OrbyToolContext,'signal'>):Promise<OrbyToolValidation>|OrbyToolValidation;authorize(context:Omit<OrbyToolContext,'signal'>,input:OrbyJsonObject):Promise<OrbyToolAuthorization>|OrbyToolAuthorization;execute(context:OrbyToolContext,input:OrbyJsonObject):Promise<OrbyToolResult>;cancel(context:Omit<OrbyToolContext,'signal'>):Promise<void>;health(signal?:AbortSignal):Promise<OrbyToolHealth>}

export type OrbyRetryPolicy={maxAttempts:number;strategy:'fixed'|'exponential';baseDelayMs:number;maxDelayMs:number;retryableCodes?:readonly string[]};
export type OrbyCompensationPlan={toolName:string;input:OrbyJsonObject;reason:string};
export type OrbyConditionExpression=|{operator:'exists';path:string}|{operator:'equals'|'not_equals'|'greater_than'|'less_than';path:string;value:OrbyJsonValue}|{operator:'and'|'or';conditions:readonly OrbyConditionExpression[]}|{operator:'not';condition:OrbyConditionExpression};
export type OrbyWorkflowNode=|{id:string;type:'action';toolName:string;input:OrbyJsonObject;dependencies?:readonly string[];retry?:Partial<OrbyRetryPolicy>;compensation?:OrbyCompensationPlan;mode?:OrbyExecutionMode}|{id:string;type:'sequence';children:readonly OrbyWorkflowNode[]}|{id:string;type:'parallel';children:readonly OrbyWorkflowNode[];maxParallel?:number}|{id:string;type:'condition';condition:OrbyConditionExpression;then:OrbyWorkflowNode;else?:OrbyWorkflowNode}|{id:string;type:'loop';itemsPath:string;itemVariable:string;body:OrbyWorkflowNode;maxIterations:number}|{id:string;type:'delay';durationMs:number}|{id:string;type:'approval';scope:OrbyApprovalScope;reason:string;expiresInSeconds?:number}|{id:string;type:'event';name:string;payload:OrbyJsonObject};
export type OrbyTaskPlan={id:string;goal:string;summary:string;root:OrbyWorkflowNode;toolNames:readonly string[];dependencies:readonly {from:string;to:string}[];riskLevel:OrbyRiskLevel;terminalCondition:string;createdAt:string;planner:'kernel'|'manifest'|'explicit'|'test';metadata?:OrbyJsonObject};
export type OrbyExecutionConfiguration={enabled:boolean;planningEnabled:boolean;maxWorkflowSteps:number;maxParallelActions:number;maxLoopIterations:number;defaultToolTimeoutMs:number;maxToolTimeoutMs:number;maxAttempts:number;retryBaseDelayMs:number;retryMaxDelayMs:number;approvalTtlSeconds:number;dailyActionLimit:number;perMinuteActionLimit:number;maxPayloadBytes:number;allowExternalWrites:boolean;allowDeletes:boolean;sandboxRequiredForHighRisk:boolean};

export type OrbyWorkflowStatus='draft'|'active'|'archived';
export type OrbyRunStatus='pending'|'running'|'waiting'|'retry'|'failed'|'completed'|'cancelled';
export type OrbyActionStatus='pending'|'running'|'waiting_approval'|'retry'|'failed'|'completed'|'cancelled'|'compensated';
export type OrbyApprovalStatus='pending'|'approved'|'rejected'|'expired';
export type OrbyQueueStatus='pending'|'running'|'waiting'|'retry'|'failed'|'completed'|'cancelled';
export type OrbyWorkflowRecord={id:string;organizationId:string;createdBy:string;goal:string;plan:OrbyTaskPlan;status:OrbyWorkflowStatus;version:number;createdAt:string;updatedAt:string};
export type OrbyRunState={completedNodeIds:string[];variables:OrbyJsonObject;results:OrbyJsonObject;delayUntil?:Record<string,string>};
export type OrbyWorkflowRun={id:string;workflowId:string;organizationId:string;userId:string;workspaceId?:string;status:OrbyRunStatus;reason:string;state:OrbyRunState;result?:OrbyJsonValue;errorCode?:string;errorMessage?:string;createdAt:string;startedAt?:string;completedAt?:string;updatedAt:string};
export type OrbyActionRecord={id:string;runId:string;organizationId:string;userId:string;stepKey:string;toolName:string;operation:string;status:OrbyActionStatus;input:OrbyJsonObject;result?:OrbyToolResult;errorCode?:string;errorMessage?:string;attempt:number;maxAttempts:number;riskLevel:OrbyRiskLevel;executionMode:OrbyExecutionMode;compensation?:OrbyCompensationPlan;startedAt?:string;completedAt?:string;createdAt:string;updatedAt:string};
export type OrbyApprovalRecord={id:string;runId:string;actionId?:string;organizationId:string;requestedBy:string;scope:OrbyApprovalScope;status:OrbyApprovalStatus;reason:string;decidedBy?:string;decisionReason?:string;expiresAt:string;metadata?:OrbyJsonObject;createdAt:string;decidedAt?:string};
export type OrbyQueueJob={id:string;runId:string;organizationId:string;status:OrbyQueueStatus;priority:number;availableAt:string;attempts:number;maxAttempts:number;idempotencyKey?:string;lockedBy?:string;leaseExpiresAt?:string;createdAt:string;updatedAt:string};
export type OrbyPolicyEffect='allow'|'deny'|'require_approval'|'require_review';
export type OrbyPolicyDecision={effect:OrbyPolicyEffect;reason:string;approvalScope?:OrbyApprovalScope;requireAudit:boolean;requireSandbox:boolean;policyId:string};
export type OrbyMembership={organizationId:string;userId:string;role:'OWNER'|'ADMIN'|'MEMBER';organizationStatus:string;workspaceAuthorized:boolean;permissions:readonly string[]};

export type OrbyExecutionEventMap={'workflow.planned':{workflowId:string;organizationId:string;userId:string;toolNames:readonly string[]};'workflow.queued':{runId:string;workflowId:string;organizationId:string;userId:string};'workflow.started':{runId:string;organizationId:string;userId:string};'workflow.waiting':{runId:string;reason:string;resumeAt?:string;approvalId?:string};'workflow.completed':{runId:string;durationMs:number};'workflow.failed':{runId:string;errorCode:string;durationMs:number};'workflow.cancelled':{runId:string;userId:string};'tool.started':{runId:string;actionId:string;toolName:string;attempt:number;mode:OrbyExecutionMode};'tool.finished':{runId:string;actionId:string;toolName:string;durationMs:number};'tool.failed':{runId:string;actionId:string;toolName:string;errorCode:string;attempt:number};'approval.requested':{approvalId:string;runId:string;actionId?:string;scope:OrbyApprovalScope};'approval.granted':{approvalId:string;runId:string;decidedBy:string};'approval.rejected':{approvalId:string;runId:string;decidedBy:string};'rollback.started':{runId:string;actions:number};'rollback.completed':{runId:string;compensated:number;failed:number};'sandbox.completed':{runId:string;actionId:string;toolName:string;ok:boolean}};
export type OrbyExecutionEventName=keyof OrbyExecutionEventMap;
export type OrbyExecutionListener<K extends OrbyExecutionEventName>=(payload:OrbyExecutionEventMap[K])=>void|Promise<void>;
export interface OrbyExecutionEventBus{on<K extends OrbyExecutionEventName>(event:K,listener:OrbyExecutionListener<K>):()=>void;emit<K extends OrbyExecutionEventName>(event:K,payload:OrbyExecutionEventMap[K]):Promise<void>}

export interface OrbyExecutionRepository{
 configuration(organizationId:string):Promise<OrbyExecutionConfiguration>;
 saveWorkflow(workflow:OrbyWorkflowRecord):Promise<OrbyWorkflowRecord>;workflow(workflowId:string):Promise<OrbyWorkflowRecord|null>;
 createRun(run:OrbyWorkflowRun):Promise<OrbyWorkflowRun>;run(runId:string):Promise<OrbyWorkflowRun|null>;updateRun(runId:string,patch:Partial<OrbyWorkflowRun>):Promise<OrbyWorkflowRun>;
 createAction(action:OrbyActionRecord):Promise<OrbyActionRecord>;action(actionId:string):Promise<OrbyActionRecord|null>;actionByStep(runId:string,stepKey:string):Promise<OrbyActionRecord|null>;updateAction(actionId:string,patch:Partial<OrbyActionRecord>):Promise<OrbyActionRecord>;actions(runId:string):Promise<readonly OrbyActionRecord[]>;
 createApproval(approval:OrbyApprovalRecord):Promise<OrbyApprovalRecord>;approval(approvalId:string):Promise<OrbyApprovalRecord|null>;approvalForAction(actionId:string):Promise<OrbyApprovalRecord|null>;updateApproval(approvalId:string,patch:Partial<OrbyApprovalRecord>):Promise<OrbyApprovalRecord>;
 appendEvent(input:{runId:string;actionId?:string;organizationId:string;eventType:string;payload:OrbyJsonObject}):Promise<void>;
 appendAudit(input:{runId:string;actionId?:string;approvalId?:string;organizationId:string;actorId?:string;eventType:string;reason?:string;outcome?:string;metadata?:OrbyJsonObject}):Promise<void>;
 notify(input:{userId:string;title:string;body:string;link?:string}):Promise<void>;
 notifyApproval(input:{organizationId:string;requestedBy:string;scope:OrbyApprovalScope;title:string;body:string;link?:string}):Promise<void>;
 saveSandbox(input:{runId:string;actionId:string;organizationId:string;userId:string;toolName:string;status:'running'|'completed'|'failed';input:OrbyJsonObject;result?:OrbyToolResult;createdAt:string;completedAt?:string}):Promise<void>;
 consumeBudget(identity:OrbyIdentity,limits:{daily:number;perMinute:number}):Promise<{allowed:boolean;dailyUsed:number;minuteUsed:number}>;
 enabledToolNames():Promise<readonly string[]>;syncToolCatalog(manifests:readonly OrbyToolManifest[]):Promise<void>;
}
export interface OrbyExecutionQueue{enqueue(input:{runId:string;organizationId:string;priority?:number;availableAt?:string;maxAttempts?:number;idempotencyKey?:string}):Promise<OrbyQueueJob>;claim(workerId:string,limit?:number,leaseSeconds?:number):Promise<readonly OrbyQueueJob[]>;heartbeat(jobId:string,workerId:string,leaseSeconds?:number):Promise<boolean>;complete(jobId:string,workerId:string,result?:OrbyJsonObject):Promise<boolean>;fail(jobId:string,workerId:string,errorCode:string,errorMessage:string,nextAttemptAt?:string|null):Promise<boolean>;cancelRun(runId:string):Promise<void>}
export interface OrbyMembershipResolver{resolve(identity:OrbyIdentity):Promise<OrbyMembership|null>}
export interface OrbyTaskPlanner{plan(input:{goal:string;identity:OrbyIdentity;reason:string;metadata?:OrbyJsonObject;signal?:AbortSignal}):Promise<OrbyTaskPlan>}
export interface OrbyPlanningModel{generatePlan(input:{goal:string;identity:OrbyIdentity;reason:string;tools:readonly OrbyToolManifest[];signal?:AbortSignal}):Promise<string>}
export interface OrbyMadarToolGateway{execute(operation:string,input:OrbyJsonObject,context:OrbyToolContext):Promise<OrbyToolResult>;cancel(operation:string,context:Omit<OrbyToolContext,'signal'>):Promise<void>;health(operation:string,signal?:AbortSignal):Promise<OrbyToolHealth>}
