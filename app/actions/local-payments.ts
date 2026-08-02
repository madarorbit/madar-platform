'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireAdmin,requireUser} from '@/src/lib/auth';
import {requireBusinessWorkspace} from '@/src/lib/business';
import {removeLocalPaymentProof,uploadLocalPaymentProof} from '@/src/lib/local-payments';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {required} from '@/src/lib/validation';

const finish=(path:string,error?:string,success?:string)=>redirect(`${path}?${error?'error':'success'}=${encodeURIComponent(error||success||'تمت العملية.')}`);

export async function submitWorkspaceLocalPayment(form:FormData){
 const requestId=required(form.get('request_id'),'طلب المساحة');let proof,errorMessage:string|undefined;
 try{
  const user=await requireUser(),file=form.get('proof');if(!(file instanceof File))throw new Error('اختر إثبات التحويل.');
  proof=await uploadLocalPaymentProof(file,`workspace/${user.id}/${requestId}`);
  await supabaseFetch('/rest/v1/rpc/submit_workspace_payment_v2',{method:'POST',body:JSON.stringify({target_request:requestId,target_method:required(form.get('payment_method_id'),'طريقة الدفع'),reference:required(form.get('payment_reference'),'رقم العملية'),proof_path:proof.storagePath,proof_name:proof.originalFilename,proof_mime:proof.mimeType,proof_size:proof.fileSize})});
  revalidatePath(`/workspace-payment/${requestId}`);revalidatePath('/dashboard');
 }catch(error){if(proof)await removeLocalPaymentProof(proof.storagePath);errorMessage=error instanceof Error?error.message:'تعذر إرسال إثبات الدفع.'}
 finish(`/workspace-payment/${requestId}`,errorMessage,'تم إرسال الإثبات. ستراجع الإدارة الدفع وتفتح المساحة بعد اعتماده.');
}

export async function submitSubscriptionRenewal(form:FormData){
 let proof,errorMessage:string|undefined;
 try{
  const{workspace,user}=await requireBusinessWorkspace({allowExpired:true}),file=form.get('proof');if(!(file instanceof File))throw new Error('اختر إثبات التحويل.');
  proof=await uploadLocalPaymentProof(file,`renewal/${user.id}/${workspace.id}`);
  await supabaseFetch('/rest/v1/rpc/submit_subscription_renewal',{method:'POST',body:JSON.stringify({target_organization:workspace.id,target_method:required(form.get('payment_method_id'),'طريقة الدفع'),reference:required(form.get('payment_reference'),'رقم العملية'),proof_path:proof.storagePath,proof_name:proof.originalFilename,proof_mime:proof.mimeType,proof_size:proof.fileSize})});
  revalidatePath('/account/subscription');
 }catch(error){if(proof)await removeLocalPaymentProof(proof.storagePath);errorMessage=error instanceof Error?error.message:'تعذر إرسال طلب التجديد.'}
 finish('/account/subscription',errorMessage,'تم إرسال طلب التجديد للمراجعة.');
}

export async function submitV2LocalPayment(form:FormData){
 let proof,errorMessage:string|undefined;
 try{
  const{workspace,user}=await requireBusinessWorkspace({allowExpired:true}),file=form.get('proof');if(!(file instanceof File))throw new Error('اختر إثبات التحويل.');
  proof=await uploadLocalPaymentProof(file,`v2/${user.id}/${workspace.id}`);
  await supabaseFetch('/rest/v1/rpc/submit_v2_local_payment',{method:'POST',body:JSON.stringify({target_organization:workspace.id,target_variant:required(form.get('variant_id'),'الباقة'),target_method:required(form.get('payment_method_id'),'طريقة الدفع'),target_currency:required(form.get('currency'),'العملة'),reference:required(form.get('payment_reference'),'رقم العملية'),proof_path:proof.storagePath,proof_name:proof.originalFilename,proof_mime:proof.mimeType,proof_size:proof.fileSize})});
  revalidatePath('/account/subscription');revalidatePath('/admin/local-payments');
 }catch(error){if(proof)await removeLocalPaymentProof(proof.storagePath);errorMessage=error instanceof Error?error.message:'تعذر إرسال طلب دفع الباقة.'}
 finish('/account/subscription',errorMessage,'تم إرسال دفع الباقة للمراجعة، وستُفعّل فور اعتماده.');
}

export async function savePaymentMethod(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireAdmin();const id=required(form.get('id'),'طريقة الدفع'),accountName=String(form.get('account_name')||'').trim()||null,identifier=String(form.get('account_identifier')||'').trim()||null,isActive=String(form.get('is_active'))==='true';
  if(isActive&&(!accountName||!identifier))throw new Error('أضف اسم الحساب ورقمه قبل تفعيل الطريقة.');
  const currency=String(form.get('currency'));if(!['YER','SAR','USD'].includes(currency))throw new Error('العملة غير صالحة.');
  await supabaseFetch(`/rest/v1/payment_methods?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({account_name:accountName,account_identifier:identifier,instructions:String(form.get('instructions')||'').trim()||null,currency,is_active:isActive,sort_order:Number(form.get('sort_order')||100)})});
  revalidatePath('/admin/local-payments');revalidatePath('/account/subscription');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر حفظ طريقة الدفع.'}
 finish('/admin/local-payments',errorMessage,'تم تحديث طريقة الدفع.');
}

export async function reviewSubscriptionRenewal(form:FormData){
 let errorMessage:string|undefined;
 try{
  await requireAdmin();const decision=String(form.get('decision'));if(!['approve','reject'].includes(decision))throw new Error('القرار غير صالح.');
  await supabaseFetch('/rest/v1/rpc/review_subscription_renewal',{method:'POST',body:JSON.stringify({target_renewal:required(form.get('renewal_id'),'طلب التجديد'),decision,note:String(form.get('note')||'').trim()||null})});
  revalidatePath('/admin/local-payments');revalidatePath('/account/subscription');
 }catch(error){errorMessage=error instanceof Error?error.message:'تعذر مراجعة طلب التجديد.'}
 finish('/admin/local-payments',errorMessage,'تم حفظ قرار التجديد.');
}

export async function reviewV2LocalPayment(form:FormData){
 let errorMessage:string|undefined;
 try{await requireAdmin();const decision=String(form.get('decision'));if(!['approve','reject'].includes(decision))throw new Error('القرار غير صالح.');await supabaseFetch('/rest/v1/rpc/review_v2_local_payment',{method:'POST',body:JSON.stringify({target_request:required(form.get('request_id'),'طلب الدفع'),decision,note:String(form.get('note')||'').trim()||null})});revalidatePath('/admin/local-payments');revalidatePath('/account/subscription');}
 catch(error){errorMessage=error instanceof Error?error.message:'تعذر مراجعة دفع الباقة.'}
 finish('/admin/local-payments',errorMessage,'تم حفظ قرار دفع الباقة.');
}
