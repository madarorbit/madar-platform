import {createHash,randomUUID} from 'node:crypto';
import type {OrbyContextRequest,OrbyContextSegment,OrbyIdentity,OrbyJsonObject,OrbyMessage,OrbySession,OrbySessionStore} from '../core/contracts';
import type {
 OrbyConversationSummarizer,OrbyConversationWindow,OrbyIntelligenceRepository,OrbyMemoryKind,OrbyMemoryPolicy,OrbyMemoryRecord,OrbyUserPreferences,
} from './contracts';

export const DEFAULT_MEMORY_POLICY:OrbyMemoryPolicy={
 enabled:false,allowConversationHistory:true,allowSummaries:true,allowShortTerm:true,allowLongTerm:false,allowPreferences:true,allowWorkspaceMemory:true,
 requireExplicitLongTermConsent:true,maximumConversationMessages:24,summaryTriggerMessages:30,shortTermTtlSeconds:60*60*24*7,
 maximumMemoriesPerScope:500,blockedKeys:['password','secret','token','api_key','credential','private_key'],
 blockedPatterns:['-----BEGIN PRIVATE KEY-----','Bearer ','sk-'],allowedSensitivities:['public','internal','sensitive'],
};

function now(){return new Date().toISOString();}
function clamp(value:number,min=0,max=1){return Math.min(max,Math.max(min,value));}
function checksum(value:string){return createHash('sha256').update(value).digest('hex');}
function containsBlocked(content:string,policy:OrbyMemoryPolicy){const lower=content.toLowerCase();return policy.blockedPatterns.some(pattern=>lower.includes(pattern.toLowerCase()));}
function memoryKey(kind:OrbyMemoryKind,key:string,content:string){return `${kind}:${key}:${checksum(content).slice(0,24)}`;}
function estimateCharacters(messages:readonly OrbyMessage[]){return messages.reduce((sum,message)=>sum+message.content.length,0);}

export class OrbyMemoryPolicyEngine {
 async resolve(repository:OrbyIntelligenceRepository,organizationId:string){const stored=await repository.resolveMemoryPolicy(organizationId);return {...DEFAULT_MEMORY_POLICY,...stored,blockedKeys:[...(stored.blockedKeys||DEFAULT_MEMORY_POLICY.blockedKeys)],blockedPatterns:[...(stored.blockedPatterns||DEFAULT_MEMORY_POLICY.blockedPatterns)],allowedSensitivities:[...(stored.allowedSensitivities||DEFAULT_MEMORY_POLICY.allowedSensitivities)]};}
 assertAllowed(input:{policy:OrbyMemoryPolicy;kind:OrbyMemoryKind;content:string;key:string;sensitivity:OrbyMemoryRecord['sensitivity'];explicitConsent?:boolean}){
  const {policy}=input;if(!policy.enabled)throw new Error('ORBY_MEMORY_DISABLED');
  const allowed={conversation_summary:policy.allowSummaries,short_term:policy.allowShortTerm,long_term:policy.allowLongTerm,preference:policy.allowPreferences,workspace:policy.allowWorkspaceMemory}[input.kind];
  if(!allowed)throw new Error('ORBY_MEMORY_KIND_DISABLED');
  if(!policy.allowedSensitivities.includes(input.sensitivity))throw new Error('ORBY_MEMORY_SENSITIVITY_BLOCKED');
  if(policy.blockedKeys.some(key=>input.key.toLowerCase().includes(key.toLowerCase()))||containsBlocked(input.content,policy))throw new Error('ORBY_MEMORY_CONTENT_BLOCKED');
  if(input.kind==='long_term'&&policy.requireExplicitLongTermConsent&&!input.explicitConsent)throw new Error('ORBY_MEMORY_CONSENT_REQUIRED');
 }
 retention(policy:OrbyMemoryPolicy,kind:OrbyMemoryKind,createdAt=Date.now()){
  const seconds=kind==='short_term'||kind==='conversation_summary'?policy.shortTermTtlSeconds:kind==='workspace'?policy.workspaceTtlSeconds:policy.longTermTtlSeconds;
  return seconds?new Date(createdAt+seconds*1000).toISOString():undefined;
 }
}

