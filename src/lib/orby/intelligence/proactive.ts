import {randomUUID} from 'node:crypto';
import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyTaskPlan,OrbyWorkflowNode} from '../execution/contracts';
import type {
 OrbyDeliveryChannel,OrbyDetectorInput,OrbyDetectorKey,OrbyDetectorSignal,OrbyInsight,OrbyIntelligenceEvent,OrbyIntelligenceJob,OrbyIntelligenceRepository,
 OrbyNotificationDeliveryAdapter,OrbyNotificationPreference,OrbyPeriodicReport,OrbyProactiveNotification,OrbyReportType,
} from './contracts';
import {OrbyDetectionEngine} from './analytics';

const severityWeight={info:0,low:1,medium:2,high:3,critical:4} as const;
function now(){return new Date().toISOString();}
function addSeconds(date:string,seconds:number){return new Date(Date.parse(date)+seconds*1000).toISOString();}
function json(value:unknown):OrbyJsonObject{return value&&typeof value==='object'&&!Array.isArray(value)?value as OrbyJsonObject:{value:String(value)};}
function defaultPreference(identity:OrbyIdentity):OrbyNotificationPreference{return{organizationId:identity.organizationId,userId:identity.userId,workspaceId:identity.workspaceId,enabled:true,channels:['in_app'],minimumSeverity:'medium',digestMode:'immediate',detectorSettings:{},cooldownMinutes:180,metadata:{source:'orby-default'}};}
function quiet(preference:OrbyNotificationPreference,date=new Date()){const hours=preference.quietHours;if(!hours)return false;const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:hours.timezone,hour:'2-digit',minute:'2-digit',hour12:false}),parts=formatter.formatToParts(date),clock=`${parts.find(p=>p.type==='hour')?.value}:${parts.find(p=>p.type==='minute')?.value}`;return hours.start<=hours.end?clock>=hours.start&&clock<hours.end:clock>=hours.start||clock<hours.end;}

export class OrbyPersistentEventBus {
 constructor(private readonly repository:OrbyIntelligenceRepository){}
 async publish(input:{identity:Pick<OrbyIdentity,'organizationId'|'workspaceId'>;type:string;payload?:OrbyJsonObject;priority?:number;deduplicationKey?:string;availableAt?:string}){const event:OrbyIntelligenceEvent={id:randomUUID(),organizationId:input.identity.organizationId,workspaceId:input.identity.workspaceId,type:input.type,priority:input.priority??100,payload:input.payload||{},deduplicationKey:input.deduplicationKey,occurredAt:now(),availableAt:input.availableAt||now()};await this.repository.publishEvent(event);return event;}
}

export class OrbyScheduler {
 constructor(private readonly repository:OrbyIntelligenceRepository){}
 enqueueDue(limit=100){return this.repository.enqueueDueSchedules(Math.min(500,Math.max(1,limit)));}
 enqueue(input:{identity:Pick<OrbyIdentity,'organizationId'|'workspaceId'>;type:OrbyIntelligenceJob['type'];payload?:OrbyJsonObject;priority?:number;availableAt?:string;maxAttempts?:number;idempotencyKey?:string}){return this.repository.enqueue({organizationId:input.identity.organizationId,workspaceId:input.identity.workspaceId,type:input.type,payload:input.payload||{},priority:input.priority??100,availableAt:input.availableAt||now(),maxAttempts:input.maxAttempts??6,idempotencyKey:input.idempotencyKey});}
}

export type OrbyEventRoute={eventType:string;jobType:OrbyIntelligenceJob['type'];priority?:number;payload?:(event:OrbyIntelligenceEvent)=>OrbyJsonObject};
export class OrbyEventRouter {
 private readonly routes=new Map<string,OrbyEventRoute[]>();
 constructor(private readonly repository:OrbyIntelligenceRepository,private readonly scheduler=new OrbyScheduler(repository)){}
 register(route:OrbyEventRoute){const values=this.routes.get(route.eventType)||[];values.push(route);this.routes.set(route.eventType,values);return this;}
 async route(event:OrbyIntelligenceEvent){const routes=this.routes.get(event.type)||[];for(const route of routes)await this.scheduler.enqueue({identity:{organizationId:event.organizationId,workspaceId:event.workspaceId},type:route.jobType,payload:route.payload?.(event)||event.payload,priority:route.priority??event.priority,idempotencyKey:`event:${event.id}:${route.jobType}`});await this.repository.markEventProcessed(event.id);return routes.length;}
 async routeDue(limit=100){const events=await this.repository.listDueEvents(limit),results=[];for(const event of events)results.push({eventId:event.id,routes:await this.route(event)});return results;}
 replay(event:OrbyIntelligenceEvent){return this.repository.publishEvent({...event,id:randomUUID(),processedAt:undefined,availableAt:now(),deduplicationKey:event.deduplicationKey?`${event.deduplicationKey}:replay:${Date.now()}`:undefined});}
}

