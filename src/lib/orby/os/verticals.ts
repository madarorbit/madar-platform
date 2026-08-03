import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyRiskLevel,OrbyToolExecutionType} from '../execution/contracts';

export type OrbyVerticalKey='commerce'|'food_service'|'hospitality'|'student'|'personal';
export type OrbyPlanLevel='BASIC'|'PREMIUM'|'FULL';
export type OrbySourceOfTruth='MADAR'|'EXTERNAL';
export type OrbyOperatingMode='MADAR_NATIVE'|'CONNECTED_EXTERNAL';
export type OrbySharedChannel='web'|'mobile'|'in_app';

export type OrbyVerticalToolDefinition={
 name:string;description:string;executionType:OrbyToolExecutionType;riskLevel:OrbyRiskLevel;
 requiredPermissions:readonly string[];requiredCapability:string;minimumPlan:OrbyPlanLevel;
 dataDomains:readonly string[];writeTargets:readonly OrbySourceOfTruth[];
};
export type OrbyVerticalPlugin={
 key:OrbyVerticalKey;version:string;name:string;description:string;
 terminology:Readonly<Record<string,string>>;kpis:readonly string[];tools:readonly OrbyVerticalToolDefinition[];
 permissions:readonly string[];safetyRules:readonly string[];knowledgeNamespaces:readonly string[];
};
export type OrbyVerticalContext={
 identity:OrbyIdentity;vertical:OrbyVerticalKey;plan:OrbyPlanLevel;operatingMode:OrbyOperatingMode;
 sourceOfTruth:OrbySourceOfTruth;connectorAuthorized:boolean;lastSyncedAt?:string;
 allowedWriteOperations:readonly string[];permissions:readonly string[];metadata?:OrbyJsonObject;
};
export type OrbyWriteDecision={allowed:boolean;reason:string;target:OrbySourceOfTruth;requiresApproval:boolean;stale:boolean;lastSyncedAt?:string};

const PLAN_WEIGHT:Record<OrbyPlanLevel,number>={BASIC:1,PREMIUM:2,FULL:3};
const tool=(input:OrbyVerticalToolDefinition)=>Object.freeze(input);

export const ORBY_COMMERCE_VERTICAL:OrbyVerticalPlugin=Object.freeze({
 key:'commerce',version:'2.0.0',name:'ORBY Commerce',description:'المبيعات والمخزون والمشتريات والعملاء والموردون ودورة الربح.',
 terminology:{sale:'عملية بيع',product:'منتج',inventory:'مخزون',purchase:'مشتريات',customer:'عميل',supplier:'مورد',profit:'ربح'},
 kpis:['revenue','gross_profit','gross_margin','inventory_turnover','stockout_rate','average_order_value','customer_retention'],
 permissions:['data.read','intelligence.analyze','business.action.draft','orby.execute'],
 safetyRules:['لا تعديل للأسعار أو المخزون خارج المصدر الأساسي.','أي كتابة مالية أو كمية تحتاج معاينة وموافقة صريحة.'],
 knowledgeNamespaces:['commerce','sales','inventory','purchases','customers','suppliers'],
 tools:[
  tool({name:'commerce.read',description:'قراءة بيانات التجارة.',executionType:'read',riskLevel:'low',requiredPermissions:['data.read'],requiredCapability:'vertical.read',minimumPlan:'BASIC',dataDomains:['sales','inventory','purchases','customers','suppliers'],writeTargets:[]}),
  tool({name:'commerce.analyze',description:'تحليل الأداء والربحية والمخزون.',executionType:'analysis',riskLevel:'low',requiredPermissions:['intelligence.analyze'],requiredCapability:'vertical.analysis',minimumPlan:'PREMIUM',dataDomains:['sales','inventory','profit'],writeTargets:[]}),
  tool({name:'commerce.execute',description:'تنفيذ إجراء تجاري معتمد.',executionType:'write',riskLevel:'medium',requiredPermissions:['orby.execute'],requiredCapability:'vertical.execute',minimumPlan:'FULL',dataDomains:['products','inventory','orders','customers'],writeTargets:['MADAR','EXTERNAL']}),
 ],
});

