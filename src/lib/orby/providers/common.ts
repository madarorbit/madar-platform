import type {OrbyJsonObject,OrbyProviderCapabilities} from '../core/contracts';
import {OrbyError} from '../core/errors';

const NONE:OrbyProviderCapabilities={text:false,streaming:false,embeddings:false,moderation:false,vision:false,audio:false,json:false};
export function providerCapabilities(input:Partial<OrbyProviderCapabilities>):OrbyProviderCapabilities{return {...NONE,...input};}
export function providerNow(){return new Date().toISOString();}
export function unsupportedProviderCapability(providerId:string,capability:string){return new OrbyError(`المزود ${providerId} لا يدعم قدرة ${capability}.`,'UNSUPPORTED_CAPABILITY',false,{providerId,capability});}

export function timedProviderSignal(timeoutMs:number|undefined,external?:AbortSignal){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),timeoutMs||45000);
 const abort=()=>controller.abort();external?.addEventListener('abort',abort,{once:true});
 return {signal:controller.signal,dispose(){clearTimeout(timeout);external?.removeEventListener('abort',abort);}};
}

function providerErrorText(body:unknown){
 if(typeof body==='string'&&body.trim())return body.slice(0,300);
 if(typeof body==='object'&&body){
  if('error' in body){
   const error=(body as {error?:unknown}).error;
   if(typeof error==='string')return error.slice(0,300);
   if(typeof error==='object'&&error&&'message' in error&&typeof (error as {message?:unknown}).message==='string')return String((error as {message:string}).message).slice(0,300);
   return JSON.stringify(error).slice(0,300);
  }
  if('message' in body&&typeof (body as {message?:unknown}).message==='string')return String((body as {message:string}).message).slice(0,300);
 }
 return '';
}

export function providerHttpError(status:number,body:unknown){
 const metadata={status} as OrbyJsonObject;
 if(status===401)return new OrbyError('مفتاح مزود أوربي غير صالح أو أُلغي.','PROVIDER_BAD_RESPONSE',false,metadata);
 if(status===402)return new OrbyError('رصيد مزود أوربي غير كافٍ لتشغيل النموذج.','PROVIDER_BAD_RESPONSE',false,metadata);
 if(status===403)return new OrbyError('المفتاح لا يملك صلاحية تشغيل النموذج المطلوب.','PROVIDER_BAD_RESPONSE',false,metadata);
 if(status===429)return new OrbyError('بلغ مزود أوربي حد الطلبات المؤقت.','PROVIDER_RATE_LIMITED',true,metadata);
 if(status===408||status===504)return new OrbyError('انتهت مهلة استجابة مزود أوربي.','PROVIDER_TIMEOUT',true,metadata);
 if(status>=500)return new OrbyError('مزود أوربي غير متاح مؤقتًا.','PROVIDER_UNAVAILABLE',true,metadata);
 return new OrbyError(providerErrorText(body)||'استجابة المزود غير صالحة.','PROVIDER_BAD_RESPONSE',false,metadata);
}

export async function providerJsonRequest(url:string,init:RequestInit,timeoutMs?:number,external?:AbortSignal){
 const timed=timedProviderSignal(timeoutMs,external),started=Date.now();
 try{
  const response=await fetch(url,{...init,signal:timed.signal,cache:'no-store'});
  const raw=await response.text();
  let body:unknown=null;
  if(raw.trim()){
   try{body=JSON.parse(raw);}catch{body=raw.slice(0,1000);}
  }
  if(!response.ok)throw providerHttpError(response.status,body);
  if(body===null)throw new OrbyError('مزود أوربي أعاد استجابة فارغة.','PROVIDER_BAD_RESPONSE',true,{status:response.status});
  return {response,body,latencyMs:Date.now()-started};
 }catch(error){if(error instanceof DOMException&&error.name==='AbortError')throw new OrbyError('انتهت مهلة اتصال مزود أوربي.','PROVIDER_TIMEOUT',true,{}, {cause:error});throw error;}finally{timed.dispose();}
}

export async function* providerSseData(response:Response):AsyncIterable<string>{
 if(!response.body)throw new OrbyError('مزود أوربي لم يُرجع قناة بث.','PROVIDER_BAD_RESPONSE',true);
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 try{
  while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});buffer=buffer.replaceAll('\r\n','\n');
   let boundary=buffer.indexOf('\n\n');while(boundary>=0){const packet=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);for(const line of packet.split(/\r?\n/))if(line.startsWith('data:'))yield line.slice(5).trim();boundary=buffer.indexOf('\n\n');}
  }
  buffer+=decoder.decode();buffer=buffer.replaceAll('\r\n','\n');if(buffer.trim())for(const line of buffer.split(/\r?\n/))if(line.startsWith('data:'))yield line.slice(5).trim();
 }finally{reader.releaseLock();}
}
