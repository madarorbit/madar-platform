import Link from 'next/link';
import ActionFeedback from '@/components/business/ActionFeedback';
import {completeBusinessSetup} from '@/app/actions/imports';
import {requireBusinessWorkspace} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';export const metadata={title:'إعداد التجارة | مَدار'};
export default async function SetupPage({searchParams}:{searchParams:Promise<{success?:string;error?:string}>}){
 const{workspace}=await requireBusinessWorkspace(),params=await searchParams,id=encodeURIComponent(workspace.id);
 const details=(await supabaseFetch(`/rest/v1/organizations?id=eq.${id}&select=id,name,industry,currency,onboarding_completed_at`))?.[0];
 const[products,customers,sales,imports]=await Promise.all([
  supabaseFetch(`/rest/v1/business_products?organization_id=eq.${id}&select=id&limit=1`),
  supabaseFetch(`/rest/v1/business_customers?organization_id=eq.${id}&select=id&limit=1`),
  supabaseFetch(`/rest/v1/business_sales?organization_id=eq.${id}&select=id&limit=1`),
  supabaseFetch(`/rest/v1/business_imports?organization_id=eq.${id}&status=eq.imported&select=id&limit=1`),
 ]);
 const steps=[
  ['بيانات النشاط',Boolean(details?.industry),'/workspace/setup'],
  ['أول منتج',Boolean(products?.length),'/workspace/products'],
  ['أول عميل',Boolean(customers?.length),'/workspace/customers'],
  ['أول عملية بيع',Boolean(sales?.length),'/workspace/sales'],
  ['استيراد بيانات قائمة',Boolean(imports?.length),'/workspace/imports'],
 ] as const;
 const completed=steps.filter(step=>step[1]).length;
 return <main className="mx-auto max-w-5xl p-5 py-10"><p className="font-bold text-[#70E4D4]">بدء التشغيل</p><h2 className="mt-2 text-4xl font-black">جهّز تجارتك للعمل</h2><p className="mt-3 max-w-2xl leading-8 text-slate-300">أكمل المعلومات الأساسية، ثم اختر بين إدخال البيانات يدويًا أو استيراد تجارتك الحالية.</p><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]"><section className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><ActionFeedback {...params}/><h3 className="text-2xl font-black">بيانات النشاط</h3><form action={completeBusinessSetup} className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-bold">اسم التجارة<input disabled value={details?.name||workspace.name} className="field rounded-xl p-3 opacity-70"/></label><label className="grid gap-2 text-sm font-bold">قطاع النشاط<input name="industry" required maxLength={120} defaultValue={details?.industry||''} className="field rounded-xl p-3" placeholder="مثال: إلكترونيات، ملابس، خدمات رقمية"/></label><label className="grid gap-2 text-sm font-bold">العملة الأساسية<select name="currency" defaultValue={details?.currency||workspace.currency} className="field rounded-xl p-3"><option value="YER">الريال اليمني YER</option><option value="SAR">الريال السعودي SAR</option><option value="USD">الدولار USD</option></select></label><p className="text-xs leading-6 text-slate-400">تُحفظ العملة على مستوى التجارة، بينما تحتفظ كل معاملة بعملتها المسجلة. لا يتم تحويل العملات تلقائيًا.</p><button className="rounded-xl bg-gradient-to-l from-violet-500 to-emerald-400 p-3 font-black">حفظ وإكمال الإعداد</button></form></section><aside className="rounded-3xl border border-white/10 p-6"><div className="flex items-center justify-between"><h3 className="text-xl font-black">قائمة البداية</h3><strong className="text-[#70E4D4]">{completed}/{steps.length}</strong></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-l from-violet-500 to-emerald-400" style={{width:`${completed/steps.length*100}%`}}/></div><div className="mt-5 space-y-3">{steps.map(([label,done,href])=><Link key={label} href={href} className="flex items-center justify-between rounded-xl bg-white/[.04] p-3"><span>{label}</span><strong className={done?'text-emerald-200':'text-slate-500'}>{done?'✓':'○'}</strong></Link>)}</div><Link href="/workspace/imports" className="mt-6 flex justify-center rounded-xl border border-violet-300/30 px-4 py-3 font-bold text-violet-100">ربط تجارة قائمة عبر CSV</Link></aside></div></main>;
}
