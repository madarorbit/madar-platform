'use server';
import {supabaseFetch} from '@/src/lib/supabase/server';

export type CareerState={error?:string;success?:string};
const clean=(value:FormDataEntryValue|null,max:number)=>String(value||'').trim().slice(0,max);
export async function submitApplication(_previous:CareerState,form:FormData):Promise<CareerState>{
 try{
  if(clean(form.get('website'),200))return {success:'تم استلام طلبك بنجاح.'};
  const job_slug=clean(form.get('job_slug'),80),full_name=clean(form.get('full_name'),120),email=clean(form.get('email'),254).toLowerCase(),phone=clean(form.get('phone'),30)||null,location=clean(form.get('location'),120)||null,portfolio_url=clean(form.get('portfolio_url'),500)||null,experience_summary=clean(form.get('experience_summary'),4000);
  if(!['growth-marketing','platform-developer'].includes(job_slug))throw new Error('اختر وظيفة متاحة.');
  if(full_name.length<2)throw new Error('اكتب الاسم الكامل.');
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('اكتب بريداً إلكترونياً صحيحاً.');
  if(experience_summary.length<40)throw new Error('عرّفنا بخبرتك في 40 حرفاً على الأقل.');
  if(portfolio_url&&!/^https?:\/\//i.test(portfolio_url))throw new Error('رابط الأعمال يجب أن يبدأ بـ http أو https.');
  await supabaseFetch('/rest/v1/job_applications',{method:'POST',body:JSON.stringify({job_slug,full_name,email,phone,location,portfolio_url,experience_summary})});
  return {success:'وصل طلبك إلى فريق مَدار. سنراجع ملاءمته ونتواصل معك عبر البريد إذا انتقل للمرحلة التالية.'};
 }catch(error){return {error:error instanceof Error?error.message:'تعذر إرسال الطلب الآن. حاول لاحقاً.'};}
}
