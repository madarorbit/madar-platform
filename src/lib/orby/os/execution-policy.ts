import type {OrbyJsonObject} from '../core/contracts';
import type {OrbyPolicyDecision,OrbyPolicyEvaluationInput,OrbyPolicyRule} from '../execution/contracts';

export type OrbyOsExecutionPolicyRow={id:string;key:string;organization_id?:string|null;workspace_id?:string|null;priority:number;enabled:boolean;effect:'allow'|'deny'|'require_approval'|'require_sandbox'|'throttle';approval_scope?:'user'|'manager'|'system'|null;conditions:OrbyJsonObject;limits:OrbyJsonObject;description:string};
const secretPattern=/(api[_-]?key|password|secret|access[_-]?token|refresh[_-]?token|credential|authorization)/i;
function containsSecret(value:unknown):boolean{if(Array.isArray(value))return value.some(containsSecret);if(value&&typeof value==='object')return Object.entries(value as Record<string,unknown>).some(([key,item])=>secretPattern.test(key)||containsSecret(item));return false;}
function applies(row:OrbyOsExecutionPolicyRow,input:OrbyPolicyEvaluationInput){
 if(!row.enabled||row.effect==='allow')return false;
 if(row.organization_id&&row.organization_id!==input.membership.organizationId)return false;
 const conditions=row.conditions as Record<string,unknown>;
 if(conditions.executionType&&conditions.executionType!==input.tool.operation)return false;
 if(conditions.riskLevel&&conditions.riskLevel!==input.tool.riskLevel)return false;
 if(conditions.toolName&&conditions.toolName!==input.tool.name)return false;
 if(conditions.action==='data.store.secret'&&!containsSecret(input.action.input))return false;
 if(conditions.action==='tenant.cross_access'&&input.membership.workspaceAuthorized)return false;
 if(conditions.action==='channel.external.send'&&!input.tool.name.startsWith('channel.'))return false;
 const required=Array.isArray(conditions.requiredPermissions)?conditions.requiredPermissions.map(String):[];
 if(required.length&&!required.every(permission=>input.membership.permissions.includes(permission)))return false;
 return true;
}
function decision(row:OrbyOsExecutionPolicyRow):OrbyPolicyDecision{
 if(row.effect==='deny'||row.effect==='throttle')return{kind:'deny',code:row.effect==='throttle'?'ORBY_GOVERNANCE_THROTTLED':'ORBY_GOVERNANCE_DENIED',reason:row.description,requiresAudit:true,retryable:false};
 if(row.effect==='require_approval')return{kind:'approval',scope:row.approval_scope||'manager',reason:row.description,requireSandbox:Boolean(row.limits?.sandbox??true),requiresAudit:true};
 return{kind:'allow',reason:row.description,requireSandbox:true,requiresAudit:true};
}
export function createOrbyOsExecutionPolicyRules(rows:readonly OrbyOsExecutionPolicyRow[]):OrbyPolicyRule[]{return rows.filter(row=>row.enabled&&row.effect!=='allow').map(row=>({id:`orby-os:${row.key}`,priority:3000+row.priority,evaluate:input=>applies(row,input)?decision(row):null}));}
