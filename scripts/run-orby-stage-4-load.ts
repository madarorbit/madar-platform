import assert from 'node:assert/strict';
import {OrbyFeatureFlagEngine} from '../src/lib/orby/os/governance';
import {OrbyMultiModelRouter,OrbyObservability} from '../src/lib/orby/os/operations';
import {OrbyPluginRegistry,builtinPluginManifests} from '../src/lib/orby/os/plugins';
import {builtinWorkflowTemplates,validateWorkflow} from '../src/lib/orby/os/workflow';

const started=performance.now(),template=builtinWorkflowTemplates()[0].definition;
for(let index=0;index<2000;index+=1)assert.equal(validateWorkflow({...template,key:`load.workflow-${index}`}).valid,true);
const models=Array.from({length:250},(_,index)=>({id:`model-${index}`,providerId:`provider-${index%10}`,providerModel:`m-${index}`,displayName:`Model ${index}`,enabled:true,priority:index%20,capabilities:{text:true},inputCostPerMillion:index/100,outputCostPerMillion:index/50,tags:index%2?['arabic']:['reasoning']}));
const router=new OrbyMultiModelRouter();for(let index=0;index<500;index+=1)assert.ok(router.select(models,{purpose:'load',requiredCapabilities:['text'],language:'ar',maxEstimatedCost:1}).model.id);
const flags=new OrbyFeatureFlagEngine([{key:'canary',enabled:true,scope:{environment:'production'},rolloutPercentage:25,configuration:{}}]);for(let index=0;index<10_000;index+=1)flags.resolve('canary',{identity:{organizationId:'org',userId:`user-${index}`},environment:'production',action:'read',permissions:['data.read']});
const plugins=new OrbyPluginRegistry();for(const manifest of builtinPluginManifests())plugins.register(manifest);for(let index=0;index<1000;index+=1)plugins.install('orby.business','1.0.0',{organizationId:`org-${index}`},{});assert.equal(plugins.installationsList().length,1000);
const traces=new OrbyObservability();for(let index=0;index<2000;index+=1){const trace=traces.startTrace({requestId:`r-${index}`,identity:{organizationId:'org',userId:'user'},operation:'load',metadata:{}});const span=traces.startSpan(trace.id,{name:'step',kind:'workflow'});traces.finishSpan(span.id,'succeeded');traces.finishTrace(trace.id,'succeeded');}assert.equal(traces.snapshot().traces.length,2000);
const elapsed=performance.now()-started;assert.ok(elapsed<15_000,`ORBY OS load suite exceeded budget: ${elapsed}ms`);console.log(`ORBY OS load suite: passed in ${Math.round(elapsed)}ms`);
