import {randomUUID} from 'node:crypto';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyRiskLevel,OrbyTaskPlan,OrbyWorkflowNode} from '../execution/contracts';
import {createServerOrbyAgentRuntime} from '../execution/server';
import {validateWorkflow} from './workflow';
import {SupabaseOrbyOsRepository} from './repository';

function inspect(node:OrbyWorkflowNode,state:{tools:Set<string>;dependencies:{from:string;to:string}[];risk:OrbyRiskLevel}){
 if(node.type==='action'){state.tools.add(node.toolName);for(const from of node.dependencies||[])state.dependencies.push({from,to:node.id});return;}
 if(node.type==='sequence'||node.type==='parallel'){for(const child of node.children)inspect(child,state);return;}
 if(node.type==='condition'){inspect(node.then,state);if(node.else)inspect(node.else,state);return;}
 if(node.type==='loop'){inspect(node.body,state);return;}
 if(node.type==='approval')state.risk=state.risk==='critical'?'critical':'high';
}
export class OrbyOsWorkflowService{
 constructor(private readonly repository=new SupabaseOrbyOsRepository()){}
 async submitTemplate(input:{key:string;identity:OrbyIdentity;goal?:string;reason?:string;variables?:OrbyJsonObject;signal?:AbortSignal}){
  const stored=await this.repository.template(input.key);if(!stored)throw new Error('ORBY_WORKFLOW_TEMPLATE_NOT_FOUND');
  const validation=validateWorkflow({id:stored.definition.id,key:stored.definition.key,name:stored.definition.name,description:stored.definition.description,domain:stored.definition.domain,version:stored.version.version,status:stored.version.status as 'active',root:stored.version.definition,inputSchema:stored.version.input_schema,outputSchema:stored.version.output_schema,requiredPermissions:stored.definition.required_permissions||[],maxDurationSeconds:stored.version.max_duration_seconds,tags:stored.definition.tags||[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),metadata:stored.definition.metadata});if(!validation.valid)throw new Error(`ORBY_STORED_WORKFLOW_INVALID:${validation.issues.join('|')}`);
  const state={tools:new Set<string>(),dependencies:[] as {from:string;to:string}[],risk:'low' as OrbyRiskLevel};inspect(stored.version.definition,state);
  const goal=input.goal?.trim()||stored.definition.name,plan:OrbyTaskPlan={id:randomUUID(),goal,summary:stored.definition.description,root:stored.version.definition,toolNames:[...state.tools],dependencies:state.dependencies,riskLevel:state.risk,terminalCondition:'اكتمال جميع عقد التدفق أو توقفه الآمن عند الموافقة أو الفشل.',createdAt:new Date().toISOString(),planner:'explicit',metadata:{orbyOs:true,templateKey:stored.template.key,workflowDefinitionId:stored.definition.id,workflowVersionId:stored.version.id,workflowVersion:stored.version.version,checksum:stored.version.checksum,variables:input.variables||{}}};
  const {runtime}=await createServerOrbyAgentRuntime();return runtime.submit({goal,identity:input.identity,reason:input.reason||stored.definition.description,plan,metadata:plan.metadata,signal:input.signal});
 }
}
