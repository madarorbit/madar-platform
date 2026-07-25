'use server';

import {randomUUID} from 'node:crypto';
import {supabaseConfig} from '@/src/lib/env';
import {supabaseServiceConfig} from '@/src/lib/supabase/service';

export type CareerState={error?:string;success?:string};
const clean=(value:FormDataEntryValue|null,max:number)=>String(value||'').trim().slice(0,max);
const allowedJobs=['blogger','developer','marketer'] as const;
const encodeStoragePath=(path:string)=>path.split('/').map(encodeURIComponent).join('/');

function normalizePhone(value:string,required:boolean){
 const phone=value.replace(/[\s()-]/g,'');
 if(!phone&&!required)return null;
 if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error(required?'اكتب رقم الواتساب بصيغة دولية صحيحة، مثل +9677XXXXXXXX.':'اكتب رقم الاتصال بصيغة دولية صحيحة، مثل +9677XXXXXXXX.');
 return phone;
}

async function validateCv(file:File){
 const allowed:Record<string,string>={
  'application/pdf':'pdf',
  'application/msword':'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx',
 };
 const extension=allowed[file.type];
 if(!extension)throw new Error('السيرة الذاتية يجب أن تكون PDF أو DOC أو DOCX.');
 if(file.size>5*1024*1024)throw new Error('حجم السيرة الذاتية يجب ألا يتجاوز 5 ميجابايت.');
 const bytes=new Uint8Array((await file.arrayBuffer()).slice(0,16));
 const isPdf=file.type==='application/pdf'&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
 const isDoc=file.type==='application/msword'&&[0xd0,0xcf,0x11,0xe0].every((value,index)=>bytes[index]===value);
 const isDocx=file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'&&bytes[0]===0x50&&bytes[1]===0x4b&&[0x03,0x05,0x07].includes(bytes[2])&&[0x04,0x06,0x08].includes(bytes[3]);
 if(!isPdf&&!isDoc&&!isDocx)throw new Error('محتوى ملف السيرة الذاتية لا يطابق نوعه.');
 return extension;
}

async function uploadCv(file:File){
 const extension=await validateCv(file),{url,key}=supabaseServiceConfig();
 const path=`applications/${new Date().toISOString().slice(0,10)}/${randomUUID()}.${extension}`;
 const response=await fetch(`${url}/storage/v1/object/career-cvs/${encodeStoragePath(path)}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':file.type,'x-upsert':'false'},body:file,cache:'no-store'});
 if(!response.ok)throw new Error('تعذر رفع السيرة الذاتية الآن. حاول مجددًا.');
 return {path,fileName:file.name.slice(0,180),mimeType:file.type};
}

async function removeCv(path:string){
 try{const{url,key}=supabaseServiceConfig();await fetch(`${url}/storage/v1/object/career-cvs/${encodeStoragePath(path)}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});}catch{}
}

export async function submitApplication(_previous:CareerState,form:FormData):Promise<CareerState>{
 let uploadedPath:string|undefined;
 try{
  if(clean(form.get('website'),200))return {success:'تم استلام طلبك بنجاح.'};
  const job_slug=clean(form.get('job_slug'),80),full_name=clean(form.get('full_name'),120),phone=normalizePhone(clean(form.get('phone'),30),false),whatsapp_number=normalizePhone(clean(form.get('whatsapp_number'),30),true),applicant_bio=clean(form.get('applicant_bio'),3000),application_reason=clean(form.get('application_reason'),2000);
  if(!allowedJobs.includes(job_slug as typeof allowedJobs[number]))throw new Error('اختر وظيفة متاحة.');
  if(full_name.length<2)throw new Error('اكتب اسمك الكامل.');
  if(applicant_bio.length<30)throw new Error('اكتب نبذة أوضح عن نفسك ومواهبك، لا تقل عن 30 حرفًا.');
  if(application_reason.length<20)throw new Error('وضّح سبب التقديم في 20 حرفًا على الأقل.');
  const cv=form.get('cv'),uploaded=cv instanceof File&&cv.size?await uploadCv(cv):null;uploadedPath=uploaded?.path;
  const payload={job_slug,full_name,email:null,phone,location:null,portfolio_url:null,experience_summary:`${applicant_bio}\n\nسبب التقديم:\n${application_reason}`,whatsapp_number,applicant_bio,application_reason,cv_storage_path:uploaded?.path||null,cv_file_name:uploaded?.fileName||null,cv_mime_type:uploaded?.mimeType||null};
  const{url,key}=supabaseConfig(),response=await fetch(`${url}/rest/v1/job_applications`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(payload),cache:'no-store'});
  if(!response.ok)throw new Error('تعذر إرسال طلب التوظيف الآن. حاول بعد قليل.');
  return {success:'وصل طلبك إلى مَدار بنجاح. سيقوم المؤسس بمراجعته، وسيتم التواصل معك عبر واتساب عند الانتقال إلى الخطوة التالية.'};
 }catch(error){if(uploadedPath)await removeCv(uploadedPath);return {error:error instanceof Error?error.message:'تعذر إرسال الطلب الآن. حاول لاحقًا.'};}
}
