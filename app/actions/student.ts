'use server';

import {revalidatePath} from 'next/cache';
import {requireUser} from '@/src/lib/auth';
import {supabaseFetch,serverToken} from '@/src/lib/supabase/server';
import {supabaseConfig} from '@/src/lib/env';
import {required} from '@/src/lib/validation';
import {validateMagicBytes} from '@/src/lib/file-signatures.mjs';

export type StudentState={success?:string;error?:string};

async function studentOrg(id:string){
 const user=await requireUser();
 const rows=await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(id)}&user_id=eq.${user.id}&select=organization_id,organizations(type,status)`);
 if(rows?.[0]?.organizations?.type!=='STUDENT'||rows[0].organizations.status!=='active')throw new Error('لا تملك صلاحية الوصول إلى مساحة الطالب هذه.');
 return id;
}

async function result(work:()=>Promise<void>,success:string):Promise<StudentState>{
 try{await work();revalidatePath('/student');return{success};}
 catch(error){return{error:error instanceof Error?error.message:'تعذر حفظ البيانات.'};}
}

const optional=(value:FormDataEntryValue|null)=>String(value||'').trim()||null;

export async function ensureStudentWorkspace(){
 await requireUser();
 await supabaseFetch('/rest/v1/rpc/ensure_student_workspace',{method:'POST',body:'{}'});
 revalidatePath('/student');revalidatePath('/account');revalidatePath('/dashboard');
}

export async function addCourse(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة'));
 const credits=Number(form.get('credits')),grade=Number(form.get('grade')),target=optional(form.get('target_grade'));
 if(!Number.isFinite(credits)||credits<=0||credits>30||!Number.isFinite(grade)||grade<0||grade>100)throw new Error('تحقق من الساعات والدرجة.');
 await supabaseFetch('/rest/v1/student_courses',{method:'POST',body:JSON.stringify({organization_id,name:required(form.get('name'),'المقرر'),credits,grade,semester:optional(form.get('semester')),code:optional(form.get('code')),instructor:optional(form.get('instructor')),color:String(form.get('color')||'#6C3BFF'),target_grade:target?Number(target):null})});
},'تمت إضافة المقرر وتحديث المعدل.')}

export async function addTask(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة'));
 const due=optional(form.get('due_at')),reminder=optional(form.get('reminder_at'));
 await supabaseFetch('/rest/v1/student_tasks',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'المهمة'),description:optional(form.get('description')),course_id:optional(form.get('course_id')),priority:String(form.get('priority')||'MEDIUM'),due_at:due,reminder_at:reminder})});
},'تمت إضافة المهمة والتذكير.')}

export async function toggleTask(form:FormData){
 const org=await studentOrg(required(form.get('organization_id'),'المساحة')),done=String(form.get('is_done'))!=='true';
 await supabaseFetch(`/rest/v1/student_tasks?id=eq.${encodeURIComponent(required(form.get('id'),'المهمة'))}&organization_id=eq.${org}`,{method:'PATCH',body:JSON.stringify({is_done:done,completed_at:done?new Date().toISOString():null})});
 revalidatePath('/student');
}

export async function deleteStudentItem(form:FormData){
 const org=await studentOrg(required(form.get('organization_id'),'المساحة'));
 const table=required(form.get('table'),'النوع'),id=required(form.get('id'),'العنصر');
 const allowed=['student_courses','student_tasks','student_notes','student_schedule','student_events','student_study_sessions','student_goals'];
 if(!allowed.includes(table))throw new Error('نوع العنصر غير صالح.');
 await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&organization_id=eq.${org}`,{method:'DELETE'});
 revalidatePath('/student');
}

export async function addNote(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة'));
 const tags=String(form.get('tags')||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
 await supabaseFetch('/rest/v1/student_notes',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'العنوان'),content:required(form.get('content'),'الملاحظة'),color:String(form.get('color')||'amber'),is_pinned:form.get('is_pinned')==='on',tags})});
},'تم حفظ الملاحظة.')}

export async function addSchedule(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة'));
 await supabaseFetch('/rest/v1/student_schedule',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'العنوان'),weekday:Number(form.get('weekday')),starts_at:required(form.get('starts_at'),'وقت البداية'),ends_at:required(form.get('ends_at'),'وقت النهاية'),location:optional(form.get('location')),course_id:optional(form.get('course_id')),kind:String(form.get('kind')||'LECTURE')})});
},'تمت إضافة الموعد للجدول.')}

