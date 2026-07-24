import Link from 'next/link';
import {AnalyticsBars} from '@/components/business/AnalyticsBars';
import {analyticsMoney,changeLabel,loadBusinessAnalytics,resolveAnalyticsRange,shiftIsoDate} from '@/src/lib/analytics';
import {requireBusinessWorkspace} from '@/src/lib/business';

export const dynamic='force-dynamic';
export const metadata={title:'ذكاء الأعمال | مَدار'};
const customerLabels:{[key:string]:string}={new:'جدد',active:'نشطون',vip:'مميزون',inactive:'متوقفون'};

export default async function AnalyticsPage({searchParams}:{searchParams:Promise<{start?:string;end?:string}>}){
 const{workspace}=await requireBusinessWorkspace(),params=await searchParams;
 let range;
 try{range=resolveAnalyticsRange(params.start,params.end)}catch(error){return <ErrorState message={error instanceof Error?error.message:'الفترة غير صالحة.'}/>}
 let data;
 try{data=await loadBusinessAnalytics(workspace.id,range.start,range.end)}catch{return <ErrorState message="لا تملك صلاحية مشاهدة البيانات المالية أو تعذر تجهيز التقرير."/>}
 const{kpis,comparison}=data,money=(value:number)=>analyticsMoney(value,data.currency),thirtyStart=shiftIsoDate(range.end,-29),segmentMax=Math.max(1,...data.customer_segments.map(segment=>Number(segment.count)));
 const cards=[
  ['إجمالي المبيعات',money(kpis.revenue),changeLabel(comparison.revenue_change)],
  ['صافي الربح التقديري',money(kpis.net_profit_estimate),null],
  ['إجمالي الربح',money(kpis.gross_profit),null],
  ['المصروفات',money(kpis.expenses),changeLabel(comparison.expenses_change)],
  ['عدد الطلبات',kpis.orders.toLocaleString('ar-YE'),changeLabel(comparison.orders_change)],
  ['متوسط الطلب',money(kpis.average_order_value),null],
  ['تكلفة البضاعة',money(kpis.cost_of_goods),null],
  ['قيمة المخزون',money(kpis.inventory_value),null],
 ];
 const alerts=[
  kpis.out_of_stock>0?`${kpis.out_of_stock} منتج نافد من المخزون`:null,
  kpis.low_stock>0?`${kpis.low_stock} منتج عند حد التنبيه`:null,
  kpis.overdue_tasks>0?`${kpis.overdue_tasks} مهمة متأخرة`:null,
  comparison.revenue_change<0?`المبيعات أقل من الفترة السابقة بنسبة ${Math.abs(comparison.revenue_change)}%`:null,
 ].filter(Boolean) as string[];
 return <main className="mx-auto max-w-7xl p-5 py-10">
  <div className="flex flex-wrap items-end justify-between gap-5">
   <div><p className="font-bold text-[#70E4D4]">ذكاء الأعمال</p><h2 className="mt-2 text-4xl font-black">لوحة أداء التجارة</h2><p className="mt-3 text-slate-300">من {data.period.start} إلى {data.period.end} · مقارنة تلقائية بالفترة السابقة المماثلة.</p></div>
   <div className="flex flex-wrap gap-2"><Link href={`/workspace/analytics/export?start=${range.start}&end=${range.end}`} className="rounded-xl border border-white/15 px-4 py-3 font-bold">تصدير CSV</Link><Link href={`/workspace/analytics/print?start=${range.start}&end=${range.end}`} className="rounded-xl bg-white px-4 py-3 font-bold text-slate-950">تقرير للطباعة / PDF</Link></div>
  </div>
  <form className="mt-7 flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
   <label className="grid gap-2 text-sm font-bold">من<input type="date" name="start" defaultValue={range.start} className="field rounded-xl p-3"/></label>
   <label className="grid gap-2 text-sm font-bold">إلى<input type="date" name="end" defaultValue={range.end} className="field rounded-xl p-3"/></label>
   <button className="rounded-xl bg-gradient-to-l from-violet-500 to-emerald-400 px-5 py-3 font-black">تحديث التقرير</button>
   <div className="flex gap-2 text-xs"><Link href="/workspace/analytics" className="rounded-lg border border-white/10 px-3 py-2">هذا الشهر</Link><Link href={`/workspace/analytics?start=${thirtyStart}&end=${range.end}`} className="rounded-lg border border-white/10 px-3 py-2">30 يومًا</Link></div>
  </form>
  <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label,value,change])=><article key={String(label)} className="rounded-3xl border border-white/10 bg-white/[.04] p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-black">{value}</p>{change&&<p className={`mt-2 text-xs font-bold ${String(change).startsWith('-')?'text-red-200':'text-emerald-200'}`}>{change} عن الفترة السابقة</p>}</article>)}</section>
  {alerts.length>0&&<section className="mt-7 rounded-3xl border border-amber-300/20 bg-amber-300/[.06] p-6"><h3 className="text-xl font-black text-amber-100">تحتاج انتباهك</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{alerts.map(alert=><p key={alert} className="rounded-xl bg-black/20 p-3 text-amber-50">{alert}</p>)}</div></section>}
  <section className="mt-7 rounded-3xl border border-white/10 bg-white/[.03] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-2xl font-black">الحركة اليومية</h3><p className="mt-1 text-sm text-slate-400">مقارنة المبيعات بالمصروفات لكل يوم.</p></div><p className="text-sm text-slate-400">الخصومات: <strong className="text-white">{money(kpis.discounts)}</strong></p></div><div className="mt-5"><AnalyticsBars sales={data.daily_sales} expenses={data.daily_expenses}/></div></section>
  <section className="mt-7 grid gap-7 lg:grid-cols-[1.35fr_.65fr]">
   <article className="rounded-3xl border border-white/10 p-6"><h3 className="text-2xl font-black">المنتجات الأعلى أداءً</h3><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-right"><thead className="text-sm text-slate-400"><tr><th className="p-3">المنتج</th><th className="p-3">الكمية</th><th className="p-3">الإيراد</th><th className="p-3">الربح الإجمالي</th></tr></thead><tbody>{data.top_products.length?data.top_products.map(product=><tr key={`${product.product_id}-${product.name}`} className="border-t border-white/10"><td className="p-3 font-bold">{product.name}</td><td className="p-3">{Number(product.quantity).toLocaleString('ar-YE')}</td><td className="p-3">{money(product.revenue)}</td><td className="p-3 text-emerald-200">{money(product.profit)}</td></tr>):<tr><td colSpan={4} className="p-8 text-center text-slate-400">لا توجد عناصر بيع تفصيلية في الفترة.</td></tr>}</tbody></table></div></article>
   <article className="rounded-3xl border border-white/10 p-6"><h3 className="text-2xl font-black">العملاء</h3><dl className="mt-5 space-y-3"><div className="flex justify-between"><dt className="text-slate-400">عملاء نشطون في الفترة</dt><dd className="font-black">{kpis.active_customers}</dd></div><div className="flex justify-between"><dt className="text-slate-400">عملاء جدد</dt><dd className="font-black">{kpis.new_customers}</dd></div><div className="flex justify-between"><dt className="text-slate-400">عملاء عائدون</dt><dd className="font-black">{kpis.returning_customers}</dd></div></dl><div className="mt-6 space-y-3">{data.customer_segments.map(segment=><div key={segment.status}><div className="flex justify-between text-sm"><span>{customerLabels[segment.status]||segment.status}</span><strong>{segment.count}</strong></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-300/70" style={{width:`${Number(segment.count)/segmentMax*100}%`}}/></div></div>)}</div></article>
  </section>
  <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['مخزون منخفض',kpis.low_stock],['نافد من المخزون',kpis.out_of_stock],['مهام مفتوحة',kpis.open_tasks],['مهام متأخرة',kpis.overdue_tasks]].map(([label,value])=><article key={String(label)} className="rounded-2xl border border-white/10 p-5"><p className="text-sm text-slate-400">{label}</p><strong className="mt-2 block text-3xl">{value}</strong></article>)}</section>
  <p className="mt-6 text-xs leading-6 text-slate-500">صافي الربح هنا تقديري: المبيعات ناقص تكلفة العناصر المسجلة والمصروفات. المبيعات التاريخية المستوردة دون بنود تفصيلية لا تُنتج تكلفة بضاعة تلقائية.</p>
 </main>;
}
function ErrorState({message}:{message:string}){return <main className="mx-auto max-w-3xl p-6 py-16"><h2 className="text-3xl font-black">تعذر عرض التحليلات</h2><p className="mt-4 rounded-2xl border border-red-300/20 bg-red-300/10 p-5 text-red-100">{message}</p><Link href="/workspace" className="mt-6 inline-block font-bold text-[#70E4D4]">العودة إلى مساحة العمل</Link></main>}
