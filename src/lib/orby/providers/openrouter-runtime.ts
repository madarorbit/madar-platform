import 'server-only';

export type OrbyExternalModelCandidate={
 id:string;
 providerModel:string;
 displayName:string;
 reasoningDisabled?:boolean;
};

export type OrbyOpenRouterSelection={
 id:string;
 providerModel:string;
 displayName:string;
 latencyMs:number;
 key:{isManagementKey:boolean;isProvisioningKey:boolean;isFreeTier:boolean;limitRemaining:number|null};
};

const CANDIDATES:readonly OrbyExternalModelCandidate[]=[
 {id:'gemini-2.5-flash-lite',providerModel:'google/gemini-2.5-flash-lite',displayName:'Gemini 2.5 Flash Lite'},
 {id:'gpt-4.1-nano',providerModel:'openai/gpt-4.1-nano',displayName:'GPT-4.1 Nano'},
 {id:'deepseek-v3.2',providerModel:'deepseek/deepseek-v3.2',displayName:'DeepSeek V3.2',reasoningDisabled:true},
];

function responseText(content:unknown){
 if(typeof content==='string')return content;
 if(!Array.isArray(content))return'';
 return content.flatMap(item=>{
  if(typeof item==='string')return[item];
  if(!item||typeof item!=='object')return[];
  const value=item as {text?:unknown;content?:unknown};
  if(typeof value.text==='string')return[value.text];
  if(typeof value.content==='string')return[value.content];
  return[];
 }).join('');
}

async function payload(response:Response){
 const raw=await response.text();
 if(!raw.trim())return null;
 try{return JSON.parse(raw) as unknown;}catch{return{raw:raw.slice(0,500)};}
}

function errorMessage(body:unknown){
 if(!body||typeof body!=='object')return'unknown';
 const value=body as {error?:unknown;message?:unknown};
 if(typeof value.message==='string')return value.message.slice(0,240);
 if(typeof value.error==='string')return value.error.slice(0,240);
 if(value.error&&typeof value.error==='object'&&'message' in value.error&&typeof (value.error as {message?:unknown}).message==='string')return String((value.error as {message:string}).message).slice(0,240);
 return'unknown';
}

function statusCode(status:number){
 if(status===401)return'ORBY_OPENROUTER_API_KEY_INVALID';
 if(status===402)return'ORBY_OPENROUTER_CREDIT_REQUIRED';
 if(status===403)return'ORBY_OPENROUTER_GUARDRAIL_BLOCKED';
 if(status===429)return'ORBY_OPENROUTER_RATE_LIMITED';
 if(status===503)return'ORBY_OPENROUTER_NO_ELIGIBLE_PROVIDER';
 return`ORBY_OPENROUTER_HTTP_${status}`;
}

export async function selectOpenRouterRuntime(options:{apiKey:string;baseUrl?:string;siteUrl?:string;appName?:string}){
 const started=Date.now();
 const baseUrl=(options.baseUrl||'https://openrouter.ai/api/v1').replace(/\/$/,'');
 const headers={
  'Authorization':`Bearer ${options.apiKey}`,
  'Content-Type':'application/json',
  'HTTP-Referer':options.siteUrl||'https://www.orbitmadar.com',
  'X-OpenRouter-Title':options.appName||'MADAR | ORBIT',
  'X-OpenRouter-Metadata':'enabled',
 };
 const keyResponse=await fetch(`${baseUrl}/key`,{headers,cache:'no-store'});
 const keyBody=await payload(keyResponse);
 if(!keyResponse.ok)throw new Error(`${statusCode(keyResponse.status)}:${errorMessage(keyBody)}`);
 const keyData=(keyBody&&typeof keyBody==='object'&&'data' in keyBody?(keyBody as {data?:unknown}).data:null) as Record<string,unknown>|null;
 if(!keyData)throw new Error('ORBY_OPENROUTER_KEY_METADATA_INVALID');
 const key={
  isManagementKey:keyData.is_management_key===true,
  isProvisioningKey:keyData.is_provisioning_key===true,
  isFreeTier:keyData.is_free_tier===true,
  limitRemaining:typeof keyData.limit_remaining==='number'?keyData.limit_remaining:null,
 };
 if(key.isManagementKey)throw new Error('ORBY_OPENROUTER_MANAGEMENT_KEY');
 if(key.isProvisioningKey)throw new Error('ORBY_OPENROUTER_PROVISIONING_KEY');
 if(key.limitRemaining!==null&&key.limitRemaining<=0)throw new Error('ORBY_OPENROUTER_CREDIT_REQUIRED');

 const modelResponse=await fetch(`${baseUrl}/models`,{headers,cache:'no-store'});
 const modelBody=await payload(modelResponse);
 if(!modelResponse.ok)throw new Error(`${statusCode(modelResponse.status)}:${errorMessage(modelBody)}`);
 const rows=modelBody&&typeof modelBody==='object'&&Array.isArray((modelBody as {data?:unknown}).data)?(modelBody as {data:Array<{id?:string}>}).data:[];
 const available=new Set(rows.flatMap(row=>row.id?[row.id]:[]));
 const attempts:Array<{model:string;status:number;result:string;finishReason?:string|null}>=[];

 for(const candidate of CANDIDATES){
  if(!available.has(candidate.providerModel)){attempts.push({model:candidate.providerModel,status:404,result:'not-listed'});continue;}
  const body:Record<string,unknown>={
   model:candidate.providerModel,
   messages:[{role:'user',content:'Reply with exactly ORBY_RUNTIME_OK'}],
   temperature:0,
   max_tokens:96,
   provider:{allow_fallbacks:true,data_collection:'deny'},
  };
  if(candidate.reasoningDisabled)body.reasoning={enabled:false};
  const response=await fetch(`${baseUrl}/chat/completions`,{method:'POST',headers,cache:'no-store',body:JSON.stringify(body)});
  const result=await payload(response);
  if(!response.ok){
   attempts.push({model:candidate.providerModel,status:response.status,result:errorMessage(result)});
   if([401,402,403].includes(response.status))throw new Error(`${statusCode(response.status)}:${errorMessage(result)}`);
   continue;
  }
  const value=result as {choices?:Array<{finish_reason?:string|null;message?:{content?:unknown};error?:unknown}>;error?:unknown}|null;
  const embedded=value?.error||value?.choices?.[0]?.error;
  if(embedded){attempts.push({model:candidate.providerModel,status:502,result:errorMessage({error:embedded})});continue;}
  const text=responseText(value?.choices?.[0]?.message?.content);
  if(text.includes('ORBY_RUNTIME_OK'))return{...candidate,key,latencyMs:Date.now()-started} satisfies OrbyOpenRouterSelection;
  attempts.push({model:candidate.providerModel,status:200,result:text.trim()?'unexpected-text':'empty-content',finishReason:value?.choices?.[0]?.finish_reason});
 }
 console.warn('ORBY OpenRouter governed model selection failed',{key,attempts});
 throw new Error('ORBY_OPENROUTER_NO_WORKING_MODEL');
}

export const orbyExternalModelCandidates=()=>CANDIDATES;