export class OrbyNotificationEngine {
 private readonly adapters=new Map<OrbyDeliveryChannel,OrbyNotificationDeliveryAdapter>();
 constructor(private readonly repository:OrbyIntelligenceRepository,adapters:readonly OrbyNotificationDeliveryAdapter[]=[]){for(const adapter of adapters)this.adapters.set(adapter.channel,adapter);}
 register(adapter:OrbyNotificationDeliveryAdapter){this.adapters.set(adapter.channel,adapter);return this;}
 async publish(input:{identity:OrbyIdentity;insight:OrbyInsight;preference?:OrbyNotificationPreference|null}){
  const preference=input.preference??await this.repository.getNotificationPreferences(input.identity)??defaultPreference(input.identity);
  if(!preference.enabled||severityWeight[input.insight.severity]<severityWeight[preference.minimumSeverity]||preference.detectorSettings[input.insight.detector]===false)return [];
  const availableAt=quiet(preference)?addSeconds(now(),60*60):now(),channels=preference.digestMode==='immediate'?preference.channels:['in_app' as const],notifications:OrbyProactiveNotification[]=[];
  for(const channel of channels){const value:OrbyProactiveNotification={id:randomUUID(),organizationId:input.identity.organizationId,userId:input.identity.userId,workspaceId:input.identity.workspaceId,insightId:input.insight.id,channel,title:input.insight.title,body:`${input.insight.description}\nالثقة: ${Math.round(input.insight.confidence*100)}%`,severity:input.insight.severity,status:'queued',deduplicationKey:`insight:${input.insight.id}:${channel}:${input.insight.lastDetectedAt.slice(0,13)}`,availableAt,metadata:{detector:input.insight.detector,riskScore:input.insight.riskScore,opportunityScore:input.insight.opportunityScore},createdAt:now()};const saved=await this.repository.saveNotification(value);notifications.push(saved);if(channel==='in_app'&&Date.parse(availableAt)<=Date.now())await this.repository.updateNotification(saved.id,{status:'sent',sentAt:now()});}
  return notifications;
 }
 async deliver(notificationId:string,signal?:AbortSignal){const notification=await this.repository.getNotification(notificationId);if(!notification)throw new Error('ORBY_NOTIFICATION_NOT_FOUND');if(notification.status==='sent'||notification.status==='suppressed')return notification;if(Date.parse(notification.availableAt)>Date.now())throw new Error('ORBY_NOTIFICATION_NOT_DUE');if(notification.channel==='in_app'){await this.repository.updateNotification(notification.id,{status:'sent',sentAt:now()});return {...notification,status:'sent' as const,sentAt:now()};}const adapter=this.adapters.get(notification.channel);if(!adapter)throw new Error(`ORBY_NOTIFICATION_ADAPTER_UNAVAILABLE:${notification.channel}`);const delivered=await adapter.deliver(notification,signal);await this.repository.updateNotification(notification.id,{status:'sent',sentAt:now(),metadata:{...notification.metadata,...(delivered.metadata||{}),providerMessageId:delivered.providerMessageId||null}});return {...notification,status:'sent' as const,sentAt:now()};}
}

export class OrbyInsightEngine {
 constructor(private readonly repository:OrbyIntelligenceRepository,private readonly notifications:OrbyNotificationEngine){}
 async consume(identity:OrbyIdentity,signal:OrbyDetectorSignal,cooldownMinutes=180){const result=await this.repository.upsertInsight(signal,cooldownMinutes);if(!result.suppressed)await this.notifications.publish({identity,insight:result.insight});return result;}
 async consumeMany(identity:OrbyIdentity,signals:readonly OrbyDetectorSignal[],cooldownMinutes=180){return Promise.all(signals.map(signal=>this.consume(identity,signal,cooldownMinutes)));}
}

