"use client";

import {useActionState,useMemo,useState} from 'react';
import {completeExistingCustomerOnboarding} from '@/app/actions/reonboarding';
import {quotePrice} from '@/src/lib/v2/pricing';
import type {AccountType,OperatingMode,PlanLevel,PlanTerm,SupportedCurrency} from '@/src/lib/v2/account';

type State={error?:string};
type Props={
 specializations:Array<{code:string;nameAr:string}>;
 lockedAccountType:AccountType|null;
 initialAccountType:AccountType;
 initialBusinessName:string;
 initialMode:OperatingMode;
 initialLevel:PlanLevel;
 initialTerm:PlanTerm;
 initialCurrency:SupportedCurrency;
};

export default function ExistingAccountWizard(props:Props){
 const[state,action,pending]=useActionState<State,FormData>(completeExistingCustomerOnboarding,{}),
  [step,setStep]=useState(0),
  [accountType,setAccountType]=useState<AccountType>(props.lockedAccountType||props.initialAccountType),
  [mode,setMode]=useState<OperatingMode>(props.initialMode),
  [level,setLevel]=useState<PlanLevel>(props.initialLevel),
  [term,setTerm]=useState<PlanTerm>(props.initialTerm),
  [currency,setCurrency]=useState<SupportedCurrency>(props.initialCurrency),
  quote=useMemo(()=>quotePrice(level,term,mode,currency),[level,term,mode,currency]),
  lastStep=accountType==='PERSONAL'?1:3;
 const next=()=>setStep(value=>Math.min(lastStep,value+1));
 const back=()=>setStep(value=>Math.max(0,value-1));
 return <form action={action} className="mx-auto grid max-w-3xl gap-6 rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-8">
  <input type="hidden" name="account_type" value={accountType}/>
  <header><p className="text-sm font-bold text-emerald-300">إعداد مَدار V2.0</p><h1 className="mt-2 text-3xl font-black">خصص حسابك وتجارتك</h1><p className="mt-3 leading-7 text-slate-400">لن تُحذف منتجاتك أو مبيعاتك أو عملاؤك أو أي بيانات سابقة. ستُحدّث فقط هوية الحساب والنشاط والباقة.</p></header>

  {step===0&&<section className="grid gap-4"><h2 className="text-xl font-black">نوع الحساب</h2><div className="grid gap-3 sm:grid-cols-2">{(['PERSONAL','BUSINESS'] as const).map(value=>{const disabled=Boolean(props.lockedAccountType&&props.lockedAccountType!==value);return <button type="button" disabled={disabled} onClick={()=>setAccountType(value)} key={value} className={`rounded-2xl border p-5 text-right ${accountType===value?'border-violet-300/60 bg-violet-300/10':'border-white/10'} ${disabled?'cursor-not-allowed opacity-40':''}`}><strong>{value==='PERSONAL'?'حساب شخصي':'حساب أعمال'}</strong><span className="mt-2 block text-sm leading-6 text-slate-400">{value==='PERSONAL'?'مساحة الطالب وأوربي الشخصي.':'تجارة ونشاط وباقة وأدوات أعمال.'}</span></button>})}</div>{props.lockedAccountType&&<p className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">تم تثبيت نوع الحساب لحماية البيانات الموجودة عليه؛ يمكنك تخصيص بقية الإعدادات بأمان.</p>}</section>}

  {step===1&&accountType==='BUSINESS'&&<section className="grid gap-4"><h2 className="text-xl font-black">النشاط وطريقة التشغيل</h2><label className="grid gap-2"><span className="font-bold">اسم النشاط</span><input required minLength={2} maxLength={120} name="business_name" defaultValue={props.initialBusinessName} className="field rounded-xl p-3"/></label><label className="grid gap-2"><span className="font-bold">نوع النشاط</span><select name="activity_specialization_code" className="field rounded-xl p-3">{props.specializations.map(item=><option key={item.code} value={item.code}>{item.nameAr}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2">{(['MADAR_NATIVE','CONNECTED_EXTERNAL'] as const).map(value=><label key={value} className={`cursor-pointer rounded-2xl border p-4 ${mode===value?'border-emerald-300/50 bg-emerald-300/10':'border-white/10'}`}><input className="sr-only" type="radio" name="operating_mode" value={value} checked={mode===value} onChange={()=>setMode(value)}/><strong>{value==='MADAR_NATIVE'?'تشغيل كامل داخل مَدار':'ربط نظام قائم'}</strong></label>)}</div></section>}

  {step===2&&accountType==='BUSINESS'&&<section className="grid gap-5"><h2 className="text-xl font-black">الباقة والمدة</h2><div className="grid gap-3 sm:grid-cols-3">{(['BASIC','PREMIUM','FULL'] as const).map(value=><label key={value} className={`cursor-pointer rounded-2xl border p-4 ${level===value?'border-violet-300/50 bg-violet-300/10':'border-white/10'}`}><input className="sr-only" type="radio" name="plan_level" value={value} checked={level===value} onChange={()=>setLevel(value)}/><strong>{value==='BASIC'?'العادية':value==='PREMIUM'?'المميزة':'الكاملة'}</strong></label>)}</div><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2"><span className="font-bold">المدة</span><select name="term_months" value={term} onChange={e=>setTerm(Number(e.target.value) as PlanTerm)} className="field rounded-xl p-3"><option value={1}>شهر</option><option value={6}>6 أشهر</option><option value={12}>12 شهرًا</option></select></label><label className="grid gap-2"><span className="font-bold">العملة</span><select name="currency" value={currency} onChange={e=>setCurrency(e.target.value as SupportedCurrency)} className="field rounded-xl p-3"><option value="SAR">SAR</option><option value="USD">USD</option><option value="YER">YER</option></select></label></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-5"><span className="text-sm text-slate-400">القيمة المختارة</span><strong className="mt-2 block text-3xl text-emerald-200">{quote.amount.toLocaleString('ar-SA')} {currency}</strong></div></section>}

  {step===lastStep&&<section className="grid gap-4"><h2 className="text-xl font-black">تأكيد التخصيص</h2><div className="rounded-2xl border border-white/10 bg-white/[.025] p-5 leading-8"><p><b>نوع الحساب:</b> {accountType==='PERSONAL'?'شخصي':'أعمال'}</p>{accountType==='BUSINESS'&&<><p><b>طريقة التشغيل:</b> {mode==='MADAR_NATIVE'?'داخل مَدار':'نظام مرتبط'}</p><p><b>الباقة:</b> {level} — {term} شهر</p></>}</div><button disabled={pending} className="md-button md-button-primary w-full">{pending?'جارٍ الحفظ…':'حفظ وفتح المزايا الجديدة'}</button></section>}

  {state.error&&<p className="rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-sm text-red-100">{state.error}</p>}
  <div className="flex justify-between gap-3">{step>0&&<button type="button" onClick={back} className="md-button md-button-secondary">السابق</button>}{step<lastStep&&<button type="button" onClick={next} className="md-button md-button-primary mr-auto">التالي</button>}</div>
 </form>;
}
