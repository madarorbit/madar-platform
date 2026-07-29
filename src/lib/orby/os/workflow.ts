import {createHash,randomUUID} from 'node:crypto';
import type {OrbyJsonObject} from '../core/contracts';
import type {OrbyWorkflowNode} from '../execution/contracts';
import type {OrbyWorkflowDefinition,OrbyWorkflowTemplate} from './contracts';

export type WorkflowMetrics={steps:number;maxParallel:number;maxLoopIterations:number;approvals:number;subflows:number};
export type WorkflowValidation={valid:true;metrics:WorkflowMetrics;checksum:string}|{valid:false;issues:readonly string[]};

function visit(node:OrbyWorkflowNode,seen:Set<string>,issues:string[],metrics:WorkflowMetrics):void{
 if(seen.has(node.id)){issues.push(`معرّف الخطوة مكرر: ${node.id}`);return;} seen.add(node.id);metrics.steps+=1;
 if(node.type==='parallel'){metrics.maxParallel=Math.max(metrics.maxParallel,node.children.length);for(const child of node.children)visit(child,seen,issues,metrics);}
 else if(node.type==='sequence'){for(const child of node.children)visit(child,seen,issues,metrics);}
 else if(node.type==='condition'){visit(node.then,seen,issues,metrics);if(node.else)visit(node.else,seen,issues,metrics);}
 else if(node.type==='loop'){metrics.maxLoopIterations=Math.max(metrics.maxLoopIterations,node.maxIterations);if(node.maxIterations<1)issues.push(`حلقة ${node.id} بلا حد صالح.`);visit(node.body,seen,issues,metrics);}
 else if(node.type==='approval')metrics.approvals+=1;
}
function stable(value:unknown):string{if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return`{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;return JSON.stringify(value);}
export function workflowChecksum(definition:Pick<OrbyWorkflowDefinition,'key'|'version'|'root'|'inputSchema'|'outputSchema'>){return createHash('sha256').update(stable(definition)).digest('hex');}
export function validateWorkflow(definition:OrbyWorkflowDefinition,limits={maxSteps:100,maxParallel:10,maxLoopIterations:100}):WorkflowValidation{
 const issues:string[]=[],metrics:WorkflowMetrics={steps:0,maxParallel:0,maxLoopIterations:0,approvals:0,subflows:0};
 if(!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(definition.key))issues.push('مفتاح Workflow غير صالح.');
 if(!Number.isInteger(definition.version)||definition.version<1)issues.push('إصدار Workflow يجب أن يكون رقمًا موجبًا.');
 if(definition.maxDurationSeconds<1||definition.maxDurationSeconds>86_400)issues.push('مهلة Workflow خارج الحدود الآمنة.');
 visit(definition.root,new Set(),issues,metrics);
 if(metrics.steps>limits.maxSteps)issues.push('عدد الخطوات يتجاوز الحد.');
 if(metrics.maxParallel>limits.maxParallel)issues.push('التوازي يتجاوز الحد.');
 if(metrics.maxLoopIterations>limits.maxLoopIterations)issues.push('حد التكرار يتجاوز السياسة.');
 return issues.length?{valid:false,issues}:{valid:true,metrics,checksum:workflowChecksum(definition)};
}

export class OrbyWorkflowCatalog{
 private readonly versions=new Map<string,Map<number,OrbyWorkflowDefinition>>();
 private readonly templates=new Map<string,OrbyWorkflowTemplate>();
 register(definition:OrbyWorkflowDefinition){const validation=validateWorkflow(definition);if(!validation.valid)throw new Error(`ORBY_WORKFLOW_INVALID: ${validation.issues.join(' | ')}`);const versions=this.versions.get(definition.key)||new Map<number,OrbyWorkflowDefinition>();if(versions.has(definition.version))throw new Error('ORBY_WORKFLOW_VERSION_EXISTS');versions.set(definition.version,Object.freeze({...definition}));this.versions.set(definition.key,versions);return definition;}
 registerTemplate(template:OrbyWorkflowTemplate){if(this.templates.has(template.key))throw new Error('ORBY_WORKFLOW_TEMPLATE_EXISTS');this.register(template.definition);this.templates.set(template.key,Object.freeze({...template}));return template;}
 get(key:string,version?:number){const versions=this.versions.get(key);if(!versions)return undefined;if(version)return versions.get(version);return [...versions.values()].sort((a,b)=>b.version-a.version).find(item=>item.status==='active'||item.status==='canary');}
 list(domain?:string){return [...this.versions.values()].flatMap(item=>[...item.values()]).filter(item=>!domain||item.domain===domain).sort((a,b)=>a.key.localeCompare(b.key)||b.version-a.version);}
 listTemplates(domain?:string){return [...this.templates.values()].filter(item=>item.enabled&&(!domain||item.domain===domain));}
}

const schema=(properties:OrbyJsonObject,required:string[]=[]):OrbyJsonObject=>({type:'object',properties,required,additionalProperties:false});
const action=(id:string,toolName:string,input:OrbyJsonObject):OrbyWorkflowNode=>({id,type:'action',toolName,input});
function definition(key:string,name:string,description:string,domain:string,root:OrbyWorkflowNode,permissions:string[],tags:string[]):OrbyWorkflowDefinition{const now='2026-07-29T00:00:00.000Z';return{id:randomUUID(),key,name,description,domain,version:1,status:'active',root,inputSchema:schema({},[]),outputSchema:schema({},[]),requiredPermissions:permissions,maxDurationSeconds:3600,tags,createdAt:now,updatedAt:now};}
export function builtinWorkflowTemplates():readonly OrbyWorkflowTemplate[]{
 const sales=definition('business.sales-drop-analysis','تحليل انخفاض المبيعات','تحليل حتمي للانخفاض ثم إنشاء مسودة خطة تحتاج موافقة.','business',{id:'sales-sequence',type:'sequence',children:[action('sales-analyze','orby.intelligence.analyze',{detector:'sales_drop'}),{id:'sales-approval',type:'approval',scope:'manager',reason:'اعتماد خطة معالجة انخفاض المبيعات.'},action('sales-draft','madar.business.action.draft',{actionType:'sales_recovery_plan',payload:{source:'orby-os'}})]},['intelligence.analyze','business.action.draft'],['sales','risk','approval']);
 const inventory=definition('store.inventory-review','مراجعة المخزون','فحص المخزون وإنشاء توصيات دون كتابة خارجية.','store',{id:'inventory-sequence',type:'sequence',children:[action('inventory-search','madar.data.search',{entityType:'inventory'}),action('inventory-analyze','orby.intelligence.analyze',{detector:'inventory'})]},['data.read','intelligence.analyze'],['inventory','store']);
 const payments=definition('finance.overdue-payments-review','مراجعة المدفوعات المتأخرة','تحليل المتأخرات وصياغة مسودة متابعة.','finance',{id:'payments-sequence',type:'sequence',children:[action('payments-search','madar.data.search',{entityType:'payments',status:'overdue'}),{id:'payments-approval',type:'approval',scope:'manager',reason:'اعتماد مسودة متابعة المدفوعات.'},action('payments-draft','madar.business.action.draft',{actionType:'payment_followup',payload:{source:'orby-os'}})]},['data.read','business.action.draft'],['finance','payments','approval']);
 const student=definition('student.weekly-plan','الخطة الدراسية الأسبوعية','تجميع مهام الطالب وإعداد خطة داخلية قابلة للمراجعة.','student',{id:'student-sequence',type:'sequence',children:[action('student-search','madar.data.search',{entityType:'student_tasks'}),action('student-analyze','orby.intelligence.analyze',{purpose:'weekly_study_plan'})]},['data.read','intelligence.analyze'],['student','planning']);
 return[sales,inventory,payments,student].map(item=>({key:item.key,name:item.name,description:item.description,domain:item.domain,definition:item,enabled:true}));
}
