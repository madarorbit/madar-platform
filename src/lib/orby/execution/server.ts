import 'server-only';
import type {OrbyIdentity} from '../core/contracts';
import {MadarIntegrationContextSource} from '../adapters/integration';
import {createServerOrbyFoundation} from '../server';
import type {OrbyPlanningModel,OrbyToolManifest} from './contracts';
import {CompositeTaskPlanner,ManifestTaskPlanner,ModelTaskPlanner,createOrbyAgentRuntime} from './engine';
import {InMemoryExecutionEventBus} from './memory';
import {OrbyPermissionEngine,OrbyPolicyEngine} from './governance';
import {OrbyToolLoader,OrbyToolRegistry} from './tools';
import {MADAR_EXECUTION_TOOL_MANIFESTS,createMadarExecutionTools} from './builtin-tools';
import {SupabaseMadarIntegrationContextReader,SupabaseMadarToolGateway,SupabaseOrbyExecutionQueue,SupabaseOrbyExecutionRepository,SupabaseOrbyMembershipResolver} from './adapters/supabase';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {attachOrbyOsObservability} from '../os/observability-bridge';
import {createOrbyOsExecutionPolicyRules,type OrbyOsExecutionPolicyRow} from '../os/execution-policy';

class KernelPlanningModel implements OrbyPlanningModel {
 constructor(private readonly kernel:Awaited<ReturnType<typeof createServerOrbyFoundation>>['kernel']){}
 async generatePlan(input:{goal:string;identity:OrbyIdentity;reason:string;tools:readonly OrbyToolManifest[];signal?:AbortSignal}){const toolSummary=input.tools.map(tool=>({name:tool.name,description:tool.description,category:tool.category,operation:tool.operation,riskLevel:tool.riskLevel,inputSchema:tool.inputSchema,requiredPermissions:tool.requiredPermissions}));const response=await this.kernel.execute({identity:input.identity,message:`أنت مخطط مهام ORBY فقط. لا تنفذ أي أداة ولا تدّع التنفيذ. حوّل الهدف إلى خطة JSON صالحة وتستخدم حصراً أسماء الأدوات المرفقة.\n\nالهدف: ${input.goal}\nسبب التنفيذ: ${input.reason}\nالأدوات: ${JSON.stringify(toolSummary)}\n\nأعد كائن JSON فقط بهذه الحقول: id، goal، summary، root، toolNames، dependencies، riskLevel، terminalCondition، createdAt، planner. root عقدة من الأنواع action أو sequence أو parallel أو condition أو loop أو delay أو approval أو event. كل action يجب أن يحمل id وtype=action وtoolName وinput. لا تضف أداة غير موجودة، ولا تضع بيانات سرية، ولا تتجاوز الموافقات.`,requiredCapabilities:['text'],signal:input.signal,metadata:{purpose:'agent-planning',noToolExecution:true}});return response.text;}
}
let serverRuntimePromise:ReturnType<typeof buildServerRuntime>|undefined;
async function buildServerRuntime(){
 const database=new IntegrationDatabase(),repository=new SupabaseOrbyExecutionRepository(database),queue=new SupabaseOrbyExecutionQueue(database),memberships=new SupabaseOrbyMembershipResolver(database),events=new InMemoryExecutionEventBus(),contextReader=new SupabaseMadarIntegrationContextReader(database);
 const foundation=await createServerOrbyFoundation({database,contextSources:[new MadarIntegrationContextSource(contextReader)]});
 const gateway=new SupabaseMadarToolGateway(database,async input=>{const response=await foundation.kernel.execute({identity:input.identity,sessionId:input.sessionId,message:input.prompt,requiredCapabilities:['text'],signal:input.signal,metadata:{purpose:'agent-tool-analysis',toolsDisabled:true}});return{text:response.text,sessionId:response.sessionId,providerId:response.providerId,modelId:response.modelId};});
 await repository.syncToolCatalog(MADAR_EXECUTION_TOOL_MANIFESTS);
 const enabledNames=await repository.enabledToolNames(),registry=new OrbyToolRegistry();await new OrbyToolLoader(registry).load(createMadarExecutionTools(gateway,enabledNames).map(tool=>()=>tool));
 const osPolicyRows=await database.select<OrbyOsExecutionPolicyRow>('orby_governance_policies',new URLSearchParams({select:'id,key,organization_id,workspace_id,priority,enabled,effect,approval_scope,conditions,limits,description',enabled:'eq.true',order:'priority.desc'}));
 const manifestPlanner=new ManifestTaskPlanner(registry),planner=new CompositeTaskPlanner([new ModelTaskPlanner(new KernelPlanningModel(foundation.kernel),registry),manifestPlanner]),permissions=new OrbyPermissionEngine(memberships),runtime=createOrbyAgentRuntime({planner,registry,repository,queue,permissions,policies:new OrbyPolicyEngine(createOrbyOsExecutionPolicyRules(osPolicyRows)),events});
 attachOrbyOsObservability(events);return{runtime,foundation,repository,queue,registry,events};
}
export function createServerOrbyAgentRuntime(){if(!serverRuntimePromise)serverRuntimePromise=buildServerRuntime();return serverRuntimePromise;}
export * from './index';
export * from './adapters/supabase';