export async function addEvent(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة'));
 await supabaseFetch('/rest/v1/student_events',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'العنوان'),kind:String(form.get('kind')||'EXAM'),starts_at:required(form.get('starts_at'),'الموعد'),reminder_at:optional(form.get('reminder_at')),course_id:optional(form.get('course_id')),location:optional(form.get('location')),notes:optional(form.get('notes'))})});
},'تم حفظ الموعد الجامعي.')}

export async function addStudySession(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة')),minutes=Number(form.get('minutes')),focus=Number(form.get('focus_score'));
 if(!Number.isInteger(minutes)||minutes<1||minutes>1440)throw new Error('مدة جلسة المذاكرة غير صالحة.');
 await supabaseFetch('/rest/v1/student_study_sessions',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'الجلسة'),minutes,studied_on:required(form.get('studied_on'),'التاريخ'),focus_score:focus||null,course_id:optional(form.get('course_id')),notes:optional(form.get('notes'))})});
},'تم تسجيل جلسة المذاكرة.')}

export async function addGoal(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة')),target=Number(form.get('target_value'));
 if(!Number.isInteger(target)||target<1)throw new Error('أدخل هدفًا رقميًا صحيحًا.');
 await supabaseFetch('/rest/v1/student_goals',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'الهدف'),target_value:target,unit:required(form.get('unit'),'الوحدة'),deadline:optional(form.get('deadline'))})});
},'تمت إضافة الهدف الدراسي.')}

export async function uploadStudentPdf(_:StudentState,form:FormData){return result(async()=>{
 const organization_id=await studentOrg(required(form.get('organization_id'),'المساحة')),file=form.get('file');
 if(!(file instanceof File)||!file.size)throw new Error('اختر ملف PDF.');
 if(file.type!=='application/pdf'||file.size>20*1024*1024||!await validateMagicBytes(file))throw new Error('يجب أن يكون الملف PDF صالحًا وبحجم لا يتجاوز 20MB.');
 const path=`${organization_id}/${crypto.randomUUID()}.pdf`,{url,key}=supabaseConfig(),token=await serverToken();
 const response=await fetch(`${url}/storage/v1/object/student-library/${path}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${token}`,'Content-Type':'application/pdf'},body:file,cache:'no-store'});
 if(!response.ok)throw new Error('تعذر رفع المرجع.');
 try{await supabaseFetch('/rest/v1/student_documents',{method:'POST',body:JSON.stringify({organization_id,title:required(form.get('title'),'العنوان'),subject:optional(form.get('subject')),category:String(form.get('category')||'REFERENCE'),description:optional(form.get('description')),storage_path:path,original_filename:file.name,file_size:file.size})});}
 catch(error){await fetch(`${url}/storage/v1/object/student-library/${path}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${token}`}});throw error;}
},'تم وضع الملف على رف المكتبة.')}

export async function toggleDocumentFavorite(form:FormData){
 const org=await studentOrg(required(form.get('organization_id'),'المساحة'));
 await supabaseFetch(`/rest/v1/student_documents?id=eq.${encodeURIComponent(required(form.get('id'),'الملف'))}&organization_id=eq.${org}`,{method:'PATCH',body:JSON.stringify({is_favorite:String(form.get('is_favorite'))!=='true'})});
 revalidatePath('/student');
}

export async function deleteDocument(form:FormData){
 const org=await studentOrg(required(form.get('organization_id'),'المساحة')),id=required(form.get('id'),'الملف');
 const rows=await supabaseFetch(`/rest/v1/student_documents?id=eq.${encodeURIComponent(id)}&organization_id=eq.${org}&select=storage_path`),doc=rows?.[0];
 if(!doc)return;
 const{url,key}=supabaseConfig(),token=await serverToken();
 const response=await fetch(`${url}/storage/v1/object/student-library/${doc.storage_path}`,{method:'DELETE',headers:{apikey:key,Authorization:`Bearer ${token}`}});
 if(!response.ok)throw new Error('تعذر حذف الملف من التخزين.');
 await supabaseFetch(`/rest/v1/student_documents?id=eq.${encodeURIComponent(id)}&organization_id=eq.${org}`,{method:'DELETE'});
 revalidatePath('/student');
}
