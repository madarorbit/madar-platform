import 'server-only';
import {validateMagicBytes} from '@/src/lib/file-signatures.mjs';
import {supabaseConfig} from '@/src/lib/env';
import {serverToken} from '@/src/lib/supabase/server';

const allowed=new Set(['image/jpeg','image/png','image/webp','application/pdf']);
export type FeedbackAttachment={path:string;name:string;mime:string;size:number};

export async function uploadFeedbackAttachment(file:File,userId:string):Promise<FeedbackAttachment>{
 if(!file.size)throw new Error('الملف المرفق فارغ.');
 if(file.size>10*1024*1024||!allowed.has(file.type)||!await validateMagicBytes(file))throw new Error('المرفق يجب أن يكون JPG أو PNG أو WebP أو PDF صالحًا وبحجم لا يتجاوز 10MB.');
 const extension=file.type==='application/pdf'?'pdf':file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',path=`${userId}/${crypto.randomUUID()}.${extension}`;
 const{url,key}=supabaseConfig(),token=await serverToken();
 const response=await fetch(`${url}/storage/v1/object/feedback-attachments/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':file.type,'x-upsert':'false'},body:file,cache:'no-store'});
 if(!response.ok)throw new Error('تعذر رفع المرفق.');
 return{path,name:file.name.slice(0,255),mime:file.type,size:file.size};
}

export async function removeFeedbackAttachment(path:string){
 try{const{url,key}=supabaseConfig(),token=await serverToken();await fetch(`${url}/storage/v1/object/feedback-attachments/${path}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${token}`},cache:'no-store'});}catch{}
}

export async function signedFeedbackAttachment(path:string,expiresIn=120){
 const{url,key}=supabaseConfig(),token=await serverToken();
 const response=await fetch(`${url}/storage/v1/object/sign/feedback-attachments/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({expiresIn}),cache:'no-store'});
 if(!response.ok)throw new Error('تعذر فتح المرفق.');
 const data=await response.json();return new URL(data.signedURL||data.signedUrl,url).toString();
}
