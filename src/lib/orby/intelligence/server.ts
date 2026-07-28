import 'server-only';
import type {OrbyIdentity,OrbyJsonObject,OrbyModelDescriptor,OrbyProvider} from '../core/contracts';
import {createServerOrbyFoundation} from '../server';
import {createServerOrbyAgentRuntime} from '../execution/server';
import type {OrbyTaskPlan} from '../execution/contracts';
import {SupabaseOrbyMembershipResolver} from '../execution/adapters/supabase';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {orbyOcrConfig} from '@/src/lib/env';
import {createEmbeddingService} from './embedding';
import {HttpOcrService,OcrTextExtractor,OrbyKnowledgeEngine} from './knowledge';
import {OrbyConversationWindowManager,OrbyMemoryEngine} from './memory';
import {OrbyRagEngine,type OrbyRagAnswerModel} from './rag';
import {createStandardDetectors} from './analytics';
import {OrbyInsightActionPlanner,OrbyInsightEngine,OrbyNotificationEngine,OrbyPeriodicReportEngine,OrbyPersistentEventBus,OrbyProactiveRuntime,OrbyScheduler,type OrbyAgentExecutionBridge} from './proactive';
import {SupabaseOrbyBusinessMetricReader} from './adapters/metrics';
import {SupabaseOrbyIntelligenceRepository} from './adapters/supabase';

class KernelRagAnswerModel implements OrbyRagAnswerModel {
 constructor(private readonly foundation:Awaited<ReturnType<typeof createServerOrbyFoundation>>){}
 async answer(input:{identity:OrbyIdentity;question:string;context:Parameters<OrbyRagAnswerModel['answer']>[0]['context'];signal?:AbortSignal}):Promise<{text:string;metadata?:OrbyJsonObject}>{const sources=input.context.citations.map(citation=>`[${citation.label}] ${citation.title}`).join('\n');try{const response=await this.foundation.kernel.execute({identity:input.identity,message:`أجب عن السؤال اعتمادًا حصراً على السياق المسترجع أدناه. ضع استشهادًا [S1] أو [S2] بعد كل معلومة مستندة إلى المصدر. إذا لم يكف السياق، صرّح بذلك. لا تخترع مصدرًا.\n\nالسؤال:\n${input.question}\n\nالسياق:\n${input.context.text}\n\nالمصادر المتاحة:\n${sources}`,requiredCapabilities:['text'],signal:input.signal,metadata:{purpose:'rag-answer',requiresCitations:true}});return{text:response.text,metadata:{sessionId:response.sessionId,providerId:response.providerId,modelId:response.modelId} as OrbyJsonObject};}catch{const excerpts=input.context.citations.slice(0,4).map(citation=>`${citation.excerpt} [${citation.label}]`).join('\n\n');return{text:`تعذر استخدام النموذج اللغوي حاليًا، وهذه أبرز المعلومات المسترجعة من المصادر:\n\n${excerpts}`,metadata:{fallback:'extractive'} as OrbyJsonObject};}}
}
class AgentExecutionBridge implements OrbyAgentExecutionBridge {
 async submit(input:{goal:string;identity:OrbyIdentity;reason:string;plan:OrbyTaskPlan;metadata?:OrbyJsonObject;signal?:AbortSignal}){const {runtime}=await createServerOrbyAgentRuntime(),submitted=await runtime.submit(input);return{workflowId:submitted.workflow.id,runId:submitted.run.id,status:submitted.run.status};}
}
function identity(job:{organizationId:string;workspaceId?:string;payload:OrbyJsonObject}):OrbyIdentity{const userId=String(job.payload.userId||'');if(!userId)throw new Error('ORBY_JOB_USER_REQUIRED');return{organizationId:job.organizationId,userId,workspaceId:job.workspaceId};}

let promise:ReturnType<typeof build>|undefined;
async function build(){
 const database=new IntegrationDatabase(),repository=new SupabaseOrbyIntelligenceRepository(database),foundation=await createServerOrbyFoundation(),memberships=new SupabaseOrbyMembershipResolver(database);
 const providers=foundation.providers.list(),models=foundation.models.list({enabledOnly:true}),embeddings=createEmbeddingService(providers as readonly OrbyProvider[],models as readonly OrbyModelDescriptor[]),knowledge=new OrbyKnowledgeEngine(repository,embeddings);
 const ocr=orbyOcrConfig();if(ocr)knowledge.registerExtractor(new OcrTextExtractor(new HttpOcrService(ocr.endpoint,ocr.apiKey)));
 const memory=new OrbyMemoryEngine(repository),windows=new OrbyConversationWindowManager(repository),rag=new OrbyRagEngine(knowledge,new KernelRagAnswerModel(foundation));
 const notifications=new OrbyNotificationEngine(repository),insights=new OrbyInsightEngine(repository,notifications),reports=new OrbyPeriodicReportEngine(repository),detection=createStandardDetectors(new SupabaseOrbyBusinessMetricReader(database));
 const proactive=new OrbyProactiveRuntime(repository,detection,insights,reports),scheduler=new OrbyScheduler(repository),events=new OrbyPersistentEventBus(repository),actions=new OrbyInsightActionPlanner(repository,new AgentExecutionBridge());
 proactive.eventRouter()
  .register({eventType:'integration.sync.completed',jobType:'detector.run',priority:60,payload:event=>({...event.payload,windowEnd:event.occurredAt})})
  .register({eventType:'udm.updated',jobType:'detector.run',priority:70,payload:event=>({...event.payload,windowEnd:event.occurredAt})})
  .register({eventType:'business.data.changed',jobType:'detector.run',priority:70,payload:event=>({...event.payload,windowEnd:event.occurredAt})});
 proactive
  .registerHandler('knowledge.extract',async job=>knowledge.reindex({identity:identity(job),documentId:String(job.payload.documentId||'')}))
  .registerHandler('knowledge.embed',async job=>knowledge.reindex({identity:identity(job),documentId:String(job.payload.documentId||'')}))
  .registerHandler('memory.summarize',async job=>windows.summarize(identity(job),String(job.payload.sessionId||'')))
  .registerHandler('notification.deliver',async job=>notifications.deliver(String(job.payload.notificationId||'')))
  .registerHandler('retention.cleanup',async()=>({expired:await memory.cleanup(1000)}));
 return{database,repository,foundation,memberships,embeddings,knowledge,memory,windows,rag,notifications,insights,reports,detection,proactive,scheduler,events,actions};
}
export function createServerOrbyIntelligence(){if(!promise)promise=build();return promise;}
export * from './index';