export const ORBY_FOOD_SERVICE_VERTICAL:OrbyVerticalPlugin=Object.freeze({
 key:'food_service',version:'2.0.0',name:'ORBY Food Service',description:'الوصفات والمكونات والهدر والطلبات والمطبخ وتكلفة وربحية الوجبة.',
 terminology:{sale:'طلب',product:'وجبة',inventory:'مكونات',purchase:'توريد',recipe:'وصفة',kitchen:'مطبخ',waste:'هدر',food_cost:'تكلفة الطعام'},
 kpis:['food_cost_percentage','recipe_margin','waste_rate','average_ticket','order_preparation_time','ingredient_stockout_rate'],
 permissions:['data.read','intelligence.analyze','business.action.draft','orby.execute'],
 safetyRules:['لا تغيير للوصفة أو الكمية أو حالة الطلب دون مصدر صحيح.','تعديل تكلفة أو سعر الوجبة يحتاج معاينة وموافقة.'],
 knowledgeNamespaces:['food_service','recipes','ingredients','kitchen','orders','waste'],
 tools:[
  tool({name:'food.read',description:'قراءة الوصفات والمكونات والطلبات.',executionType:'read',riskLevel:'low',requiredPermissions:['data.read'],requiredCapability:'vertical.read',minimumPlan:'BASIC',dataDomains:['recipes','ingredients','orders','kitchen'],writeTargets:[]}),
  tool({name:'food.analyze',description:'تحليل تكلفة وربحية الوجبات والهدر.',executionType:'analysis',riskLevel:'low',requiredPermissions:['intelligence.analyze'],requiredCapability:'vertical.analysis',minimumPlan:'PREMIUM',dataDomains:['recipes','ingredients','waste','profit'],writeTargets:[]}),
  tool({name:'food.execute',description:'تنفيذ إجراء مطعم معتمد.',executionType:'write',riskLevel:'medium',requiredPermissions:['orby.execute'],requiredCapability:'vertical.execute',minimumPlan:'FULL',dataDomains:['orders','recipes','ingredients','kitchen'],writeTargets:['MADAR','EXTERNAL']}),
 ],
});

export const ORBY_HOSPITALITY_VERTICAL:OrbyVerticalPlugin=Object.freeze({
 key:'hospitality',version:'2.0.0',name:'ORBY Hospitality',description:'الحجوزات والتوفر والإشغال والدخول والمغادرة والتنظيف والصيانة والحسابات.',
 terminology:{sale:'حجز',product:'غرفة',inventory:'توفر',customer:'نزيل',check_in:'دخول',check_out:'مغادرة',housekeeping:'تنظيف',occupancy:'إشغال'},
 kpis:['occupancy_rate','adr','revpar','room_availability','cancellation_rate','housekeeping_turnaround','maintenance_backlog'],
 permissions:['data.read','intelligence.analyze','business.action.draft','orby.execute'],
 safetyRules:['لا تعديل للحجز أو التوفر خارج المصدر الأساسي.','تغيير حالة الدخول أو المغادرة أو الغرفة يحتاج صلاحية وموافقة.'],
 knowledgeNamespaces:['hospitality','reservations','rooms','guests','housekeeping','maintenance'],
 tools:[
  tool({name:'hospitality.read',description:'قراءة الحجوزات والتوفر والإشغال.',executionType:'read',riskLevel:'low',requiredPermissions:['data.read'],requiredCapability:'vertical.read',minimumPlan:'BASIC',dataDomains:['reservations','rooms','availability','guests'],writeTargets:[]}),
  tool({name:'hospitality.analyze',description:'تحليل الإشغال والإيرادات والتشغيل.',executionType:'analysis',riskLevel:'low',requiredPermissions:['intelligence.analyze'],requiredCapability:'vertical.analysis',minimumPlan:'PREMIUM',dataDomains:['reservations','occupancy','revenue','housekeeping'],writeTargets:[]}),
  tool({name:'hospitality.execute',description:'تنفيذ إجراء فندقي معتمد.',executionType:'write',riskLevel:'high',requiredPermissions:['orby.execute'],requiredCapability:'vertical.execute',minimumPlan:'FULL',dataDomains:['reservations','rooms','housekeeping','maintenance'],writeTargets:['MADAR','EXTERNAL']}),
 ],
});

