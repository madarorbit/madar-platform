'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin,requireUser} from '@/src/lib/auth';
import {removeLocalPaymentProof,uploadLocalPaymentProof} from '@/src/lib/local-payments';
import {supabaseFetch} from '@/src/lib/supabase/server';

export type OrbyPlusActionState={error?:string;success?:string};
const text=(form:FormData,key:string,max=200)=>String(form.get(key)||'').trim().slice(0,max);

export async function submitOrbyPlusPayment(_previous:OrbyPlusActionState,form:FormData):Promise<OrbyPlusActionState>{
 const user=await requireUser();let uploaded:Awaited<ReturnType<typeof uploadLocalPaymentProof>>|null=null;
 try{
  const method=text(form,'payment_method_id',60),currency=text(form,'payment_currency',12).toUpperCase(),reference=text(form,'payment_reference',120),proof=form.get('proof');
  if(!/^[0-9a-f-]{36}$/i.test(method)||!currency||reference.length<3)return{error:'اختر وسيلة وعملة دفع واكتب رقم الحوالة.'};
  if(proof instanceof File&&proof.size)uploaded=await uploadLocalPaymentProof(proof,user.id,'orby-plus');
  await supabaseFetch('/rest/v1/rpc/create_orby_plus_payment_request',{method:'POST',body:JSON.stringify({target_method:method,target_payment_currency:currency,reference,proof_path:uploaded?.storagePath||null,proof_name:uploaded?.originalFilename||null,proof_mime:uploaded?.mimeType||null,proof_size:uploaded?.fileSize||null})});
  revalidatePath('/orby');revalidatePath('/orby/plus');revalidatePath('/admin/orby-plus');
  return{success:'تم إرسال طلب ORBY Plus للمراجعة. سنشعرك فور اعتماد الدفع.'};
 }catch(error){if(uploaded)await removeLocalPaymentProof(uploaded.storagePath);return{error:error instanceof Error?error.message:'تعذر إرسال طلب ORBY Plus.'};}
}

export async function configureOrbyPlusPlan(_previous:OrbyPlusActionState,form:FormData):Promise<OrbyPlusActionState>{
 try{
  await requireAdmin();const price=Number(form.get('price')),currency=text(form,'currency',12).toUpperCase(),billingMonths=Number(form.get('billing_months')),available=form.get('is_available')==='true';
  if(!Number.isFinite(price)||price<0||!currency||!Number.isInteger(billingMonths)||billingMonths<1||billingMonths>36)return{error:'إعدادات ORBY Plus غير صالحة.'};
  await supabaseFetch('/rest/v1/rpc/configure_orby_plus_plan',{method:'POST',body:JSON.stringify({target_price:price,target_currency:currency,target_billing_months:billingMonths,target_available:available})});
  revalidatePath('/orby/plus');revalidatePath('/admin/orby-plus');
  return{success:'تم حفظ إعدادات ORBY Plus.'};
 }catch(error){return{error:error instanceof Error?error.message:'تعذر حفظ إعدادات ORBY Plus.'};}
}

export async function reviewOrbyPlusPayment(_previous:OrbyPlusActionState,form:FormData):Promise<OrbyPlusActionState>{
 try{
  await requireAdmin();const requestId=text(form,'request_id',60),decision=text(form,'decision',20),note=text(form,'note',500)||null;
  if(!/^[0-9a-f-]{36}$/i.test(requestId)||!['approve','reject'].includes(decision))return{error:'قرار المراجعة غير صالح.'};
  await supabaseFetch('/rest/v1/rpc/review_orby_plus_payment_request',{method:'POST',body:JSON.stringify({target_request:requestId,decision,note})});
  revalidatePath('/orby');revalidatePath('/orby/plus');revalidatePath('/admin/orby-plus');
  return{success:decision==='approve'?'تم اعتماد الدفع وتفعيل ORBY Plus.':'تم رفض طلب ORBY Plus.'};
 }catch(error){return{error:error instanceof Error?error.message:'تعذر مراجعة طلب ORBY Plus.'};}
}
