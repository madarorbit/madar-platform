'use client';

import {useActionState} from 'react';
import {submitApplication,type CareerState} from '@/app/actions/careers';

const initial:CareerState={};

export function ApplicationForm({jobSlug,jobTitle}:{jobSlug:string;jobTitle:string}){
 const[state,action,pending]=useActionState(submitApplication,initial);
 return <form action={action} className="rounded-3xl border border-white/10 bg-white/[.05] p-6 sm:p-8">
  <input type="hidden" name="job_slug" value={jobSlug}/><div className="hidden" aria-hidden="true"><label>الموقع<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <div className="mb-6"><p className="text-sm font-bold text-[#70E4D4]">طلب الانضمام</p><h2 className="mt-2 text-2xl font-black">{jobTitle}</h2></div>
  <div className="grid gap-4 sm:grid-cols-2">
   <Field name="full_name" label="الاسم الكامل" required autoComplete="name"/>
   <Field name="phone" label="رقم الجوال للاتصال (اختياري)" type="tel" autoComplete="tel" placeholder="+967..."/>
   <div className="sm:col-span-2"><Field name="whatsapp_number" label="رقم الواتساب" type="tel" required autoComplete="tel" placeholder="اكتبه بصيغة دولية مثل +9677XXXXXXXX"/></div>
   <label className="sm:col-span-2 text-sm font-bold">نبذة عنك ومواهبك<textarea name="applicant_bio" required minLength={30} maxLength={3000} rows={6} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0B1020] p-4 text-white outline-none transition focus:border-[#70E4D4]" placeholder="عرّفنا بنفسك، خبراتك، مهاراتك، وأبرز ما تتقنه."/></label>
   <label className="sm:col-span-2 text-sm font-bold">سبب التقديم على الوظيفة<textarea name="application_reason" required minLength={20} maxLength={2000} rows={5} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0B1020] p-4 text-white outline-none transition focus:border-[#70E4D4]" placeholder="لماذا اخترت هذه الوظيفة، وما الذي تستطيع إضافته إلى مَدار؟"/></label>
   <label className="sm:col-span-2 text-sm font-bold">السيرة الذاتية (اختياري)<span className="mt-1 block text-xs font-normal text-slate-500">PDF أو DOC أو DOCX، بحد أقصى 5 MB.</span><input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0B1020] p-4 text-sm text-white"/></label>
  </div>
  {state.error&&<p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{state.error}</p>}
  {state.success&&<p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-100">{state.success}</p>}
  <button disabled={pending} className="mt-6 w-full rounded-2xl bg-gradient-to-l from-[#6C3BFF] to-[#00A98F] px-6 py-4 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{pending?'جارٍ إرسال الطلب…':'إرسال طلب التقديم'}</button>
  <p className="mt-4 text-xs leading-6 text-slate-400">تُحفظ بيانات الطلب والسيرة الذاتية بشكل خاص، ولا يطّلع عليها إلا حساب المؤسس لغرض مراجعة التوظيف.</p>
 </form>;
}

function Field({name,label,type='text',required=false,autoComplete,placeholder}:{name:string;label:string;type?:string;required?:boolean;autoComplete?:string;placeholder?:string}){
 return <label className="text-sm font-bold">{label}<input name={name} type={type} required={required} autoComplete={autoComplete} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0B1020] p-4 text-white outline-none transition focus:border-[#70E4D4]"/></label>;
}
