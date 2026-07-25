import 'server-only';
import {supabaseConfig} from '@/src/lib/env';

export function supabaseServiceConfig(){
 const {url}=supabaseConfig();
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!key)throw new Error('مفتاح خدمة Supabase غير مضبوط في بيئة الخادم.');
 return {url,key};
}

export async function supabaseServiceFetch(path:string,init:RequestInit={}){
 const {url,key}=supabaseServiceConfig();
 const headers=new Headers(init.headers);
 headers.set('apikey',key);
 headers.set('Authorization',`Bearer ${key}`);
 if(!(init.body instanceof File)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 headers.set('Prefer',headers.get('Prefer')||'return=representation');
 const response=await fetch(`${url}${path}`,{...init,headers,cache:'no-store'});
 if(!response.ok){
  const payload=await response.json().catch(()=>null) as {message?:string;error?:string}|null;
  console.error('Supabase service request failed',{path:path.split('?')[0],status:response.status,message:payload?.message||payload?.error});
  throw new Error('تعذر إتمام العملية الآمنة على الخادم.');
 }
 return response;
}
