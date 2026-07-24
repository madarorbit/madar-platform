import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import ActionFeedback from '@/components/business/ActionFeedback';
import {requireUser} from '@/src/lib/auth';
import {businessMoney} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';
import PaymentForm from './form';

export const dynamic='force-dynamic';
const labels:Record<string,string>={pending_payment:'بانتظار الدفع',pending_review:'قيد مراجعة الإدارة',approved:'مقبول',rejected:'مرفوض'};

type PaymentMethod={id:string;name:string;account_name:string;account_identifier:string;instructions:string|null};

export default async function WorkspacePaymentPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string;error?:string}>}){
 await requireUser();
 const{id}=await params,query=await searchParams;
 const request=(await supabaseFetch(`/rest/v1/workspace_requests?id=eq.${encodeURIComponent(id)}&select=id,name,type,status,payment_reference,rejection_reason,organization_id,beta_slot_ordinal,subscription_plans(id,name,description,price,currency,billing_months)`))?.[0];
 if(!request)notFound();
 if(request.status==='approved')redirect('/dashboard');
 const plan=Array.isArray(request.subscription_plans)?request.subscription_plans[0]:request.subscription_plans;
 const methods:PaymentMethod[]=plan&&request.status==='pending_payment'?await supabaseFetch(`/rest/v1/payment_methods?is_active=eq.true&currency=eq.${encodeURIComponent(plan.currency)}&select=id,name,account_name,account_identifier,instructions&order=sort_order.asc`):[];
 return <main className="mx-auto max-w-3xl p-6 py-12">
  <p className="font-bold text-[#70E4D4]">تفعيل مساحة العمل</p><h1 className="mt-2 text-3xl font-black">{request.name}</h1>
  <div className="mt-6"><ActionFeedback success={query.success} error={query.error}/></div>
  <div className="mt-6 rounded-3xl border border-white/10 bg-white/[.04] p-6">
   <p>الحالة: <strong className="text-[#70E4D4]">{labels[request.status]||request.status}</strong></p>
   {request.beta_slot_ordinal&&<p className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4 text-violet-100">تم حجز مقعد مؤسس Beta رقم {request.beta_slot_ordinal}. لا يتطلب هذا المقعد دفعًا، وتُفتح المساحة بعد الاعتماد الإداري.</p>}
   {plan&&<div className="mt-5 rounded-2xl border border-[#70E4D4]/20 bg-[#70E4D4]/10 p-5"><p className="text-sm text-slate-300">الخطة</p><p className="mt-1 text-xl font-black">{plan.name} — {businessMoney(plan.price,plan.currency)}</p>{plan.description&&<p className="mt-2 text-sm leading-7 text-slate-300">{plan.description}</p>}</div>}
   {request.status==='pending_payment'&&(methods.length?<PaymentForm requestId={request.id} methods={methods}/>:<div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-50"><h2 className="font-black">لا توجد طريقة دفع جاهزة لهذه العملة</h2><p className="mt-2 text-sm leading-7">لن تُعرض أي محفظة قبل إدخال الإدارة بيانات الحساب الحقيقية وتفعيلها. تواصل مع الدعم أو أعد المحاولة لاحقًا.</p></div>)}
   {request.status==='pending_review'&&<div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 leading-8 text-amber-100">وصل إثبات الدفع ومرجع العملية <strong>{request.payment_reference||'—'}</strong>. ستظهر المساحة في حسابك تلقائيًا فور اعتماد الإدارة.</div>}
   {request.status==='rejected'&&<div className="mt-5 rounded-2xl bg-red-500/10 p-5 text-red-100"><p className="font-bold">تعذر اعتماد الطلب.</p><p className="mt-2">{request.rejection_reason||'تواصل مع الدعم لمعرفة التفاصيل.'}</p></div>}
   <Link href="/dashboard" className="mt-6 inline-block text-sm font-bold text-[#70E4D4]">العودة إلى حسابي ←</Link>
  </div>
 </main>;
}
