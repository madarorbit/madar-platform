import type {OrbyEmbeddingRequest,OrbyEmbeddingResponse,OrbyGenerationOptions,OrbyJsonObject,OrbyModerationRequest,OrbyModerationResult,OrbyModelSummary,OrbyProvider,OrbyProviderRequest,OrbyProviderResponse,OrbyProviderStreamEvent} from '../core/contracts';
import {OrbyError,normalizeOrbyError} from '../core/errors';
import {providerCapabilities,providerHttpError,providerJsonRequest,providerNow,providerSseData,timedProviderSignal} from './common';

function messages(request:OrbyProviderRequest){return request.messages.map(message=>({role:message.role,content:message.content}));}

function reasoningPayload(options:OrbyGenerationOptions){
 const reasoning=options.reasoning;
 if(!reasoning)return undefined;
 const payload:Record<string,unknown>={};
 if(reasoning.enabled!==undefined)payload.enabled=reasoning.enabled;
 if(reasoning.effort)payload.effort=reasoning.effort;
 if(reasoning.maxTokens!==undefined)payload.max_tokens=reasoning.maxTokens;
 if(reasoning.exclude!==undefined)payload.exclude=reasoning.exclude;
 return payload;
}

function responseText(content:unknown){
 if(typeof content==='string')return content;
 if(!Array.isArray(content))return undefined;
 const parts=content.flatMap(item=>{
  if(typeof item==='string')return[item];
  if(!item||typeof item!=='object')return[];
  const value=item as {text?:unknown;content?:unknown};
  if(typeof value.text==='string')return[value.text];
  if(typeof value.content==='string')return[value.content];
  return[];
 });
 return parts.length?parts.join(''):undefined;
}

function embeddedProviderError(body:unknown){
 if(!body||typeof body!=='object')return null;
 const value=body as {error?:unknown;choices?:Array<{error?:unknown}>};
 if(value.error)return value.error;
 return value.choices?.[0]?.error||null;
}

function embeddedErrorStatus(error:unknown){
 if(!error||typeof error!=='object')return 502;
 const value=error as {code?:unknown;status?:unknown};
 const status=Number(value.status??value.code);
 return Number.isFinite(status)&&status>=400?status:502;
}

export type OpenAICompatibleProviderOptions={id?:string;displayName?:string;baseUrl?:string;apiKey:string;organization?:string;project?:string;defaultModerationModel?:string;headers?:Record<string,string>;requestDefaults?:Record<string,unknown>};

