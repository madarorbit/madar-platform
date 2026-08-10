import type {DashboardSnapshot,MobileAction,MobileActionType,OrbyConversation,OrbyMessage,OrbyMode,OrbyStreamEvent} from '@/types';

const apiBase=(process.env.EXPO_PUBLIC_MADAR_API_URL||'https://www.orbitmadar.com').replace(/\/$/,'');

export class MadarApiError extends Error{
 constructor(message:string,readonly status:number,readonly code?:string){super(message);this.name='MadarApiError';}
}

async function request<T>(path:string,accessToken:string,init:RequestInit={},retry=true):Promise<T>{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20_000),headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${accessToken}`);headers.set('Accept','application/json');if(init.body)headers.set('Content-Type','application/json');
 try{
  const response=await fetch(`${apiBase}${path}`,{...init,headers,signal:init.signal||controller.signal}),raw=await response.text();let payload:unknown=null;
  if(raw.trim()){try{payload=JSON.parse(raw);}catch{throw new MadarApiError('أعاد الخادم استجابة غير صالحة.',response.status,'INVALID_RESPONSE');}}
  if(!response.ok){const record=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};throw new MadarApiError(String(record.error||(response.status===401?'انتهت جلسة تسجيل الدخول.':'تعذر الاتصال بمَدار الآن.')),response.status,typeof record.code==='string'?record.code:undefined);}
  return payload as T;
 }catch(error){
  if(error instanceof MadarApiError)throw error;
  if(retry&&(init.method===undefined||init.method==='GET')){await new Promise(resolve=>setTimeout(resolve,450));return request<T>(path,accessToken,init,false);}
  throw new MadarApiError(error instanceof Error&&error.name==='AbortError'?'انتهت مهلة الاتصال بمَدار.':'تعذر الوصول إلى مَدار. تحقق من الشبكة.',0,'NETWORK_ERROR');
 }finally{clearTimeout(timeout);}
}

export function fetchDashboard(accessToken:string,workspaceId?:string|null){return request<DashboardSnapshot>(`/api/mobile/v1/dashboard${workspaceId?`?workspaceId=${encodeURIComponent(workspaceId)}`:''}`,accessToken);}
export function fetchActions(accessToken:string,organizationId:string){return request<{ok:true;actions:MobileAction[]}>(`/api/mobile/v2/actions?organizationId=${encodeURIComponent(organizationId)}`,accessToken);}
export function previewAction(accessToken:string,input:{organizationId:string;actionType:MobileActionType;entityId:string;status:string;idempotencyKey:string;connectionId?:string|null}){return request<{ok:true;action:MobileAction}>('/api/mobile/v2/actions',accessToken,{method:'POST',body:JSON.stringify(input)});}
export function decideAction(accessToken:string,actionId:string,decision:'confirmed'|'rejected'){return request<{ok:true;action:MobileAction}>(`/api/mobile/v2/actions/${encodeURIComponent(actionId)}`,accessToken,{method:'POST',body:JSON.stringify({decision})});}

export function fetchConversations(accessToken:string,organizationId:string,includeArchived=false){return request<{ok:true;conversations:OrbyConversation[]}>(`/api/orby/conversations?organizationId=${encodeURIComponent(organizationId)}&includeArchived=${includeArchived}`,accessToken);}
export function fetchConversation(accessToken:string,organizationId:string,conversationId:string){return request<{ok:true;conversation:OrbyConversation;messages:OrbyMessage[]}>(`/api/orby/conversations/${encodeURIComponent(conversationId)}?organizationId=${encodeURIComponent(organizationId)}`,accessToken);}
export function mutateConversation(accessToken:string,organizationId:string,conversationId:string,input:{action:'rename'|'archive'|'restore';title?:string}){return request<{ok:true}>(`/api/orby/conversations`,accessToken,{method:'PATCH',body:JSON.stringify({organizationId,conversationId,...input})});}
export function deleteConversation(accessToken:string,organizationId:string,conversationId:string){return request<{ok:true}>(`/api/orby/conversations?organizationId=${encodeURIComponent(organizationId)}&conversationId=${encodeURIComponent(conversationId)}`,accessToken,{method:'DELETE'});}

type WireOrbyEvent=
 |{type:'status';stage:string;label:string}
 |{type:'start';requestId:string;sessionId:string;providerId:string;modelId:string}
 |{type:'delta';text:string}
 |{type:'usage';usage:Record<string,unknown>}
 |{type:'citations';items:Array<{label:string;source:string;href?:string;lastSyncedAt?:string;certainty:'confirmed'|'estimated'}>}
 |{type:'dialogue';decision:{intent:string;operation:string;strategy:string;requiresClarification:boolean;clarificationQuestion?:string}}
 |{type:'complete';conversationId:string;remaining:number;source:'ai'|'smart-fallback'}
 |{type:'error';code:string;message:string;retryable:boolean};

function emitWireEvent(event:WireOrbyEvent,onEvent:(event:OrbyStreamEvent)=>void){
 if(event.type==='status')onEvent({type:'stage',stage:event.stage,label:event.label});
 else if(event.type==='delta')onEvent(event);
 else if(event.type==='citations')onEvent({type:'citations',citations:event.items.map((item,index)=>({id:`citation-${index}-${item.lastSyncedAt||'current'}`,label:item.label,source:item.source,href:item.href||'/workspace/analytics',observedAt:item.lastSyncedAt||new Date().toISOString(),freshness:item.certainty==='estimated'?'estimated':'recent',certainty:item.certainty}))});
 else if(event.type==='dialogue')onEvent({type:'intent',intent:event.decision.intent,operation:event.decision.operation,strategy:event.decision.strategy,needsClarification:event.decision.requiresClarification,clarificationQuestion:event.decision.clarificationQuestion});
 else if(event.type==='complete')onEvent({type:'end',conversationId:event.conversationId,remaining:event.remaining,source:event.source});
 else if(event.type==='error')onEvent({type:'error',code:event.code,message:event.message,recoverable:event.retryable});
}

function parseSseFrames(buffer:string,onEvent:(event:OrbyStreamEvent)=>void){
 const frames=buffer.split(/\r?\n\r?\n/),rest=frames.pop()||'';
 for(const frame of frames){
  const data=frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
  if(!data)continue;
  try{emitWireEvent(JSON.parse(data) as WireOrbyEvent,onEvent);}catch(error){if(error instanceof MadarApiError)throw error;throw new MadarApiError('وصل جزء غير صالح من استجابة أوربي.',502,'INVALID_STREAM');}
 }
 return rest;
}

export async function streamOrby(accessToken:string,input:{organizationId:string;conversationId:string|null;mode:OrbyMode;prompt:string;parentMessageId?:string|null},onEvent:(event:OrbyStreamEvent)=>void,signal?:AbortSignal){
 const mode=input.mode==='ACTION'?'PLAN':input.mode==='ASK'||input.mode==='MONITOR'?'ANALYZE':input.mode;
 const response=await fetch(`${apiBase}/api/orby/stream`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,Accept:'text/event-stream','Content-Type':'application/json'},body:JSON.stringify({...input,mode}),signal});
 if(!response.ok){const payload=await response.json().catch(()=>({})) as {error?:string};throw new MadarApiError(payload.error||'تعذر تشغيل أوربي الآن.',response.status);}
 if(response.body&&'getReader' in response.body){const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';while(true){const{done,value}=await reader.read();if(done)break;buffer=parseSseFrames(buffer+decoder.decode(value,{stream:true}),onEvent);}buffer+=decoder.decode();parseSseFrames(`${buffer}\n\n`,onEvent);return;}
 const raw=await response.text();parseSseFrames(`${raw}\n\n`,onEvent);
}

export function planAgentTask(accessToken:string,input:{organizationId:string;goal:string}){return request<{ok:true;plan:Record<string,unknown>}>('/api/orby/agent/plan',accessToken,{method:'POST',body:JSON.stringify(input)});}
export function submitAgentTask(accessToken:string,input:{organizationId:string;goal:string;plan?:Record<string,unknown>}){return request<{ok:true;workflowId:string;runId:string;status:string}>('/api/orby/agent/runs',accessToken,{method:'POST',body:JSON.stringify(input)});}
export function fetchAgentRun(accessToken:string,organizationId:string,runId:string){return request<{ok:true;run:Record<string,unknown>;actions:Record<string,unknown>[]}>(`/api/orby/agent/runs/${encodeURIComponent(runId)}?organizationId=${encodeURIComponent(organizationId)}`,accessToken);}