export const ORBY_STUDENT_VERTICAL:OrbyVerticalPlugin=Object.freeze({
 key:'student',version:'2.0.0',name:'ORBY Student',description:'عقد أوربي للحساب الطالب دون استبدال Student Space V1.3.',
 terminology:{task:'مهمة',schedule:'جدول',note:'ملاحظة',library:'مكتبة',course:'مقرر'},
 kpis:['task_completion','study_time','course_progress'],permissions:['data.read','intelligence.analyze'],
 safetyRules:['لا تنتقل ذاكرة التجارة إلى مساحة الطالب.','لا توجد أدوات مالية أو تجارية في هذا القطاع.'],
 knowledgeNamespaces:['student','academic','library'],
 tools:[tool({name:'student.read',description:'قراءة بيانات الطالب المسموح بها.',executionType:'read',riskLevel:'low',requiredPermissions:['data.read'],requiredCapability:'vertical.read',minimumPlan:'BASIC',dataDomains:['tasks','schedule','notes','library'],writeTargets:[]})],
});

export const ORBY_PERSONAL_VERTICAL:OrbyVerticalPlugin=Object.freeze({
 key:'personal',version:'2.0.0',name:'ORBY Personal',description:'مساعد شخصي معزول عن بيانات الأعمال.',
 terminology:{task:'مهمة',reminder:'تذكير',note:'ملاحظة'},kpis:['task_completion'],permissions:['data.read'],
 safetyRules:['لا وصول إلى ذاكرة أو بيانات مساحة تجارية.','لا أدوات تنفيذ أعمال أو موصلات.'],knowledgeNamespaces:['personal'],
 tools:[tool({name:'personal.read',description:'قراءة السياق الشخصي المسموح.',executionType:'read',riskLevel:'low',requiredPermissions:['data.read'],requiredCapability:'vertical.read',minimumPlan:'BASIC',dataDomains:['tasks','notes'],writeTargets:[]})],
});

export const BUILTIN_ORBY_VERTICALS:readonly OrbyVerticalPlugin[]=[ORBY_COMMERCE_VERTICAL,ORBY_FOOD_SERVICE_VERTICAL,ORBY_HOSPITALITY_VERTICAL,ORBY_STUDENT_VERTICAL,ORBY_PERSONAL_VERTICAL];

export class OrbyEntitlementEngine{
 canUse(plan:OrbyPlanLevel,minimum:OrbyPlanLevel){return PLAN_WEIGHT[plan]>=PLAN_WEIGHT[minimum];}
 assertTool(context:OrbyVerticalContext,toolDefinition:OrbyVerticalToolDefinition){
  if(!this.canUse(context.plan,toolDefinition.minimumPlan))throw new Error('ORBY_ENTITLEMENT_PLAN_DENIED');
  const missing=toolDefinition.requiredPermissions.filter(permission=>!context.permissions.includes(permission));
  if(missing.length)throw new Error(`ORBY_ENTITLEMENT_PERMISSION_DENIED:${missing.join(',')}`);
  return true;
 }
}

export class OrbyVerticalRegistry{
 private readonly plugins=new Map<OrbyVerticalKey,OrbyVerticalPlugin>();
 constructor(plugins:readonly OrbyVerticalPlugin[]=BUILTIN_ORBY_VERTICALS){for(const plugin of plugins)this.register(plugin);}
 register(plugin:OrbyVerticalPlugin){if(!/^\d+\.\d+\.\d+$/.test(plugin.version))throw new Error('ORBY_VERTICAL_VERSION_INVALID');if(this.plugins.has(plugin.key))throw new Error('ORBY_VERTICAL_EXISTS');this.plugins.set(plugin.key,Object.freeze({...plugin}));return this;}
 resolve(key:OrbyVerticalKey){const plugin=this.plugins.get(key);if(!plugin)throw new Error('ORBY_VERTICAL_NOT_FOUND');return plugin;}
 list(){return[...this.plugins.values()];}
 tools(context:OrbyVerticalContext){const plugin=this.resolve(context.vertical),entitlements=new OrbyEntitlementEngine();return plugin.tools.filter(item=>{try{return entitlements.assertTool(context,item);}catch{return false;}});}
 assertTool(context:OrbyVerticalContext,toolName:string){const toolDefinition=this.resolve(context.vertical).tools.find(item=>item.name===toolName);if(!toolDefinition)throw new Error('ORBY_VERTICAL_TOOL_NOT_AVAILABLE');new OrbyEntitlementEngine().assertTool(context,toolDefinition);return toolDefinition;}
}

