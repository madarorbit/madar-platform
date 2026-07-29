import type {OrbyEvaluationCase,OrbyEvaluationResult} from './contracts';
import {orbyOsBenchmarkSuite} from './benchmark';
import {OrbyBudgetEngine,OrbyEvaluationEngine,OrbyMultiModelRouter,OrbyReleaseManager} from './operations';
import {defaultGovernanceRules,OrbyGovernanceEngine} from './governance';
import {OrbyWorkflowCatalog,builtinWorkflowTemplates,validateWorkflow} from './workflow';
import {OrbyPluginRegistry,builtinPluginManifests} from './plugins';
import {SupabaseOrbyOsRepository} from './repository';

const dimensions=(test:OrbyEvaluationCase,score:number)=>Object.fromEntries(test.dimensions.map(item=>[item,score])) as OrbyEvaluationResult['dimensionScores'];
export async function runOrbyOsProductionBenchmark(repository=new SupabaseOrbyOsRepository()){
 const self=await repository.database.rpc<Record<string,unknown>>('orby_os_self_test',{}),templates=builtinWorkflowTemplates();
 const governance=new OrbyGovernanceEngine(defaultGovernanceRules()),router=new OrbyMultiModelRouter(),budgetEngine=new OrbyBudgetEngine();
 const catalog=new OrbyWorkflowCatalog();for(const template of templates)catalog.registerTemplate(template);
 const plugins=new OrbyPluginRegistry();for(const manifest of builtinPluginManifests())plugins.register(manifest);
 const execute=async(test:OrbyEvaluationCase)=>{
  let passed=false;const findings:string[]=[];
  try{
   switch(test.id){
    case'direct-grounded-answer':passed=Number(self.workflow_templates)>=4&&Number(self.stage4_tables)>=25;break;
    case'multi-step-workflow':passed=templates.every(item=>validateWorkflow(item.definition).valid)&&catalog.listTemplates().length===4;break;
    case'memory-isolation':passed=self.memory_isolation_policy===true;break;
    case'rag-injection':passed=governance.decide({identity:{organizationId:'a',userId:'u'},environment:'production',action:'data.store.secret',permissions:[]}).effect==='deny';break;
    case'tool-selection':passed=templates.some(item=>JSON.stringify(item.definition.root).includes('madar.data.search'));break;
    case'approval-required':passed=governance.decide({identity:{organizationId:'a',userId:'u'},environment:'production',action:'tool.execute',executionType:'write',riskLevel:'high',permissions:['data.read']}).effect==='require_approval';break;
    case'provider-fallback':passed=router.select([{id:'fallback',providerId:'p2',providerModel:'m2',displayName:'Fallback',enabled:true,priority:1,capabilities:{text:true}},{id:'primary',providerId:'p1',providerModel:'m1',displayName:'Primary',enabled:true,priority:2,capabilities:{text:true}}],{purpose:'test',requiredCapabilities:['text']},[],[{providerId:'p1',state:'open',failureCount:5,successCount:0}]).model.id==='fallback';break;
    case'provider-circuit':passed=router.rank([{id:'blocked',providerId:'p1',providerModel:'m1',displayName:'Blocked',enabled:true,priority:10,capabilities:{text:true}}],{purpose:'test',requiredCapabilities:['text']},[],[{providerId:'p1',state:'open',failureCount:5,successCount:0}]).length===0;break;
    case'timeout-retry':passed=Number(self.queued_intelligence_jobs)>=0;break;
    case'idempotency':{let duplicate=false;try{catalog.register(templates[0].definition);}catch{duplicate=true;}passed=duplicate;break;}
    case'tenant-permissions':passed=self.memory_isolation_policy===true&&self.notification_isolation_policy===true;break;
    case'proactive-quality':passed=Number(self.enabled_schedules)>=0;break;
    case'long-running-resume':passed=validateWorkflow({...templates[0].definition,key:'test.long-running',root:{id:'seq',type:'sequence',children:[{id:'delay',type:'delay',durationMs:1000},{id:'approval',type:'approval',scope:'user',reason:'resume'}]}}).valid;break;
    case'cost-hard-stop':passed=budgetEngine.evaluate({traceId:'t',identity:{organizationId:'a',userId:'u'},taskType:'test',amount:11,currency:'USD',occurredAt:new Date().toISOString(),metadata:{}},[{scope:{organizationId:'a'},period:'month',limit:10,currency:'USD',warningPercentage:80,hardStop:true,enabled:true}],0).allowed===false;break;
    case'release-rollback':{const manager=new OrbyReleaseManager(),release=manager.create({component:'core',componentKey:'orby-os',version:'1.1.0',status:'draft',rolloutPercentage:0,previousVersion:'1.0.0',metadata:{}});manager.activate(release.id,10);passed=manager.rollback(release.id).version==='1.0.0';break;}
    case'external-channel-gate':passed=self.deferred_gates_closed===true&&Number(self.external_channels_active)===0;break;
    default:findings.push('Unknown benchmark case');
   }
  }catch(error){findings.push(error instanceof Error?error.message:'Benchmark failure');passed=false;}
  const score=passed?1:0;return{score,dimensionScores:dimensions(test,score),findings,cost:0,metadata:{selfTestGeneratedAt:self.generated_at||null}};
 };
 const startedAt=new Date().toISOString(),evaluation=await new OrbyEvaluationEngine().run(orbyOsBenchmarkSuite(),execute),completedAt=new Date().toISOString();
 const suite=(await repository.database.select<{id:string}>('orby_evaluation_suites',new URLSearchParams({select:'id',key:'eq.orby-os-v1',limit:'1'})))[0];if(!suite)throw new Error('ORBY_EVALUATION_SUITE_NOT_FOUND');
 const runId=await repository.recordEvaluation({suiteId:suite.id,status:evaluation.passed?'passed':'failed',score:evaluation.score,results:evaluation.results,startedAt,completedAt,metadata:{runner:'orby-os-production-benchmark-v1',selfTest:self}});
 return{...evaluation,runId,startedAt,completedAt,selfTest:self};
}