export class DeterministicConversationSummarizer implements OrbyConversationSummarizer {
 async summarize(input:{messages:readonly OrbyMessage[];previousSummary?:string;maxCharacters:number}){
  const lines=input.messages.map(message=>`${message.role==='user'?'المستخدم':'أوربي'}: ${message.content.replace(/\s+/g,' ').trim()}`).filter(line=>line.length>4);
  const combined=[input.previousSummary?.trim(),...lines].filter(Boolean).join('\n');
  if(combined.length<=input.maxCharacters)return combined;
  const head=Math.floor(input.maxCharacters*.35),tail=Math.max(0,input.maxCharacters-head-30);
  return `${combined.slice(0,head)}\n… تم اختصار السياق …\n${combined.slice(-tail)}`;
 }
}

export class OrbyConversationWindowManager {
 constructor(private readonly repository:OrbyIntelligenceRepository,private readonly summarizer:OrbyConversationSummarizer=new DeterministicConversationSummarizer()){}
 async build(identity:OrbyIdentity,sessionId:string,maxCharacters:number):Promise<OrbyConversationWindow>{
  const policy=await new OrbyMemoryPolicyEngine().resolve(this.repository,identity.organizationId);
  const messages=policy.allowConversationHistory?await this.repository.listConversationMessages(sessionId,Math.max(1,policy.maximumConversationMessages)):[];
  const summary=policy.allowSummaries?await this.repository.getConversationSummary(sessionId):null;
  const selected=[...messages];let used=estimateCharacters(selected)+(summary?.content.length||0),truncated=false;
  while(selected.length>1&&used>maxCharacters){selected.shift();used=estimateCharacters(selected)+(summary?.content.length||0);truncated=true;}
  return {messages:selected,summary:summary?.content,characterCount:used,truncated};
 }
 async summarize(identity:OrbyIdentity,sessionId:string,signal?:AbortSignal){
  const policyEngine=new OrbyMemoryPolicyEngine(),policy=await policyEngine.resolve(this.repository,identity.organizationId);
  if(!policy.enabled||!policy.allowSummaries)return null;
  const messages=await this.repository.listConversationMessages(sessionId,Math.max(policy.summaryTriggerMessages,policy.maximumConversationMessages)*2);
  if(messages.length<policy.summaryTriggerMessages)return null;
  const existing=await this.repository.getConversationSummary(sessionId),content=await this.summarizer.summarize({messages,previousSummary:existing?.content,maxCharacters:6000,signal});
  policyEngine.assertAllowed({policy,kind:'conversation_summary',content,key:`session:${sessionId}`,sensitivity:'internal'});
  return this.repository.saveMemory({
   id:existing?.id||randomUUID(),organizationId:identity.organizationId,userId:identity.userId,workspaceId:identity.workspaceId,sessionId,
   kind:'conversation_summary',key:memoryKey('conversation_summary',sessionId,content),content,summary:'ملخص سياق المحادثة',source:'conversation',
   sensitivity:'internal',confidence:1,importance:.75,metadata:{messageCount:messages.length},createdAt:existing?.createdAt||now(),updatedAt:now(),
   expiresAt:policyEngine.retention(policy,'conversation_summary'),lastAccessedAt:now(),
  });
 }
}

