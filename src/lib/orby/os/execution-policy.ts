import type {OrbyJsonObject} from '../core/contracts';
import type {OrbyPolicyDecision} from '../execution/contracts';
import type {OrbyPolicyRule} from '../execution/governance';

export type OrbyOsExecutionPolicyRow={id:string;key:string;organization_id?:string|null;workspace_id?:string|null;priority:number;enabled:boolean;effect:'allow'|'deny'|'require_approval'|'require_sandbox'|'throttle';approval_scope?:'user'|'manager'|'system'|null;conditions:OrbyJsonObject;limits:OrbyJsonObject;description:string};
type EvaluationInput=Parameters<OrbyPolicyRule['evaluate']>[0];
function applies(row:OrbyOsExecutionPolicyRow,input:EvaluationInput){
 if(!row.enabled||row.effect==='allow')return false;
 if(row.organization_id&&row.organization_id!==input.membership.organizationId)return false;
 if(row.workspace_id)return false;
 const conditions=row.conditions as Record<string,unknown>;
 if(conditions.executionType&&conditions.executionType!==input.manifest.executionType)return false;
 if(conditions.riskLevel&&conditions.riskLevel!==input.manifest.riskLevel)return false;
 if(conditions.toolName&&conditions.toolName!==input.manifest.name)return false;
 if(conditions.action==='tenant.cross_access'&&input.membership.workspaceAuthorized)return false;
 if(conditions.action==='channel.external.send'&&!input.manifest.name.startsWith('channel.'))return false;
 if(conditions.action==='data.store.secret')return false;
 const required=Array.isArray(conditions.requiredPermissions)?conditions.requiredPermissions.map(String):[];
 if(required.length&&!required.every(permission=>input.membership.permissions.includes(permission)))return false;
 return true;
}
function decision(row:OrbyOsExecutionPolicyRow):OrbyPolicyDecision{
 if(row.effect==='deny'||row.effect==='throttle')return{effect:'deny',reason:row.description,requireAudit:true,requireSandbox:false,policyId:`orby-os:${row.key}`};
 if(row.effect==='require_approval')return{effect:'require_approval',reason:row.description,approvalScope:row.approval_scope||'manager',requireAudit:true,requireSandbox:Boolean(row.limits?.sandbox??true),policyId:`orby-os:${row.key}`};
 return{effect:'allow',reason:row.description,requireAudit:true,requireSandbox:true,policyId:`orby-os:${row.key}`};
}
export function createOrbyOsExecutionPolicyRules(rows:readonly OrbyOsExecutionPolicyRow[]):OrbyPolicyRule[]{return rows.filter(row=>row.enabled&&row.effect!=='allow').map(row=>({id:`orby-os:${row.key}`,priority:3000+row.priority,evaluate:input=>applies(row,input)?decision(row):null}));}
