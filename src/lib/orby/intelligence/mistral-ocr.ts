import type {OrbyJsonObject} from '../core/contracts';
import type {OrbyOcrService} from './contracts';

export type MistralOcrServiceOptions={
 apiKey:string;
 model?:string;
 baseUrl?:string;
 timeoutMs?:number;
 maxBytes?:number;
};

type MistralOcrPage={
 index?:number;
 markdown?:string;
 header?:string|null;
 footer?:string|null;
 tables?:Array<{markdown?:string;html?:string;content?:string}>;
 confidence_scores?:Record<string,unknown>|null;
};

type MistralOcrResponse={
 pages?:MistralOcrPage[];
 model?:string;
 usage_info?:Record<string,unknown>;
};

function timedSignal(parent:AbortSignal|undefined,timeoutMs:number){
 const controller=new AbortController();
 const abort=()=>controller.abort(parent?.reason);
 if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new Error('ORBY_OCR_TIMEOUT')),timeoutMs);
 return{signal:controller.signal,dispose(){clearTimeout(timer);parent?.removeEventListener('abort',abort);}};
}

function pageText(page:MistralOcrPage){
 const tables=(page.tables||[]).map(table=>table.markdown||table.content||table.html||'').filter(Boolean).join('\n\n');
 return[page.header||'',page.markdown||'',tables,page.footer||''].map(value=>value.trim()).filter(Boolean).join('\n\n');
}

async function safePayload(response:Response){
 const raw=await response.text();
 if(!raw.trim())return null;
 try{return JSON.parse(raw) as unknown;}catch{return{raw:raw.slice(0,1000)};}
}

function responseMessage(payload:unknown){
 if(typeof payload==='object'&&payload){
  for(const key of ['message','detail','error']){
   const value=(payload as Record<string,unknown>)[key];
   if(typeof value==='string'&&value.trim())return value.trim().slice(0,300);
   if(typeof value==='object'&&value&&'message' in value&&typeof (value as {message?:unknown}).message==='string')return String((value as {message:string}).message).slice(0,300);
  }
 }
 return 'unknown';
}

function mistralFailure(status:number,payload:unknown){
 if(status===401)return'MISTRAL_API_KEY_INVALID';
 if(status===402)return'MISTRAL_PAYMENT_REQUIRED';
 if(status===403)return'MISTRAL_ACCESS_FORBIDDEN';
 if(status===429)return'MISTRAL_RATE_LIMITED';
 return`MISTRAL_HTTP_${status}:${responseMessage(payload)}`;
}

export class MistralOcrService implements OrbyOcrService {
 readonly model:string;
 private readonly baseUrl:string;
 private readonly timeoutMs:number;
 private readonly maxBytes:number;
 constructor(private readonly options:MistralOcrServiceOptions){
  if(!options.apiKey.trim())throw new Error('ORBY_MISTRAL_OCR_API_KEY_REQUIRED');
  this.model=options.model||'mistral-ocr-2512';
  this.baseUrl=(options.baseUrl||'https://api.mistral.ai/v1').replace(/\/$/,'');
  this.timeoutMs=options.timeoutMs||55_000;
  this.maxBytes=options.maxBytes||20*1024*1024;
 }
 private headers(){return{'Content-Type':'application/json','Authorization':`Bearer ${this.options.apiKey}`};}
 async health(signal?:AbortSignal){
  const started=Date.now(),timed=timedSignal(signal,Math.min(this.timeoutMs,15_000));
  try{
   const response=await fetch(`${this.baseUrl}/models`,{headers:this.headers(),signal:timed.signal,cache:'no-store'});
   const payload=await safePayload(response);
   if(!response.ok)return{ok:false,latencyMs:Date.now()-started,message:mistralFailure(response.status,payload),modelAvailable:false};
   if(!payload)return{ok:false,latencyMs:Date.now()-started,message:'MISTRAL_EMPTY_RESPONSE',modelAvailable:false};
   const ids=(Array.isArray((payload as {data?:unknown}).data)?(payload as {data:Array<{id?:string}>}).data:[]).flatMap(item=>item.id?[item.id]:[]);
   const modelAvailable=ids.includes(this.model)||ids.includes('mistral-ocr-latest');
   return{ok:modelAvailable,latencyMs:Date.now()-started,message:modelAvailable?undefined:'MISTRAL_OCR_MODEL_UNAVAILABLE',modelAvailable};
  }catch(error){return{ok:false,latencyMs:Date.now()-started,message:error instanceof Error?error.message:'MISTRAL_OCR_HEALTH_FAILED',modelAvailable:false};}
  finally{timed.dispose();}
 }
 async extract(input:{bytes:Uint8Array;mimeType:string;fileName?:string;signal?:AbortSignal}){
  if(!input.bytes.length)throw new Error('ORBY_OCR_BYTES_REQUIRED');
  if(input.bytes.length>this.maxBytes)throw new Error('ORBY_OCR_FILE_TOO_LARGE');
  const kind=input.mimeType.toLowerCase().startsWith('image/')?'image_url':'document_url';
  const dataUrl=`data:${input.mimeType};base64,${Buffer.from(input.bytes).toString('base64')}`;
  const document=kind==='image_url'?{type:kind,image_url:dataUrl}:{type:kind,document_url:dataUrl};
  const timed=timedSignal(input.signal,this.timeoutMs);
  try{
   const response=await fetch(`${this.baseUrl}/ocr`,{
    method:'POST',
    headers:this.headers(),
    signal:timed.signal,
    cache:'no-store',
    body:JSON.stringify({
     model:this.model,
     document,
     table_format:'markdown',
     extract_header:true,
     extract_footer:true,
     include_image_base64:false,
     confidence_scores_granularity:'page',
    }),
   });
   const raw=await safePayload(response);
   if(!response.ok)throw new Error(`ORBY_MISTRAL_OCR_FAILED:${mistralFailure(response.status,raw)}`);
   if(!raw)throw new Error('ORBY_MISTRAL_OCR_EMPTY_RESPONSE');
   const payload=raw as MistralOcrResponse;
   const pages=payload.pages||[],text=pages.map(pageText).filter(Boolean).join('\n\n---\n\n').trim();
   if(!text)throw new Error('ORBY_OCR_EMPTY');
   return{
    text,
    metadata:{
     provider:'mistral',
     model:payload.model||this.model,
     pages:pages.length,
     fileName:input.fileName||null,
     usageInfo:payload.usage_info||{},
     confidence:pages.map(page=>page.confidence_scores||null),
    } as OrbyJsonObject,
   };
  }finally{timed.dispose();}
 }
}
