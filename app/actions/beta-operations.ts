'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireAdmin,requireUser} from '@/src/lib/auth';
import {requireBusinessWorkspace} from '@/src/lib/business';
import {removeFeedbackAttachment,uploadFeedbackAttachment} from '@/src/lib/feedback-attachments';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {required} from '@/src/lib/validation';

const finish=(path:string,error?:string,success?:string)=>redirect(`${path}?${error?'error':'success'}=${encodeURIComponent(error||success||'تمت العملية.')}`);

export async function submitBetaFeedback(form:FormData){
 let attachment,errorMessage:string|undefined;
 try{
  const user=await requireUser(),organizationId=String(form.get('organization_id')||'').trim()||null,file=form.get('attachment');
  if(file instanceof File&&file.size)attachment=await uploadFeedbackAttachment(file,user.id);
  const type=String(form.get('feedback_type')),severity=String(form.get('severity'));
  if(!['bug','suggestion','question','rating'].includes(type))throw new Error('نوع البلاغ غير صالح.');
  if(!['low','normal','high','critical'].includes(severity))throw new Error('درجة الأهمية غير صالحة.');
  const ratingValue=String(form.get('rating')||'').trim(),rating=ratingValue?Number(ratingValue):null;
  if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))throw new Error('التقييم يجب أن يكون من 1 إلى 5.');
  await supabaseFetch('/rest/v1/platform_feedback',{method:'POST',body:JSON.stringify({user_id:user.id,organization_id:organizationId,feedback_type:type,severity,title:required(form.get('title'),'العنوان').slice(0,180),message:required(form.get('message'),'التفاصيل').slice(0,5000),page_path:String(form.get('page_path')||'').trim().slice(0,500)||null,rating,attachment_path:attachment?.path||null,attachment_name:attachment?.name||null,attachment_mime:attachment?.mime||null,attachment_size:attachment?.size||null})});
  revalidatePath('/account/support');revalidatePath('/admin/beta-operations');
 }catch(error){if(attachment)await removeFeedbackAttachment(attachment.path);errorMessage=error instanceof Error?error.message:'تعذر إرسال البلاغ.'}
 finish('/account/support',errorMessage,'وصل بلاغك إلى فريق مَدار. يمكنك متابعة حالته من هذه الصفحة.');
}

export async function updateBetaFeedback(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireAdmin();const status=String(form.get('status'));if(!['new','reviewing','planned','resolved','closed'].includes(status))throw new Error('الحالة غير صالحة.');
  await supabaseFetch(`/rest/v1/platform_feedback?id=eq.${encodeURIComponent(required(form.get('feedback_id'),'البلاغ'))}`,{method:'PATCH',body:JSON.stringify({status,admin_note:String(form.get('admin_note')||'').trim().slice(0,3000)||null,resolved_at:['resolved','closed'].includes(status)?new Date().toISOString():null})});
  revalidatePath('/admin/beta-operations');revalidatePath('/account/support');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر تحديث البلاغ.'}
 finish('/admin/beta-operations',errorMessage,'تم تحديث البلاغ.');
}

export async function createPrivacyRequest(form:FormData){
 let errorMessage:string|undefined;
 try{
  const kind=String(form.get('request_kind')),needsWorkspace=kind.includes('workspace');let organizationId:string|null=null;
  if(needsWorkspace){const{workspace}=await requireBusinessWorkspace({allowExpired:true});organizationId=workspace.id}else await requireUser();
  await supabaseFetch('/rest/v1/rpc/create_privacy_request',{method:'POST',body:JSON.stringify({target_organization:organizationId,request_kind:kind,request_reason:String(form.get('reason')||'').trim().slice(0,2000)||null,confirmation:String(form.get('confirmation')||'').trim()||null})});
  revalidatePath('/account/privacy');revalidatePath('/admin/beta-operations');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر إنشاء الطلب.'}
 finish('/account/privacy',errorMessage,'تم تسجيل طلبك ويمكنك متابعة حالته هنا.');
}

export async function cancelPrivacyRequest(form:FormData){
 let errorMessage:string|undefined;
 try{await requireUser();await supabaseFetch('/rest/v1/rpc/cancel_privacy_request',{method:'POST',body:JSON.stringify({target_request:required(form.get('request_id'),'الطلب')})});revalidatePath('/account/privacy');revalidatePath('/admin/beta-operations');}catch(error){errorMessage=error instanceof Error?error.message:'تعذر إلغاء الطلب.'}
 finish('/account/privacy',errorMessage,'تم إلغاء الطلب.');
}

export async function reviewPrivacyRequest(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireAdmin();const status=String(form.get('status'));if(!['processing','completed','rejected'].includes(status))throw new Error('الحالة غير صالحة.');
  await supabaseFetch('/rest/v1/rpc/review_privacy_request',{method:'POST',body:JSON.stringify({target_request:required(form.get('request_id'),'الطلب'),new_status:status,note:String(form.get('admin_note')||'').trim().slice(0,3000)||null})});
  revalidatePath('/admin/beta-operations');revalidatePath('/account/privacy');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر مراجعة الطلب.'}
 finish('/admin/beta-operations',errorMessage,'تم تحديث طلب الخصوصية.');
}