export class OrbyMemoryEngine {
 private readonly policies=new OrbyMemoryPolicyEngine();
 constructor(private readonly repository:OrbyIntelligenceRepository){}
 async setPolicy(identity:OrbyIdentity,policy:OrbyMemoryPolicy){return this.repository.setMemoryPolicy(identity.organizationId,identity.userId,policy);}
 async remember(input:{identity:OrbyIdentity;kind:Exclude<OrbyMemoryKind,'conversation_summary'>;key:string;content:string;source?:OrbyMemoryRecord['source'];sensitivity?:OrbyMemoryRecord['sensitivity'];confidence?:number;importance?:number;metadata?:OrbyJsonObject;explicitConsent?:boolean;sessionId?:string}){
  const policy=await this.policies.resolve(this.repository,input.identity.organizationId),content=input.content.trim();
  if(!content)throw new Error('ORBY_MEMORY_EMPTY');
  this.policies.assertAllowed({policy,kind:input.kind,content,key:input.key,sensitivity:input.sensitivity||'internal',explicitConsent:input.explicitConsent});
  const timestamp=now();
  return this.repository.saveMemory({
   id:randomUUID(),organizationId:input.identity.organizationId,userId:input.kind==='workspace'?undefined:input.identity.userId,workspaceId:input.identity.workspaceId,
   sessionId:input.sessionId,kind:input.kind,key:memoryKey(input.kind,input.key,content),content,source:input.source||'user',
   sensitivity:input.sensitivity||'internal',confidence:clamp(input.confidence??1),importance:clamp(input.importance??.5),
   metadata:input.metadata||{},createdAt:timestamp,updatedAt:timestamp,expiresAt:this.policies.retention(policy,input.kind),lastAccessedAt:timestamp,
  });
 }
 async retrieve(input:{identity:OrbyIdentity;query?:string;kinds?:readonly OrbyMemoryKind[];limit?:number}){
  const policy=await this.policies.resolve(this.repository,input.identity.organizationId);if(!policy.enabled)return [];
  const values=await this.repository.findMemories({identity:input.identity,query:input.query,kinds:input.kinds,limit:Math.min(50,Math.max(1,input.limit||12)),now:now()});
  return [...values].sort((a,b)=>(b.importance*b.confidence)-(a.importance*a.confidence)||Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
 }
 getPreferences(identity:OrbyIdentity){return this.repository.getPreferences(identity);}
 async setPreferences(identity:OrbyIdentity,preferences:OrbyUserPreferences){
  const policy=await this.policies.resolve(this.repository,identity.organizationId);if(!policy.enabled||!policy.allowPreferences)throw new Error('ORBY_PREFERENCES_DISABLED');
  await this.repository.setPreferences(identity,preferences);
 }
 cleanup(limit=500){return this.repository.expireMemories(now(),limit);}
}

export class OrbyMemoryContextSource {
 readonly key='orby.memory';readonly priority=88;
 constructor(private readonly memory:OrbyMemoryEngine){}
 async load(request:OrbyContextRequest):Promise<OrbyContextSegment|null>{
  const [memories,preferences]=await Promise.all([this.memory.retrieve({identity:request.identity,query:request.message,kinds:['long_term','short_term','preference','workspace'],limit:12}),this.memory.getPreferences(request.identity)]);
  if(!memories.length&&!preferences)return null;
  const preferenceText=preferences?`[PREFERENCES] ${JSON.stringify(preferences)}`:'';
  return {key:this.key,title:'ذاكرة أوربي المسموح بها',priority:this.priority,trusted:true,sensitive:true,
   content:[preferenceText,...memories.map((item,index)=>`[M${index+1}] ${item.kind}/${item.key}: ${item.content}`)].filter(Boolean).join('\n'),
   metadata:{memoryIds:memories.map(item=>item.id),preferencesIncluded:Boolean(preferences),policy:'allowed-scoped-memory'}};
 }
}

export class IntelligenceAwareSessionStore implements OrbySessionStore {
 private readonly windows:OrbyConversationWindowManager;
 constructor(private readonly base:OrbySessionStore,private readonly repository:OrbyIntelligenceRepository,summarizer?:OrbyConversationSummarizer){this.windows=new OrbyConversationWindowManager(repository,summarizer);}
 create(session:OrbySession){return this.base.create(session);}
 get(sessionId:string){return this.base.get(sessionId);}
 save(session:OrbySession){return this.base.save(session);}
 async listMessages(sessionId:string,limit:number){
  const session=await this.base.get(sessionId);if(!session)return this.base.listMessages(sessionId,limit);
  const window=await this.windows.build({organizationId:session.organizationId,userId:session.userId,workspaceId:session.workspaceId},sessionId,18000);
  const summary=window.summary?[{id:`summary:${sessionId}`,role:'assistant' as const,content:`ملخص المحادثة السابقة:\n${window.summary}`,createdAt:session.updatedAt,metadata:{synthetic:true,conversationSummary:true}}]:[];
  return [...summary,...window.messages].slice(-Math.max(1,limit));
 }
 async appendMessages(sessionId:string,messages:readonly OrbyMessage[]){
  await this.base.appendMessages(sessionId,messages);
  const session=await this.base.get(sessionId);if(session)await this.windows.summarize({organizationId:session.organizationId,userId:session.userId,workspaceId:session.workspaceId},sessionId).catch(()=>null);
 }
}
