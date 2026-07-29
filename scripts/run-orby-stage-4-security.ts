import assert from 'node:assert/strict';
import {redactOrbyValue} from '../src/lib/orby/core/runtime';
import {OrbyGovernanceEngine} from '../src/lib/orby/os/governance';
import {OrbyPluginRegistry} from '../src/lib/orby/os/plugins';
import {builtinWorkflowTemplates,validateWorkflow} from '../src/lib/orby/os/workflow';

const identity={organizationId:'org-a',userId:'user-a'},engine=new OrbyGovernanceEngine();
assert.equal(engine.decide({identity,environment:'production',action:'data.store.secret',permissions:[]}).effect,'deny');
assert.equal(engine.decide({identity,environment:'production',action:'tenant.cross_access',permissions:['data.read']}).effect,'deny');
assert.equal(engine.decide({identity,environment:'production',action:'channel.external.send',channelKey:'whatsapp',permissions:['channel.whatsapp']}).effect,'deny');
assert.equal(engine.decide({identity,environment:'production',action:'tool.execute',executionType:'external',riskLevel:'low',permissions:['data.read']}).effect,'deny');
assert.equal(engine.decide({identity,environment:'production',action:'tool.execute',executionType:'write',riskLevel:'critical',permissions:['data.read']}).effect,'require_approval');
assert.deepEqual(redactOrbyValue({apiKey:'secret',nested:{password:'hidden'},safe:'value'}),{apiKey:'[REDACTED]',nested:{password:'[REDACTED]'},safe:'value'});
const plugins=new OrbyPluginRegistry();assert.throws(()=>plugins.register({id:'evil',key:'evil.plugin',name:'Evil',description:'Dynamic',kind:'tool',version:'1.0.0',compatibleCore:'^1.0.0',entrypoint:'https://evil.invalid/plugin.js',permissions:[],tools:[],events:[],workflows:[],knowledgeSources:[],dependencies:{},requirements:[],isolation:'module',enabledByDefault:false}),/ORBY_PLUGIN_ENTRYPOINT_NOT_COMPILED/);
const base=builtinWorkflowTemplates()[0].definition;
assert.equal(validateWorkflow({...base,key:'security.unbounded-loop',root:{id:'loop',type:'loop',maxIterations:101,body:{id:'read',type:'action',toolName:'madar.data.search',input:{}}}}).valid,false);
assert.equal(validateWorkflow({...base,key:'security.parallel-overflow',root:{id:'parallel',type:'parallel',children:Array.from({length:11},(_,index)=>({id:`a${index}`,type:'action' as const,toolName:'madar.data.search',input:{}}))}}).valid,false);
console.log('ORBY OS security suite: 9/9 passed');
