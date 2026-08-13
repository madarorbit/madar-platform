import assert from 'node:assert/strict';
import type {OrbyModelDescriptor,OrbyRuntimeConfiguration} from '../src/lib/orby/core/contracts';
import {createOrbyFoundation} from '../src/lib/orby';
import {MockOrbyProvider} from '../src/lib/orby/providers/mock';

async function main(){
 const provider=new MockOrbyProvider({
  id:'mock',
  generate:request=>({text:`MODEL:${request.model}`,finishReason:'stop',usage:{inputTokens:10,outputTokens:5,totalTokens:15}}),
 });
 const models:OrbyModelDescriptor[]=[
  {
   id:'fast',providerId:'mock',providerModel:'fast-provider-model',displayName:'Fast model',enabled:true,priority:100,
   capabilities:{text:true,streaming:true,json:true},inputCostPerMillion:0.1,outputCostPerMillion:0.5,
   metadata:{routing:{quality:4,speed:5,reasoning:2,costEfficiency:5,reliability:4,privacy:5,preferredFor:['information','conversation'],minComplexity:0,highComplexityBoost:0}},
  },
  {
   id:'deep',providerId:'mock',providerModel:'deep-provider-model',displayName:'Deep model',enabled:true,priority:80,
   capabilities:{text:true,streaming:true,json:true},inputCostPerMillion:5,outputCostPerMillion:20,
   metadata:{routing:{quality:5,speed:2.5,reasoning:5,costEfficiency:2,reliability:5,privacy:5,preferredFor:['analysis','report'],minComplexity:0.5,highComplexityBoost:1.5}},
  },
 ];
 const configuration={
  enabled:true,
  defaultModelId:'fast',
  allowedProviderIds:['mock'],
  allowedModelIds:['fast','deep'],
  modelSelectionMode:'orby-intelligence-router-v1',
  intelligentRouting:{enabled:true,allowModelSwitching:true,sensitivityAware:true,restrictedPrivacyFloor:4.3},
 } as Partial<OrbyRuntimeConfiguration>;
 const foundation=createOrbyFoundation({providers:[provider],models,configuration});
 const identity={organizationId:'00000000-0000-4000-8000-000000000001',userId:'00000000-0000-4000-8000-000000000002',workspaceId:'00000000-0000-4000-8000-000000000003'};

 const first=await foundation.kernel.execute({identity,message:'كم عدد الطلبات اليوم؟',metadata:{intent:'information',sensitivity:'normal'}});
 assert.equal(first.modelId,'fast');
 assert.match(first.text,/MODEL:fast-provider-model/);

 const second=await foundation.kernel.execute({identity,sessionId:first.sessionId,message:'حلل أسباب تراجع الربحية وقارن المؤشرات ثم استخرج المخاطر.',metadata:{intent:'analysis',sensitivity:'normal'}});
 assert.equal(second.modelId,'deep');
 assert.match(second.text,/MODEL:deep-provider-model/);
 assert.equal(second.sessionId,first.sessionId);

 const history=await foundation.sessions.history(first.sessionId,20);
 assert.equal(history.length,4);
 assert.equal(history[1]?.metadata?.modelId,'fast');
 assert.equal(history[3]?.metadata?.modelId,'deep');
 assert.equal(history[1]?.metadata?.routingMode,'intelligent');
 assert.equal(history[3]?.metadata?.routingMode,'intelligent');

 console.log('ORBY_INTELLIGENCE_ROUTER_OK',{sessionId:first.sessionId,firstModel:first.modelId,secondModel:second.modelId,historyMessages:history.length});
}

main().catch(error=>{console.error(error);process.exitCode=1;});
