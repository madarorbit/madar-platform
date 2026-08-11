import 'server-only';
import {validateMagicBytes} from '@/src/lib/file-signatures.mjs';
import {supabaseConfig} from '@/src/lib/env';
import {serverToken} from '@/src/lib/supabase/server';

const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
export type UploadedPaymentProof={storagePath:string;originalFilename:string;mimeType:string;fileSize:number};

export async function uploadLocalPaymentProof(file:File,ownerId:string,scope:string):Promise<UploadedPaymentProof>{
 if(!file.size)throw new Error('اختر صورة أو PDF لإثبات التحويل.');
 if(file.size>10*1024*1024||!allowed.has(file.type)||!await validateMagicBytes(file))throw new Error('الإثبات يجب أن يكون JPG أو PNG أو WebP أو PDF صالحًا وبحجم لا يتجاوز 10MB.');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId))throw new Error('تعذر التحقق من مالك إثبات التحويل.');
 const safeScope=scope.replace(/[^a-zA-Z0-9/_-]/g,'').slice(0,160),extension=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',storagePath=`${ownerId}/local/${safeScope}/${crypto.randomUUID()}.${extension}`;
 const{url,key}=supabaseConfig(),token=await serverToken();
 const response=await fetch(`${url}/storage/v1/object/payment-proofs/${storagePath}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':file.type,'x-upsert':'false'},body:file,cache:'no-store'});
 if(!response.ok)throw new Error('تعذر رفع إثبات التحويل.');
 return{storagePath,originalFilename:file.name.slice(0,255),mimeType:file.type,fileSize:file.size};
}

export async function removeLocalPaymentProof(storagePath:string){
 try{
  const{url,key}=supabaseConfig(),token=await serverToken();
  await fetch(`${url}/storage/v1/object/payment-proofs/${storagePath}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${token}`},cache:'no-store'});
 }catch{}
}

export async function signedLocalPaymentProof(storagePath:string,expiresIn=120){
 const{url,key}=supabaseConfig(),token=await serverToken();
 const response=await fetch(`${url}/storage/v1/object/sign/payment-proofs/${storagePath}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn}),cache:'no-store'});
 if(!response.ok)throw new Error('تعذر فتح إثبات الدفع.');
 const data=await response.json(),value=data.signedURL||data.signedUrl;
 if(typeof value!=='string'||!value.trim())throw new Error('تعذر فتح إثبات الدفع.');
 const origin=new URL(url).origin,absolute=/^https?:\/\//i.test(value)?new URL(value):new URL(value.startsWith('/storage/v1/')?value:`/storage/v1/${value.replace(/^\/+/, '')}`,origin);
 if(absolute.origin!==origin||!absolute.pathname.startsWith('/storage/v1/object/sign/payment-proofs/'))throw new Error('تعذر فتح إثبات الدفع.');
 return absolute.toString();
}
