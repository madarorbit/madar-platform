"use server";

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';

type State={error?:string};
const allowedAccounts=new Set(['PERSONAL','BUSINESS']);
const allowedModes=new Set(['MADAR_NATIVE','CONNECTED_EXTERNAL']);
const allowedPlans=new Set(['BASIC','PREMIUM','FULL']);
const allowedCurrencies=new Set(['SAR','USD','YER']);

export async function completeExistingCustomerOnboarding(_previous:State,form:FormData){
 let destination='/account';
 try{
  const user=await currentUser();
  if(!user)throw new Error('انتهت جلسة تسجيل الدخول. سجّل الدخول مجددًا.');
  const accountType=String(form.get('account_type')||'').toUpperCase();
  if(!allowedAccounts.has(accountType))throw new Error('اختر نوع الحساب للمتابعة.');

  const body:Record<string,string|number|null>={
   selected_account_type:accountType,
   selected_specialization_code:null,
   selected_operating_mode:null,
   selected_plan_level:null,
   selected_term_months:null,
   selected_currency:null,
   selected_business_name:null,
  };

  if(accountType==='BUSINESS'){
   const specialization=String(form.get('activity_specialization_code')||'').toUpperCase(),
    operatingMode=String(form.get('operating_mode')||'').toUpperCase(),
    planLevel=String(form.get('plan_level')||'').toUpperCase(),
    currency=String(form.get('currency')||'').toUpperCase(),
    termMonths=Number(form.get('term_months')),
    businessName=String(form.get('business_name')||'').trim();
   if(!/^[A-Z0-9_]{3,80}$/.test(specialization))throw new Error('اختر نشاطًا صالحًا.');
   if(!allowedModes.has(operatingMode))throw new Error('اختر طريقة تشغيل النشاط.');
   if(!allowedPlans.has(planLevel)||![1,6,12].includes(termMonths)||!allowedCurrencies.has(currency))throw new Error('اختر باقة ومدة وعملة صالحة.');
   if(businessName.length<2||businessName.length>120)throw new Error('اسم النشاط يجب أن يكون بين حرفين و120 حرفًا.');
   Object.assign(body,{
    selected_specialization_code:specialization,
    selected_operating_mode:operatingMode,
    selected_plan_level:planLevel,
    selected_term_months:termMonths,
    selected_currency:currency,
    selected_business_name:businessName,
   });
  }

  const result=await supabaseFetch('/rest/v1/rpc/complete_existing_customer_onboarding',{
   method:'POST',body:JSON.stringify(body),
  });
  destination=result==='PERSONAL'?'/student':'/workspace/setup';
 }catch(error){
  const message=error instanceof Error?error.message:'تعذر حفظ اختيارات الحساب.';
  const mapped=message.includes('EXISTING_BUSINESS_DATA_REQUIRES_BUSINESS_ACCOUNT')
   ?'هذا الحساب يملك بيانات تجارة فعلية، لذلك يجب إبقاؤه حساب أعمال لحماية بياناته.'
   :message.includes('EXISTING_STUDENT_DATA_REQUIRES_PERSONAL_ACCOUNT')
    ?'هذا الحساب يملك مساحة طالب وبيانات عليها، لذلك يجب إبقاؤه حسابًا شخصيًا.'
    :message.includes('REONBOARDING_NOT_REQUIRED')
     ?'تم إعداد هذا الحساب بالفعل.'
     :message;
  return{error:mapped};
 }
 revalidatePath('/account');
 revalidatePath('/workspace');
 revalidatePath('/student');
 redirect(destination);
}
