'use client';

import {useMemo,useState} from 'react';
import {useFormStatus} from 'react-dom';
import {submitV2LocalPayment} from '@/app/actions/local-payments';

type CatalogItem={
 id:string;
 code:string;
 level_code:string;
 name_ar:string;
 term_months:number;
 currency:string;
 amount:number;
 monthly_equivalent:number;
 launch_notice:string;
};
type Method={
 id:string;
 name:string;
 currency:string;
 account_name:string;
 account_identifier:string;
 instructions:string|null;
};
const field='field w-full rounded-xl p-3';

export default function V2PaymentForm({catalog,methods,currentLevel='BASIC'}:{catalog:CatalogItem[];methods:Method[];currentLevel?:string}){
 const eligible=useMemo(()=>catalog.filter(item=>rank(item.level_code)>=rank(currentLevel)),[catalog,currentLevel]);
 const[first]=eligible;
 const[selection,setSelection]=useState(first?`${first.id}:${first.currency}`:'');
 const variant=eligible.find(item=>`${item.id}:${item.currency}`===selection)||first;
 const matching=useMemo(()=>methods.filter(method=>method.currency===variant?.currency),[methods,variant?.currency]);
 const[methodId,setMethodId]=useState('');
 const method=matching.find(item=>item.id===methodId);

 if(!eligible.length)return <aside className="md-panel"><h2 className="text-xl font-black">لا توجد باقات متاحة</h2><p className="mt-2 text-sm leading-7 text-slate-400">تعذر تحميل كتالوج مَدار V2.0. لم تُنشأ أي عملية دفع، ويجب مراجعة إعدادات التسعير من الإدارة.</p></aside>;

 return <form action={submitV2LocalPayment} encType="multipart/form-data" className="md-panel grid gap-4">
  <div><h2 className="text-xl font-black">الدفع أو الترقية</h2><p className="mt-2 text-sm leading-7 text-slate-400">لن يتغير الوصول أو تاريخ الاشتراك قبل مراجعة الإدارة واعتماد إثبات التحويل.</p></div>
  <label className="grid gap-2 text-sm font-bold">الباقة والمدة<select aria-label="الباقة والمدة" value={selection} onChange={event=>{setSelection(event.target.value);setMethodId('')}} required className={field}>{eligible.map(item=><option key={`${item.id}-${item.currency}`} value={`${item.id}:${item.currency}`}>{item.name_ar} · {item.term_months} شهر · {item.amount.toLocaleString('ar-SA')} {item.currency}</option>)}</select></label>
  {variant&&<><input type="hidden" name="variant_id" value={variant.id}/><input type="hidden" name="currency" value={variant.currency}/><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-4"><strong className="text-2xl text-emerald-200">{variant.amount.toLocaleString('ar-SA')} {variant.currency}</strong><p className="mt-1 text-xs text-slate-400">ما يعادل {variant.monthly_equivalent.toLocaleString('ar-SA')} {variant.currency} شهريًا</p><p className="mt-3 text-xs leading-6 text-amber-100">{variant.launch_notice}</p></div></>}
  <label className="grid gap-2 text-sm font-bold">طريقة الدفع<select name="payment_method_id" value={methodId} onChange={event=>setMethodId(event.target.value)} required className={field}><option value="">اختر طريقة بعملة {variant?.currency}</option>{matching.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  {method&&<div className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm"><p className="text-xs text-slate-500">اسم الحساب</p><strong className="mt-1 block">{method.account_name}</strong><p className="mt-3 text-xs text-slate-500">رقم الحساب أو المحفظة</p><strong dir="ltr" className="mt-1 block text-right text-lg">{method.account_identifier}</strong>{method.instructions&&<p className="mt-3 leading-7 text-slate-300">{method.instructions}</p>}</div>}
  <label className="grid gap-2 text-sm font-bold">رقم عملية التحويل<input name="payment_reference" required minLength={3} maxLength={120} autoComplete="off" className={field} placeholder="الرقم الظاهر في إيصال التحويل"/></label>
  <label className="grid gap-2 text-sm font-bold">إثبات التحويل<input name="proof" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className={field}/><span className="text-xs font-normal leading-6 text-slate-500">JPG أو PNG أو WebP أو PDF صالح، وبحد أقصى 10MB. الملف خاص بفريق الإدارة المخوّل.</span></label>
  <SubmitButton disabled={!methodId}/>
  {variant&&matching.length===0&&<p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">لا توجد طريقة دفع مفعّلة بعملة {variant.currency} حاليًا. لن يقبل النموذج طلبًا دون طريقة مطابقة.</p>}
 </form>;
}

function SubmitButton({disabled}:{disabled:boolean}){
 const{pending}=useFormStatus();
 return <button disabled={disabled||pending} className="md-button md-button-primary disabled:cursor-not-allowed disabled:opacity-50">{pending?'جارٍ إرسال الطلب…':'إرسال الدفع للمراجعة'}</button>;
}
function rank(level:string){return level==='BASIC'?1:level==='PREMIUM'?2:3}
