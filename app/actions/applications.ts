'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';

const clean=(value:FormDataEntryValue|null,max:number)=>String(value||'').trim().slice(0,max);

export async function reviewJobApplication(form:FormData){
 let destination='/admin/applications';
 try{
  const founder=await requireSuperAdmin(),id=clean(form.get('id'),80),decision=clean(form.get('decision'),20),review_notes=clean(form.get('review_notes'),1500)||null;
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('طلب التوظيف غير صالح.');
  if(!['approve','reject'].includes(decision))throw new Error('اختر الموافقة أو الرفض.');
  const status=decision==='approve'?'shortlisted':'rejected';
  await supabaseFetch(`/rest/v1/job_applications?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status,reviewed_by:founder.id,reviewed_at:new Date().toISOString(),review_notes})});
  revalidatePath('/admin/applications');
  destination=`/admin/applications?success=${encodeURIComponent(decision==='approve'?'تمت الموافقة المبدئية على الطلب.':'تم رفض الطلب.')}`;
 }catch(error){destination=`/admin/applications?error=${encodeURIComponent(error instanceof Error?error.message:'تعذر تحديث الطلب.')}`;}
 redirect(destination);
}