export class OpenAICompatibleProvider implements OrbyProvider {
 readonly id:string;
 readonly displayName:string;
 readonly capabilities=providerCapabilities({text:true,streaming:true,embeddings:true,moderation:true,vision:true,audio:true,json:true});
 protected readonly baseUrl:string;
 constructor(protected readonly options:OpenAICompatibleProviderOptions){this.id=options.id||'openai';this.displayName=options.displayName||'OpenAI';this.baseUrl=(options.baseUrl||'https://api.openai.com/v1').replace(/\/$/,'');}
 protected headers(){const headers=new Headers({'Content-Type':'application/json','Authorization':`Bearer ${this.options.apiKey}`,...this.options.headers});if(this.options.organization)headers.set('OpenAI-Organization',this.options.organization);if(this.options.project)headers.set('OpenAI-Project',this.options.project);return headers;}
 async generate(request:OrbyProviderRequest):Promise<OrbyProviderResponse>{
  const payload:{[key:string]:unknown}={...(this.options.requestDefaults||{}),model:request.model,messages:messages(request),temperature:request.options.temperature,max_tokens:request.options.maxOutputTokens,top_p:request.options.topP,stop:request.options.stop};
  const reasoning=reasoningPayload(request.options);if(reasoning)payload.reasoning=reasoning;
  if(request.options.responseFormat==='json')payload.response_format={type:'json_object'};
  const {body}=await providerJsonRequest(`${this.baseUrl}/chat/completions`,{method:'POST',headers:this.headers(),body:JSON.stringify(payload)},request.options.timeoutMs,request.signal);
  if(!body)throw new OrbyError('أعاد المزود استجابة فارغة.','PROVIDER_BAD_RESPONSE',true,{providerId:this.id,status:502});
  const embedded=embeddedProviderError(body);if(embedded)throw providerHttpError(embeddedErrorStatus(embedded),{error:embedded});
  const value=body as {id?:string;choices?:Array<{finish_reason?:string;message?:{content?:unknown;reasoning?:unknown};error?:unknown}>;usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number};openrouter_metadata?:unknown};
  const choice=value.choices?.[0];
  const text=responseText(choice?.message?.content);
  if(typeof text!=='string'||!text.trim()){
   const reasoningOnly=typeof choice?.message?.reasoning==='string'&&choice.message.reasoning.trim().length>0;
   throw new OrbyError(reasoningOnly?'استهلك النموذج حد الإخراج في الاستدلال دون إنتاج جواب نهائي.':'صيغة استجابة OpenAI غير متوقعة.','PROVIDER_BAD_RESPONSE',true,{providerId:this.id,status:502,finishReason:choice?.finish_reason||null,reasoningOnly});
  }
  return {text,finishReason:choice?.finish_reason,providerRequestId:value.id,usage:{inputTokens:value.usage?.prompt_tokens,outputTokens:value.usage?.completion_tokens,totalTokens:value.usage?.total_tokens},rawMetadata:value.openrouter_metadata&&typeof value.openrouter_metadata==='object'?value.openrouter_metadata as OrbyJsonObject:undefined};
 }
 async *stream(request:OrbyProviderRequest):AsyncIterable<OrbyProviderStreamEvent>{
  const timed=timedProviderSignal(request.options.timeoutMs,request.signal);
  try{
   const payload:{[key:string]:unknown}={...(this.options.requestDefaults||{}),model:request.model,messages:messages(request),stream:true,stream_options:{include_usage:true},temperature:request.options.temperature,max_tokens:request.options.maxOutputTokens,top_p:request.options.topP,stop:request.options.stop};
   const reasoning=reasoningPayload(request.options);if(reasoning)payload.reasoning=reasoning;
   if(request.options.responseFormat==='json')payload.response_format={type:'json_object'};
   const response=await fetch(`${this.baseUrl}/chat/completions`,{method:'POST',headers:this.headers(),body:JSON.stringify(payload),signal:timed.signal,cache:'no-store'});
   if(!response.ok)throw providerHttpError(response.status,await response.json().catch(()=>null));
   yield {type:'start'};
   for await(const data of providerSseData(response)){
    if(data==='[DONE]')break;
    const event=JSON.parse(data) as {error?:unknown;choices?:Array<{delta?:{content?:unknown};finish_reason?:string;error?:unknown}>;usage?:{prompt_tokens?:number;completion_tokens?:number;total_tokens?:number}};
    const embedded=embeddedProviderError(event);if(embedded)throw providerHttpError(embeddedErrorStatus(embedded),{error:embedded});
    const delta=responseText(event.choices?.[0]?.delta?.content);if(delta)yield {type:'delta',text:delta};
    if(event.usage)yield {type:'usage',usage:{inputTokens:event.usage.prompt_tokens,outputTokens:event.usage.completion_tokens,totalTokens:event.usage.total_tokens}};
    const finish=event.choices?.[0]?.finish_reason;if(finish)yield {type:'end',finishReason:finish};
   }
  }catch(error){throw normalizeOrbyError(error,'PROVIDER_UNAVAILABLE');}finally{timed.dispose();}
 }
 async embeddings(request:OrbyEmbeddingRequest):Promise<OrbyEmbeddingResponse>{const {body}=await providerJsonRequest(`${this.baseUrl}/embeddings`,{method:'POST',headers:this.headers(),body:JSON.stringify({model:request.model,input:request.inputs})},undefined,request.signal);const value=body as {data?:Array<{embedding?:number[]}>;usage?:{prompt_tokens?:number;total_tokens?:number}};const vectors=value.data?.map(item=>item.embedding).filter((item):item is number[]=>Array.isArray(item));if(!vectors||vectors.length!==request.inputs.length)throw new OrbyError('صيغة استجابة التضمين غير متوقعة.','PROVIDER_BAD_RESPONSE',true);return {vectors,usage:{inputTokens:value.usage?.prompt_tokens,totalTokens:value.usage?.total_tokens}};}
 async moderation(request:OrbyModerationRequest):Promise<readonly OrbyModerationResult[]>{const {body}=await providerJsonRequest(`${this.baseUrl}/moderations`,{method:'POST',headers:this.headers(),body:JSON.stringify({model:request.model||this.options.defaultModerationModel,input:request.inputs})},undefined,request.signal);const value=body as {results?:Array<{flagged?:boolean;categories?:Record<string,boolean>;category_scores?:Record<string,number>}>};if(!value.results)throw new OrbyError('صيغة استجابة الإشراف غير متوقعة.','PROVIDER_BAD_RESPONSE',true);return value.results.map(item=>({flagged:Boolean(item.flagged),categories:item.categories||{},scores:item.category_scores}));}
 async models(signal?:AbortSignal):Promise<readonly OrbyModelSummary[]>{const {body}=await providerJsonRequest(`${this.baseUrl}/models`,{headers:this.headers()},15000,signal);const value=body as {data?:Array<{id?:string}>};return (value.data||[]).flatMap(item=>item.id?[{id:item.id}]:[]);}
 async health(signal?:AbortSignal){const started=Date.now();try{await this.models(signal);return {providerId:this.id,ok:true,latencyMs:Date.now()-started,checkedAt:providerNow()};}catch(error){const normalized=normalizeOrbyError(error,'PROVIDER_UNAVAILABLE');return {providerId:this.id,ok:false,latencyMs:Date.now()-started,checkedAt:providerNow(),message:normalized.message};}}
}

export class LocalOpenAIProvider extends OpenAICompatibleProvider {constructor(options:Omit<OpenAICompatibleProviderOptions,'id'|'displayName'|'apiKey'> & {id?:string;displayName?:string;apiKey?:string}){super({...options,id:options.id||'local',displayName:options.displayName||'Local LLM',apiKey:options.apiKey||'local'});}}