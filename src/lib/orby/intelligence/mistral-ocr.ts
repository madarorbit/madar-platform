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
   if(!response.ok)return{ok:false,latencyMs:Date.now()-started,message:`MISTRAL_HTTP_${response.status}`,modelAvailable:false};
   const payload=await response.json() as {data?:Array<{id?:string}>};
   const ids=(payload.data||[]).flatMap(item=>item.id?[item.id]:[]);
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
   if(!response.ok){
    const payload=await response.json().catch(()=>null) as {message?:string;detail?:string}|null;
    throw new Error(`ORBY_MISTRAL_OCR_FAILED:${response.status}:${payload?.message||payload?.detail||'unknown'}`);
   }
   const payload=await response.json() as MistralOcrResponse;
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
