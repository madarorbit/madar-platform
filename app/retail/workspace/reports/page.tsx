import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { SalesTrend } from "@/components/retail-v0/retail/sales-trend";
import { formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { dateDaysAgo, getAnalyticsSnapshot, localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";

export const metadata: Metadata = { title: "التقارير" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ workspace }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const to = params.to && ISO_DATE.test(params.to) ? params.to : localDate(workspace.timezone);
  const from = params.from && ISO_DATE.test(params.from) ? params.from : dateDaysAgo(13, workspace.timezone);
  const snapshot = await getAnalyticsSnapshot(workspace.id, from, to);
  const m = snapshot.metrics;
  return <div className="content-grid">
    <PageHeader eyebrow="ANALYTICS ENGINE" title="التقارير" description="كل رقم محسوب في PostgreSQL من السجلات التشغيلية؛ ORBY يقرأ هذه النتائج ولا يحسبها بنفسه." />
    <form className="surface flex flex-wrap items-end gap-3 p-4" method="get"><label className="field"><span>من</span><input className="input" type="date" name="from" defaultValue={from} required /></label><label className="field"><span>إلى</span><input className="input" type="date" name="to" defaultValue={to} required /></label><button className="button-primary" type="submit">تحديث التقرير</button></form>
    <section className="metric-grid">
      {[
        ["الإيراد", m.revenue, "صافي المبيعات بعد المرتجعات"], ["الربح الإجمالي التقديري", m.estimated_gross_profit, "بعد تكلفة البضاعة"],
        ["المصروفات", m.expenses, "مصروفات التشغيل"], ["النتيجة التشغيلية التقديرية", m.estimated_net_operating_result, "الربح التقديري ناقص المصروفات"],
        ["داخل الصندوق", m.cash_in, "حركات نقدية فقط"], ["خارج الصندوق", m.cash_out, "حركات نقدية فقط"],
        ["ديون العملاء", m.receivables, "رصيد حالي"], ["مستحقات الموردين", m.payables, "رصيد حالي"],
      ].map(([label, value, hint]) => <article className="surface metric-card" key={String(label)}><p className="muted text-xs font-bold">{label}</p><p className="value">{formatMoney(Number(value), workspace.currency)}</p><p className="muted mt-2 text-xs">{hint}</p></article>)}
    </section>
    <section className="surface p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-black">اتجاه صافي المبيعات</h2><p className="muted mt-1 text-xs">نقطة لكل يوم ضمن الفترة، دون أخذ عينات.</p></div><div className="text-left"><span className="muted text-xs">مقارنة بالفترة السابقة</span><p className={snapshot.comparison.revenue_change >= 0 ? "text-emerald-200" : "text-red-200"}>{formatMoney(snapshot.comparison.revenue_change, workspace.currency)} {snapshot.comparison.revenue_change_percent == null ? "" : `(${snapshot.comparison.revenue_change_percent}%)`}</p></div></div><div className="mt-5"><SalesTrend data={snapshot.daily_sales} currency={workspace.currency} /></div></section>
    <section className="grid gap-4 xl:grid-cols-2"><article className="surface p-5"><h2 className="text-lg font-black">الأكثر مبيعًا</h2><div className="mt-3 grid gap-2">{snapshot.top_products.map((item, index) => <div className="flex items-center justify-between border-b border-slate-800 py-3 last:border-0" key={item.id}><div><span className="text-violet ml-3 font-black">{index + 1}</span><strong>{item.name}</strong><p className="muted mr-7 text-xs">{formatQuantity(item.quantity_sold)} وحدة</p></div><strong>{formatMoney(item.revenue, workspace.currency)}</strong></div>)}{!snapshot.top_products.length ? <p className="muted py-8 text-center">لا توجد بيانات كافية.</p> : null}</div></article><article className="surface p-5"><h2 className="text-lg font-black">بطيء الحركة</h2><p className="muted mt-1 text-xs">منتجات لديها رصيد مع أقل نشاط بيع خلال 30 يومًا.</p><div className="mt-3 grid gap-2">{snapshot.slow_moving.map((item) => <div className="flex items-center justify-between border-b border-slate-800 py-3 last:border-0" key={item.id}><div><strong>{item.name}</strong><p className="muted text-xs">آخر بيع: {item.last_sold_at ? new Date(item.last_sold_at).toLocaleDateString("ar-YE") : "لا يوجد"}</p></div><span className="status-pill status-warning">{formatQuantity(item.stock_on_hand)} في المخزون</span></div>)}</div></article></section>
    <section className="surface grid gap-2 p-5 text-sm"><h2 className="text-lg font-black">تعريفات لا تختلط</h2>{Object.entries(snapshot.definitions).map(([key, value]) => <p key={key}><code className="text-mint ml-2">{key}</code><span className="muted">{value}</span></p>)}</section>
  </div>;
}