export class OrbySourceOfTruthEngine{
 freshness(context:OrbyVerticalContext,maxAgeSeconds=900){if(!context.lastSyncedAt)return{stale:context.operatingMode==='CONNECTED_EXTERNAL',ageSeconds:null};const ageSeconds=Math.max(0,(Date.now()-Date.parse(context.lastSyncedAt))/1000);return{stale:ageSeconds>maxAgeSeconds,ageSeconds};}
 decideWrite(input:{context:OrbyVerticalContext;tool:OrbyVerticalToolDefinition;operation:string;target:OrbySourceOfTruth;requiresApproval?:boolean}):OrbyWriteDecision{
  const freshness=this.freshness(input.context),requiresApproval=input.requiresApproval??input.tool.executionType!=='read';
  if(input.tool.executionType==='read'||input.tool.executionType==='analysis')return{allowed:true,reason:'عملية قراءة أو تحليل لا تغيّر المصدر.',target:input.target,requiresApproval:false,stale:freshness.stale,lastSyncedAt:input.context.lastSyncedAt};
  if(!input.context.allowedWriteOperations.includes(input.operation))return{allowed:false,reason:'العملية ليست ضمن قائمة الكتابات المسموحة.',target:input.target,requiresApproval,stale:freshness.stale,lastSyncedAt:input.context.lastSyncedAt};
  if(!input.tool.writeTargets.includes(input.target))return{allowed:false,reason:'الأداة لا تدعم هدف الكتابة المطلوب.',target:input.target,requiresApproval,stale:freshness.stale,lastSyncedAt:input.context.lastSyncedAt};
  if(input.context.sourceOfTruth!==input.target)return{allowed:false,reason:'الكتابة مرفوضة لأن الهدف ليس المصدر الأساسي للبيانات.',target:input.target,requiresApproval,stale:freshness.stale,lastSyncedAt:input.context.lastSyncedAt};
  if(input.target==='EXTERNAL'&&(!input.context.connectorAuthorized||input.context.plan!=='FULL'))return{allowed:false,reason:'الكتابة الخارجية تحتاج باقة كاملة وموصلًا مخولًا.',target:input.target,requiresApproval,stale:freshness.stale,lastSyncedAt:input.context.lastSyncedAt};
  return{allowed:true,reason:'العملية ضمن المصدر الصحيح والاستحقاقات وقائمة الكتابات.',target:input.target,requiresApproval,stale:freshness.stale,lastSyncedAt:input.context.lastSyncedAt};
 }
 assertWrite(input:{context:OrbyVerticalContext;tool:OrbyVerticalToolDefinition;operation:string;target:OrbySourceOfTruth;requiresApproval?:boolean}){const decision=this.decideWrite(input);if(!decision.allowed)throw new Error(`ORBY_SOURCE_OF_TRUTH_DENIED:${decision.reason}`);return decision;}
}

export type OrbyContinuityState={
 conversationId:string;organizationId:string;workspaceId?:string;userId:string;channel:OrbySharedChannel;
 version:number;lastMessageId?:string;activeRunId?:string;updatedAt:string;metadata:OrbyJsonObject;
};
export class OrbyCrossDeviceContinuity{
 private readonly states=new Map<string,OrbyContinuityState>();
 save(identity:OrbyIdentity,state:Omit<OrbyContinuityState,'organizationId'|'workspaceId'|'userId'|'updatedAt'>){
  const existing=this.states.get(state.conversationId);if(existing&&(existing.organizationId!==identity.organizationId||existing.userId!==identity.userId||existing.workspaceId!==identity.workspaceId))throw new Error('ORBY_CONTINUITY_SCOPE_MISMATCH');
  if(existing&&state.version<=existing.version)throw new Error('ORBY_CONTINUITY_STALE_VERSION');
  const next:OrbyContinuityState={...state,organizationId:identity.organizationId,workspaceId:identity.workspaceId,userId:identity.userId,updatedAt:new Date().toISOString()};this.states.set(next.conversationId,next);return next;
 }
 resume(identity:OrbyIdentity,conversationId:string,channel:OrbySharedChannel){const state=this.states.get(conversationId);if(!state)throw new Error('ORBY_CONTINUITY_NOT_FOUND');if(state.organizationId!==identity.organizationId||state.userId!==identity.userId||state.workspaceId!==identity.workspaceId)throw new Error('ORBY_CONTINUITY_SCOPE_MISMATCH');return{...state,channel};}
}

export const ORBY_SHARED_API_CONTRACT=Object.freeze({version:'2.0.0',channels:['web','mobile','in_app'] as const,sharedResources:['conversations','messages','memory','approvals','workflow-runs','insights','citations'] as const,serverEnforced:['tenant-scope','permissions','entitlements','source-of-truth','approval-policy'] as const});
