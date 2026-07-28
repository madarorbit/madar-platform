import {randomUUID} from 'node:crypto';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyExecutionConfiguration,OrbyPlanningModel,OrbyTaskPlan,OrbyTaskPlanner,OrbyWorkflowNode} from './contracts';
import {OrbyExecutionError,normalizeExecutionError} from './errors';
import {OrbyExecutionLimitsManager} from './governance';
import {OrbyToolRegistry} from './tools';

function now(){return new Date().toISOString();}
function bytes(value:unknown){return Buffer.byteLength(JSON.stringify(value),'utf8');}

function walk(node:OrbyWorkflowNode,callback:(node:OrbyWorkflowNode)=>void){callback(node);if(node.type==='sequence'||node.type==='parallel')for(const child of node.children)walk(child,callback);else if(node.type==='condition'){walk(node.then,callback);if(node.else)walk(node.else,callback);}else if(node.type==='loop')walk(node.body,callback);}
function planMetrics(plan:OrbyTaskPlan){let steps=0,maxParallel=1,maxLoopIterations=0;const ids=new Set<string>();walk(plan.root,node=>{steps++;if(ids.has(node.id))throw new OrbyExecutionError('معرّفات عقد الخطة يجب أن تكون فريدة.','PLAN_INVALID',false,{nodeId:node.id});ids.add(node.id);if(node.type==='parallel')maxParallel=Math.max(maxParallel,node.maxParallel||node.children.length);if(node.type==='loop')maxLoopIterations=Math.max(maxLoopIterations,node.maxIterations);});return{steps,maxParallel,maxLoopIterations,payloadBytes:bytes(plan),ids};}

export class OrbyPlanValidator {
 constructor(private readonly registry:OrbyToolRegistry,private readonly limits:OrbyExecutionLimitsManager){}
 validate(plan:OrbyTaskPlan,configuration:OrbyExecutionConfiguration){
  if(!plan.id||!plan.goal.trim()||!plan.summary.trim()||!plan.terminalCondition.trim())throw new OrbyExecutionError('خطة أوربي غير مكتملة.','PLAN_INVALID');
  const metrics=planMetrics(plan);this.limits.validatePlan(configuration,metrics);
  const used=new Set<string>();walk(plan.root,node=>{if(node.type==='action'){this.registry.get(node.toolName);used.add(node.toolName);if(node.compensation){this.registry.get(node.compensation.toolName);used.add(node.compensation.toolName);}for(const dependency of node.dependencies||[])if(!metrics.ids.has(dependency))throw new OrbyExecutionError('الخطة تحتوي اعتمادًا على خطوة غير موجودة.','PLAN_INVALID',false,{nodeId:node.id,dependency});}if(node.type==='delay'&&(node.durationMs<0||node.durationMs>86_400_000))throw new OrbyExecutionError('مدة الانتظار خارج الحدود المسموحة.','PLAN_INVALID',false,{nodeId:node.id});if(node.type==='loop'&&node.maxIterations<1)throw new OrbyExecutionError('حلقة سير العمل تحتاج حد تكرار موجبًا.','PLAN_INVALID',false,{nodeId:node.id});});
  for(const name of plan.toolNames)if(!used.has(name))throw new OrbyExecutionError('قائمة أدوات الخطة لا تطابق خطواتها.','PLAN_INVALID',false,{toolName:name});
  return plan;
 }
}

function words(value:string){return new Set(value.toLowerCase().split(/[^\p{L}\p{N}._-]+/u).filter(item=>item.length>2));}

export class ManifestTaskPlanner implements OrbyTaskPlanner {
 constructor(private readonly registry:OrbyToolRegistry){}
 async plan(input:{goal:string;identity:OrbyIdentity;reason:string;metadata?:OrbyJsonObject}){
  const manifests=this.registry.manifests({enabledOnly:true});if(!manifests.length)throw new OrbyExecutionError('لا توجد أدوات ORBY مفعلة للتخطيط.','TOOL_DISABLED');
  const requested=typeof input.metadata?.toolName==='string'?String(input.metadata.toolName):undefined;
  let selected=requested?manifests.find(item=>item.name===requested):undefined;
  if(!selected){const goalWords=words(input.goal);selected=[...manifests].map(manifest=>{const haystack=words(`${manifest.name} ${manifest.description} ${manifest.category} ${manifest.operation}`);let score=0;for(const word of goalWords)if(haystack.has(word)||[...haystack].some(item=>item.includes(word)||word.includes(item)))score++;return{manifest,score};}).sort((a,b)=>b.score-a.score||a.manifest.name.localeCompare(b.manifest.name))[0]?.manifest;}
  if(!selected)throw new OrbyExecutionError('تعذر تحديد أداة مناسبة للهدف.','PLAN_INVALID');
  const supplied=input.metadata?.toolInput&&typeof input.metadata.toolInput==='object'&&!Array.isArray(input.metadata.toolInput)?input.metadata.toolInput as OrbyJsonObject:{};
  const createdAt=now();return{id:randomUUID(),goal:input.goal,summary:`تنفيذ الهدف عبر الأداة ${selected.name}.`,root:{id:'action-1',type:'action',toolName:selected.name,input:supplied},toolNames:[selected.name],dependencies:[],riskLevel:selected.riskLevel,terminalCondition:'اكتمال الأداة وإرجاع نتيجة صالحة.',createdAt,planner:'manifest',metadata:{reason:input.reason}} satisfies OrbyTaskPlan;
 }
}

function extractJson(value:string){const first=value.indexOf('{'),last=value.lastIndexOf('}');if(first<0||last<=first)throw new OrbyExecutionError('نموذج التخطيط لم يُرجع JSON صالحًا.','PLAN_INVALID');return JSON.parse(value.slice(first,last+1)) as OrbyTaskPlan;}

export class ModelTaskPlanner implements OrbyTaskPlanner {
 constructor(private readonly model:OrbyPlanningModel,private readonly registry:OrbyToolRegistry){}
 async plan(input:{goal:string;identity:OrbyIdentity;reason:string;metadata?:OrbyJsonObject;signal?:AbortSignal}){
  const raw=await this.model.generatePlan({...input,tools:this.registry.manifests({enabledOnly:true})}),parsed=extractJson(raw);return{...parsed,id:parsed.id||randomUUID(),goal:input.goal,createdAt:parsed.createdAt||now(),planner:'kernel' as const};
 }
}

export class CompositeTaskPlanner implements OrbyTaskPlanner {
 constructor(private readonly planners:readonly OrbyTaskPlanner[]){}
 async plan(input:{goal:string;identity:OrbyIdentity;reason:string;metadata?:OrbyJsonObject;signal?:AbortSignal}){let last:unknown;for(const planner of this.planners)try{return await planner.plan(input);}catch(error){last=error;}throw normalizeExecutionError(last,'PLAN_INVALID');}
}
