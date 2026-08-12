import Link from 'next/link';
import {requireUser} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import OrbyPlusCheckout from '@/components/orby/OrbyPlusCheckout';
import {formatStoreMoney,type CurrencyDefinition,type ExchangeRateDefinition} from '@/src/lib/store/currency';

export const dynamic='force-dynamic';
export const metadata={title:'ORBY Plus | مَدار'};

type Plan={id:string;price:number|string;currency:string;billing_months:number;is_available:boolean;is_active:boolean};
type PlusSub={status:string;starts_at:string;ends_at:string};
type Pending={id:string;status:string;payment_amount:number|string;payment_currency:string;created_at:string};
type Method={id:string;name:string;account_name:string|null;account_identifier:string|null;instructions:string|null;currency_agnostic:boolean};
type Restriction={payment_method_id:string;currency_code:string};

export default async function OrbyPlusPage(){
 const user=await requireUser();
 const[planRows,subRows,pendingRows,currencyRows,rateRows,methodRows,restrictionRows,usageRaw]=await Promise.all([
  supabaseFetch('/rest/v1/subscription_plans?service_code=eq.ORBY_PLUS&code=eq.ORBY-PLUS&select=id,price,currency,billing_months,is_available,is_active&limit=1').catch(()=>[]),
  supabaseFetch(`/rest/v1/orby_plus_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=status,starts_at,ends_at&limit=1`).catch(()=>[]),
  supabaseFetch(`/rest/v1/orby_plus_payment_requests?user_id=eq.${encodeURIComponent(user.id)}&status=eq.under_review&select=id,status,payment_amount,payment_currency,created_at&order=created_at.desc&limit=1`).catch(()=>[]),
  supabaseFetch('/rest/v1/currencies?is_active=eq.true&select=code,name,symbol,decimal_places,is_active&order=code').catch(()=>[]),
  supabaseFetch('/rest/v1/exchange_rates?status=eq.active&select=id,base_currency,quote_currency,rate,status').catch(()=>[]),
  supabaseFetch('/rest/v1/payment_methods?is_active=eq.true&select=id,name,account_name,account_identifier,instructions,currency_agnostic&order=sort_order.asc,name.asc').catch(()=>[]),
  supabaseFetch('/rest/v1/payment_method_currencies?select=payment_method_id,currency_code').catch(()=>[]),
  supabaseFetch('/rest/v1/rpc/orby_usage_status',{method:'POST',body:'{}'}).catch(()=>null),
 ]);
 const plan=(planRows as Plan[])?.[0]||null,subscription=(subRows as PlusSub[])?.[0]||null,pending=(pendingRows as Pending[])?.[0]||null,currencies=currencyRows as CurrencyDefinition[],rates=rateRows as ExchangeRateDefinition[],methods=methodRows as Method[],restrictions=restrictionRows as Restriction[],usage=(Array.isArray(usageRaw)?usageRaw[0]:usageRaw) as{tier?:string}|null,active=subscription?.status==='active'&&new Date(subscription.ends_at).getTime()>Date.now();
 return <main className="min-h-screen bg-[#070a12] px-4 py-10 text-slate-100"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="md-eyebrow">ORBY Subscription</span><h1 className="mt-3 text-4xl font-black">ORBY <span className="text-violet-300">Plus</span></h1><p className="mt-3 max-w-2xl leading-7 text-slate-400">استخدام غير محدود من منظور المنتج، مع حماية Fair-use خلفية تمنع الإساءة والطلبات الآلية المفرطة دون تحويل Plus إلى عداد يومي مزعج.</p></div><Link href="/orby" className="md-button md-button-secondary">العودة إلى ORBY</Link></div>
  <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.15fr]"><section className="rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/10 to-emerald-300/[.04] p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">ما الذي تحصل عليه؟</h2>{usage?.tier==='plus'?<span className="rounded-full bg-violet-300/15 px-3 py-1 text-xs font-black text-violet-100">Plus فعال</span>:null}</div><ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-300"><li>• ORBY واحد لحسابك ومحادثاتك وخدماتك.</li><li>• لا يظهر عداد رسائل يومي عادي.</li><li>• Business Context يبقى معزولًا حسب الخدمة والمساحة الحالية.</li><li>• حماية خلفية من Flooding والتوازي غير المعقول واستهلاك الاعتمادات الآلي.</li><li>• انتهاء Plus لا يحذف محادثاتك أو حسابك؛ يرجعك تلقائيًا إلى 20 أو 5 رسائل حسب خدماتك النشطة.</li></ul>{plan?<div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4"><span className="text-xs text-slate-500">السعر المعتمد من الإدارة</span><strong className="mt-1 block text-2xl">{formatStoreMoney(plan.price,plan.currency,currencies)}</strong><span className="mt-1 block text-xs text-slate-500">كل {plan.billing_months} شهر</span></div>:null}</section>
  <section className="rounded-2xl border border-white/10 bg-[#0d111a] p-6">{active?<div className="grid min-h-72 place-items-center text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-300/15 text-2xl">✦</div><h2 className="mt-4 text-2xl font-black">ORBY Plus فعال</h2><p className="mt-2 text-sm text-slate-400">يستمر حتى {new Date(subscription.ends_at).toLocaleString('ar-YE')}.</p><Link href="/orby" className="md-button md-button-primary mt-5">ابدأ محادثة</Link></div></div>:pending?<div className="grid min-h-72 place-items-center text-center"><div><h2 className="text-2xl font-black">طلبك قيد المراجعة</h2><p className="mt-2 text-sm leading-7 text-slate-400">استلمنا الطلب بقيمة {formatStoreMoney(pending.payment_amount,pending.payment_currency,currencies)}. ستتغير خطتك فور اعتماد الإدارة للدفع.</p><Link href="/orby" className="md-button md-button-secondary mt-5">استخدام ORBY الحالي</Link></div></div>:!plan||!plan.is_active||!plan.is_available||Number(plan.price)<=0?<div className="grid min-h-72 place-items-center text-center"><div><h2 className="text-2xl font-black">ORBY Plus غير متاح للشراء حاليًا</h2><p className="mt-2 text-sm leading-7 text-slate-400">السعر أو حالة الخطة لم تُضبط من لوحة إدارة مَدار بعد. لم يتم وضع سعر افتراضي أو تخميني.</p><Link href="/orby" className="md-button md-button-secondary mt-5">العودة إلى ORBY</Link></div></div>:<><h2 className="text-xl font-black">ترقية الحساب</h2><p className="mt-1 text-sm text-slate-500">رقم الحوالة إلزامي، وإرفاق الإيصال اختياري.</p><div className="mt-5"><OrbyPlusCheckout price={Number(plan.price)} currency={plan.currency} currencies={currencies} rates={rates} methods={methods} restrictions={restrictions}/></div></>}</section></div>
 </div></main>;
}