export interface OrbyAgentExecutionBridge {submit(input:{goal:string;identity:OrbyIdentity;reason:string;plan:OrbyTaskPlan;metadata?:OrbyJsonObject;signal?:AbortSignal}):Promise<{workflowId:string;runId:string;status:string}>;}
export class OrbyInsightActionPlanner {
 constructor(private readonly repository:OrbyIntelligenceRepository,private readonly bridge:OrbyAgentExecutionBridge){}
 plan(insight:OrbyInsight):OrbyTaskPlan{const actionNodes:OrbyWorkflowNode[]=insight.suggestedActions.filter(action=>action.toolName).map((action,index)=>{const base=action.input||{},input=action.toolName==='madar.business.action.draft'?{...base,payload:{...json(base.payload),insightId:insight.id}}:base;return{id:`action-${index+1}`,type:'action',toolName:action.toolName!,input,mode:action.riskLevel==='high'||action.riskLevel==='critical'?'sandbox':'production'};});const root:OrbyWorkflowNode={id:'proactive-sequence',type:'sequence',children:[{id:'owner-approval',type:'approval',scope:'user',reason:`مراجعة واعتماد الإجراءات المقترحة للـ Insight: ${insight.title}`,expiresInSeconds:60*60*24*7},...actionNodes]};return {id:randomUUID(),goal:`معالجة Insight: ${insight.title}`,summary:'خطة استباقية أعدها ORBY وتبدأ بموافقة صريحة قبل أي أداة.',root,toolNames:[...new Set(insight.suggestedActions.map(action=>action.toolName).filter((value):value is string=>Boolean(value)))],dependencies:actionNodes.map(node=>({from:'owner-approval',to:node.id})),riskLevel:insight.severity==='critical'?'critical':insight.severity==='high'?'high':'medium',terminalCondition:'اكتملت الإجراءات المعتمدة أو أُلغيت الخطة.',createdAt:now(),planner:'explicit',metadata:{source:'orby-stage-3',insightId:insight.id,requiresApproval:true}};}
 async prepare(input:{identity:OrbyIdentity;insightId:string;signal?:AbortSignal}){const insight=await this.repository.getInsight(input.insightId,input.identity);if(!insight)throw new Error('ORBY_INSIGHT_NOT_FOUND');if(!insight.suggestedActions.some(action=>action.toolName))throw new Error('ORBY_INSIGHT_HAS_NO_EXECUTABLE_DRAFTS');const plan=this.plan(insight);await this.repository.saveInsightWorkflow(insight.id,plan as unknown as OrbyJsonObject);const submitted=await this.bridge.submit({goal:plan.goal,identity:input.identity,reason:`إجراء مقترح من Insight ${insight.id}; لا ينفذ قبل الموافقة.`,plan,metadata:{insightId:insight.id,proactive:true},signal:input.signal});return {insight,plan,...submitted};}
}

export class OrbyPeriodicReportEngine {
 constructor(private readonly repository:OrbyIntelligenceRepository){}
 async generate(input:{identity:OrbyIdentity;type:OrbyReportType;periodStart:string;periodEnd:string}){const insights=await this.repository.listInsights({identity:input.identity,limit:100}),within=insights.filter(item=>Date.parse(item.lastDetectedAt)>=Date.parse(input.periodStart)&&Date.parse(item.lastDetectedAt)<=Date.parse(input.periodEnd));const risks=within.filter(item=>item.category==='risk'||item.category==='anomaly').sort((a,b)=>b.riskScore-a.riskScore),opportunities=within.filter(item=>item.category==='opportunity').sort((a,b)=>b.opportunityScore-a.opportunityScore);const report:Omit<OrbyPeriodicReport,'id'|'createdAt'|'updatedAt'>={organizationId:input.identity.organizationId,workspaceId:input.identity.workspaceId,type:input.type,periodStart:input.periodStart,periodEnd:input.periodEnd,title:`تقرير ORBY ${input.type}`,summary:`تم رصد ${within.length} Insight: ${risks.length} مخاطر أو شذوذ و${opportunities.length} فرص.`,sections:[{title:'أهم المخاطر',content:risks.slice(0,10).map(item=>`- ${item.title} (${item.riskScore}/100، ثقة ${Math.round(item.confidence*100)}%)`).join('\n')||'لا توجد مخاطر بارزة.',insightIds:risks.slice(0,10).map(item=>item.id)},{title:'أهم الفرص',content:opportunities.slice(0,10).map(item=>`- ${item.title} (${item.opportunityScore}/100، ثقة ${Math.round(item.confidence*100)}%)`).join('\n')||'لا توجد فرص بارزة.',insightIds:opportunities.slice(0,10).map(item=>item.id)},{title:'الإجراءات المقترحة',content:within.flatMap(item=>item.recommendations.map(value=>`- ${value}`)).slice(0,20).join('\n')||'لا توجد إجراءات مقترحة.',insightIds:within.map(item=>item.id)}],citations:within.flatMap(item=>item.evidence).slice(0,50),status:'ready'};return this.repository.saveReport(report);}
}

