'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {required} from '@/src/lib/validation';

const finish=(path:string,error?:string,success?:string)=>redirect(`${path}?${error?'error':'success'}=${encodeURIComponent(error||success||'تمت العملية.')}`);
const clean=(value:FormDataEntryValue|null,max=2000)=>String(value||'').trim().slice(0,max)||null;
const internalLink=(value:FormDataEntryValue|null)=>{
 const link=clean(value,500);
 if(!link)return null;
 if(!link.startsWith('/')||link.startsWith('//'))throw new Error('رابط الإشعار يجب أن يكون مسارًا داخليًا آمنًا داخل مَدار.');
 return link;
};

export async function saveFounderSettings(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireSuperAdmin();
  const supportEmail=clean(form.get('support_email'),320);
  if(supportEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))throw new Error('بريد الدعم غير صالح.');
  await supabaseFetch('/rest/v1/rpc/founder_update_settings',{method:'POST',body:JSON.stringify({
   registration_open:form.get('beta_registration_open')==='on',workspace_enabled:form.get('workspace_creation_enabled')==='on',store_open:form.get('store_enabled')==='on',orby_open:form.get('orby_enabled')==='on',maintenance:form.get('maintenance_mode')==='on',maintenance_text:clean(form.get('maintenance_message'),1000),announcement_enabled:form.get('announcement_active')==='on',announcement_heading:clean(form.get('announcement_title'),180),announcement_text:clean(form.get('announcement_body'),2000),support_mail:supportEmail,support_phone:clean(form.get('support_whatsapp'),100)
  })});
  revalidatePath('/');revalidatePath('/register');revalidatePath('/admin/founder');revalidatePath('/admin/founder/settings');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر حفظ إعدادات المنصة.'}
 finish('/admin/founder/settings',errorMessage,'تم تحديث إعدادات المنصة وتسجيل القرار.');
}

export async function updateFounderUser(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireSuperAdmin();
  const role=String(form.get('role')),status=String(form.get('status'));
  if(!['SUPER_ADMIN','ADMIN','EDITOR','CUSTOMER'].includes(role)||!['active','disabled'].includes(status))throw new Error('صلاحية أو حالة الحساب غير صالحة.');
  await supabaseFetch('/rest/v1/rpc/founder_update_user',{method:'POST',body:JSON.stringify({target_user:required(form.get('user_id'),'المستخدم'),new_role:role,new_status:status})});
  revalidatePath('/admin/founder/users');revalidatePath('/admin/users');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر تحديث الحساب. حساب المؤسس محمي من التعطيل أو خفض الصلاحية.'}
 finish('/admin/founder/users',errorMessage,'تم تحديث الحساب وإشعار صاحبه.');
}

export async function updateFounderOrganization(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireSuperAdmin();const status=String(form.get('status'));
  if(!['active','suspended','archived'].includes(status))throw new Error('حالة المساحة غير صالحة.');
  await supabaseFetch('/rest/v1/rpc/founder_update_organization',{method:'POST',body:JSON.stringify({target_organization:required(form.get('organization_id'),'المساحة'),new_status:status})});
  revalidatePath('/admin/founder/workspaces');revalidatePath('/dashboard');revalidatePath('/workspace');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر تحديث مساحة العمل.'}
 finish('/admin/founder/workspaces',errorMessage,'تم تحديث حالة المساحة وإشعار إدارتها.');
}

export async function adjustFounderV2Subscription(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireSuperAdmin();
  const days=Number(form.get('days_delta')||0),status=String(form.get('subscription_status'));
  if(!Number.isInteger(days)||days<-3650||days>3650)throw new Error('تعديل الأيام غير صالح.');
  if(!['active','past_due','expired','cancelled'].includes(status))throw new Error('حالة اشتراك V2 غير صالحة.');
  await supabaseFetch('/rest/v1/rpc/founder_adjust_v2_subscription',{method:'POST',body:JSON.stringify({target_organization:required(form.get('organization_id'),'المساحة'),days_delta:days,requested_status:status})});
  revalidatePath('/admin/founder');revalidatePath('/admin/founder/workspaces');revalidatePath('/account/subscription');revalidatePath('/workspace');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر تعديل اشتراك V2.'}
 finish('/admin/founder/workspaces',errorMessage,'تم تعديل اشتراك V2 وتسجيل العملية وإشعار إدارة المساحة.');
}

export async function broadcastFounderNotification(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireSuperAdmin();const audience=String(form.get('audience'));
  if(!['all','customers','admins','workspace'].includes(audience))throw new Error('الجمهور غير صالح.');
  const targetOrganization=clean(form.get('organization_id'),100);
  if(audience==='workspace'&&!targetOrganization)throw new Error('اختر مساحة العمل المستهدفة.');
  const result=await supabaseFetch('/rest/v1/rpc/founder_broadcast_notification',{method:'POST',body:JSON.stringify({audience,target_organization:targetOrganization,notice_title:required(form.get('title'),'العنوان').slice(0,180),notice_body:required(form.get('body'),'الرسالة').slice(0,2000),notice_link:internalLink(form.get('link'))})});
  revalidatePath('/admin/founder');revalidatePath('/account/notifications');
  const count=Array.isArray(result)?result[0]:result;
  return finish('/admin/founder',undefined,`تم إرسال الإشعار إلى ${Number(count||0).toLocaleString('ar-YE')} حساب.`);
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر إرسال الإشعار.'}
 finish('/admin/founder',errorMessage);
}
