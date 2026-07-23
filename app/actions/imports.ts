'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {autoMap,importFields,parseCsv,validateMapping,type ImportEntity} from '@/src/lib/csv';
import {validateImportRows} from '@/src/lib/import-validation';
import {requireBusinessWorkspace} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {required} from '@/src/lib/validation';

const entities:ImportEntity[]=['products','customers','suppliers','expenses','sales'];
const go=(path:string,key:'success'|'error',message:string)=>redirect(`${path}?${key}=${encodeURIComponent(message)}`);

export async function prepareBusinessImport(form:FormData){
 let destination='/workspace/imports',errorMessage:string|undefined;
 try{
  const{user,workspace}=await requireBusinessWorkspace();
  const entity=String(form.get('entity_type')) as ImportEntity,file=form.get('file');
  if(!entities.includes(entity))throw new Error('نوع البيانات غير صالح.');
  if(!(file instanceof File)||!file.size)throw new Error('اختر ملف CSV.');
  if(file.size>1024*1024)throw new Error('حجم ملف CSV يجب ألا يتجاوز 1 ميجابايت.');
  const allowed=['text/csv','text/plain','application/vnd.ms-excel','application/csv',''];
  if(!allowed.includes(file.type))throw new Error('صيغة الملف غير مدعومة. استخدم CSV نصيًا.');
  const text=await file.text();
  if(text.includes('\u0000'))throw new Error('الملف ليس نص CSV صالحًا.');
  const{headers,rows}=parseCsv(text);
  const created=await supabaseFetch('/rest/v1/business_imports',{method:'POST',body:JSON.stringify({organization_id:workspace.id,entity_type:entity,file_name:file.name.slice(0,255),headers,rows,created_by:user.id})});
  const id=created?.[0]?.id;if(!id)throw new Error('تعذر إنشاء جلسة الاستيراد.');
  destination=`/workspace/imports/${id}`;
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر قراءة ملف الاستيراد.'}
 if(errorMessage)go('/workspace/imports','error',errorMessage);
 redirect(destination);
}

export async function commitBusinessImport(form:FormData){
 const importId=required(form.get('import_id'),'عملية الاستيراد');
 let errorMessage:string|undefined;
 try{
  const{workspace}=await requireBusinessWorkspace();
  const record=(await supabaseFetch(`/rest/v1/business_imports?id=eq.${encodeURIComponent(importId)}&organization_id=eq.${encodeURIComponent(workspace.id)}&select=id,entity_type,headers,rows,status`))?.[0];
  if(!record)throw new Error('عملية الاستيراد غير موجودة.');
  if(record.status!=='uploaded')throw new Error('تمت معالجة هذه العملية مسبقًا.');
  const entity=record.entity_type as ImportEntity;
  const mapping=Object.fromEntries(importFields[entity].map(field=>[field.key,String(form.get(`map_${field.key}`)||'')]));
  const validated=validateMapping(entity,mapping,record.headers);
  validateImportRows(entity,record.rows,validated);
  await supabaseFetch('/rest/v1/rpc/commit_business_import',{method:'POST',body:JSON.stringify({target_import:importId,column_mapping:validated})});
  revalidatePath('/workspace/imports');revalidatePath(`/workspace/imports/${importId}`);revalidatePath('/workspace');revalidatePath('/workspace/products');revalidatePath('/workspace/customers');revalidatePath('/workspace/suppliers');revalidatePath('/workspace/expenses');revalidatePath('/workspace/sales');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر تنفيذ الاستيراد.'}
 go(`/workspace/imports/${importId}`,errorMessage?'error':'success',errorMessage||'اكتمل استيراد البيانات بنجاح.');
}

export async function rollbackBusinessImport(form:FormData){
 const importId=required(form.get('import_id'),'عملية الاستيراد');
 let errorMessage:string|undefined;
 try{
  await requireBusinessWorkspace();
  await supabaseFetch('/rest/v1/rpc/rollback_business_import',{method:'POST',body:JSON.stringify({target_import:importId})});
  revalidatePath('/workspace/imports');revalidatePath(`/workspace/imports/${importId}`);revalidatePath('/workspace');revalidatePath('/workspace/products');revalidatePath('/workspace/customers');revalidatePath('/workspace/suppliers');revalidatePath('/workspace/expenses');revalidatePath('/workspace/sales');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر التراجع عن الاستيراد.'}
 go(`/workspace/imports/${importId}`,errorMessage?'error':'success',errorMessage||'تم التراجع عن البيانات المستوردة.');
}

export async function completeBusinessSetup(form:FormData){
 let errorMessage:string|undefined;
 try{
  const{workspace,membership}=await requireBusinessWorkspace();
  if(!['OWNER','ADMIN'].includes(membership.role))throw new Error('لا تملك صلاحية تعديل إعدادات التجارة.');
  const currency=String(form.get('currency'));
  if(!['YER','SAR','USD'].includes(currency))throw new Error('العملة غير صالحة.');
  const industry=required(form.get('industry'),'قطاع النشاط').slice(0,120);
  await supabaseFetch(`/rest/v1/organizations?id=eq.${encodeURIComponent(workspace.id)}`,{method:'PATCH',body:JSON.stringify({industry,currency,onboarding_completed_at:new Date().toISOString()})});
  revalidatePath('/workspace');revalidatePath('/workspace/setup');revalidatePath('/dashboard');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر حفظ إعداد التجارة.'}
 go('/workspace/setup',errorMessage?'error':'success',errorMessage||'اكتمل الإعداد الأساسي للتجارة.');
}

export async function useAutomaticMapping(form:FormData){
 const entity=String(form.get('entity_type')) as ImportEntity,headers=JSON.parse(required(form.get('headers'),'الأعمدة')) as string[];
 if(!entities.includes(entity))throw new Error('نوع البيانات غير صالح.');
 return autoMap(headers,entity);
}