export type OrbyJobHandler=(job:OrbyIntelligenceJob)=>Promise<unknown>;
export class OrbyProactiveRuntime {
 private readonly handlers=new Map<OrbyIntelligenceJob['type'],OrbyJobHandler>();
 constructor(private readonly repository:OrbyIntelligenceRepository,private readonly detection:OrbyDetectionEngine,private readonly insights:OrbyInsightEngine,private readonly reports:OrbyPeriodicReportEngine,private readonly router=new OrbyEventRouter(repository)){}
 registerHandler(type:OrbyIntelligenceJob['type'],handler:OrbyJobHandler){this.handlers.set(type,handler);return this;}
 eventRouter(){return this.router;}
 async runDetectors(input:{identity:OrbyIdentity;keys?:readonly OrbyDetectorKey[];windowStart:string;windowEnd:string;configuration?:OrbyJsonObject}){const detectorInput:OrbyDetectorInput={identity:input.identity,windowStart:input.windowStart,windowEnd:input.windowEnd,now:now(),configuration:input.configuration||{}},signals=await this.detection.run(detectorInput,input.keys);return this.insights.consumeMany(input.identity,signals,Number(input.configuration?.cooldownMinutes||180));}
 async processJob(job:OrbyIntelligenceJob){const custom=this.handlers.get(job.type);if(custom)return custom(job);const identity:OrbyIdentity={organizationId:job.organizationId,userId:String(job.payload.userId||''),workspaceId:job.workspaceId};if(!identity.userId)throw new Error('ORBY_JOB_USER_REQUIRED');if(job.type==='detector.run')return this.runDetectors({identity,keys:job.payload.detectors as OrbyDetectorKey[]|undefined,windowStart:String(job.payload.windowStart||addSeconds(now(),-86400)),windowEnd:String(job.payload.windowEnd||now()),configuration:job.payload});if(job.type==='report.generate'){const type=String(job.payload.reportType||'daily') as OrbyReportType,duration={daily:86400,weekly:604800,monthly:2592000,executive:604800,workspace:86400}[type];return this.reports.generate({identity,type,periodStart:String(job.payload.periodStart||addSeconds(now(),-duration)),periodEnd:String(job.payload.periodEnd||now())});}throw new Error(`ORBY_JOB_HANDLER_MISSING:${job.type}`);}
 async processNext(workerId:string,limit=5){const jobs=await this.repository.claimJobs(workerId,limit,120),results:OrbyJsonObject[]=[];for(const job of jobs){try{const result=await this.processJob(job);await this.repository.completeJob(job.id,workerId,{ok:true,result:json(result)});results.push({jobId:job.id,status:'succeeded'});}catch(error){const delay=Math.min(3600,30*2**Math.max(0,job.attempts-1)),next=job.attempts>=job.maxAttempts?undefined:addSeconds(now(),delay);await this.repository.failJob(job.id,workerId,error instanceof Error?error.message.split(':')[0]:'ORBY_JOB_FAILED',error instanceof Error?error.message:'Unknown error',next);results.push({jobId:job.id,status:next?'retry':'dead'});}}return results;}
 async runCycle(workerId:string,limit=5){const scheduled=await this.repository.enqueueDueSchedules(100),events=await this.router.routeDue(100),processed=await this.processNext(workerId,limit);return{scheduled,routedEvents:events.length,processed};}
}
