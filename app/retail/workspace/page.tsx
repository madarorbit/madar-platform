import type { Metadata } from "next";
import Link from "next/link";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { formatDateTime, formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { getAnalyticsSnapshot, localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { Icon, type IconName } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "MADAR Retail | لوحة التجارة" };

const metricIcons: IconName[] = ["store", "chart", "note", "store", "user", "briefcase", "layers", "chart"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, user }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const today = localDate(workspace.timezone);
  const snapshot = await getAnalyticsSnapshot(workspace.id, today, today);
  const m = snapshot.metrics;
  const metrics = [
    ["مبيعات اليوم", formatMoney(m.revenue, workspace.currency), "صافي المبيعات بعد المرتجعات"],
    ["الربح التقديري", formatMoney(m.estimated_gross_profit, workspace.currency), "بعد تكلفة البضاعة التقديرية"],
    ["المصروفات", formatMoney(m.expenses, workspace.currency), "مصروفات اليوم"],
    ["الصندوق", formatMoney(m.cash_position, workspace.currency), "الرصيد النقدي الحالي"],
    ["ديون العملاء", formatMoney(m.receivables, workspace.currency), "مبالغ لم تُحصّل بعد"],
    ["مستحقات الموردين", formatMoney(m.payables, workspace.currency), "المبلغ المتبقي للموردين"],
    ["قيمة المخزون", formatMoney(m.inventory_value, workspace.currency), "وفق متوسط التكلفة"],
    ["متوسط الفاتورة", formatMoney(m.average_order_value, workspace.currency), `${m.orders} فاتورة اليوم`],
  ] as const;

  return (
    <main className="mx-auto max-w-7xl p-4 py-6 sm:p-6">
      <FlashMessage success={params.success} error={params.error} />
      <header className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-gradient-to-l from-violet-400/[.08] via-white/[.025] to-emerald-300/[.07] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">MADAR Retail</span>
            <span className="rounded-full border border-white/10 bg-white/[.035] px-3 py-1 text-xs text-slate-400">{workspace.currency}</span>
          </div>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">{workspace.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">لوحة تشغيل يومية مختصرة للمبيعات والمخزون والصندوق والديون. افتح التفاصيل عند الحاجة بدل ازدحام الشاشة بكل شيء.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/orby?conversation=new&organization=${encodeURIComponent(user.platformOrganizationId)}`} className="md-button md-button-secondary"><Icon name="sparkles" />اسأل ORBY</Link>
          <Link href="/retail/workspace/sales" className="md-button md-button-primary"><Icon name="store" />بيع جديد</Link>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, hint], index) => (
          <article key={label} className="md-card flex min-h-36 flex-col justify-between p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-xs font-bold text-slate-500">{label}</span>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-300/10 text-violet-100"><Icon name={metricIcons[index]} className="h-4 w-4" /></span>
            </div>
            <div><strong className="block text-xl sm:text-2xl">{value}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p></div>
          </article>
        ))}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <article className="md-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">المخزون</span><h2 className="mt-2 text-xl font-black">يحتاج انتباهك</h2></div><Link href="/retail/workspace/inventory" className="md-button md-button-ghost md-button-sm">فتح المخزون</Link></div>
          <div className="mt-4 grid gap-2">
            {snapshot.low_stock.length ? snapshot.low_stock.slice(0, 6).map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-3" key={item.id}>
                <div className="min-w-0"><p className="truncate font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.sku ?? "دون SKU"}</p></div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.stock_on_hand === 0 ? "bg-rose-300/10 text-rose-200" : "bg-amber-300/10 text-amber-200"}`}>{formatQuantity(item.stock_on_hand)} / {formatQuantity(item.minimum_stock)}</span>
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">المخزون ضمن الحدود المسجلة حاليًا.</p>}
          </div>
        </article>

        <article className="md-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">الأداء</span><h2 className="mt-2 text-xl font-black">أفضل المنتجات اليوم</h2></div><Link href="/retail/workspace/reports" className="md-button md-button-ghost md-button-sm">التقرير الكامل</Link></div>
          <div className="mt-4 grid gap-2">
            {snapshot.top_products.length ? snapshot.top_products.slice(0, 6).map((item, index) => (
              <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.025] p-3" key={item.id}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-xs font-black text-emerald-100">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-bold">{item.name}</p><p className="mt-1 text-xs text-slate-500">{formatQuantity(item.quantity_sold)} مباعة</p></div>
                <strong className="text-sm">{formatMoney(item.revenue, workspace.currency)}</strong>
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">لا توجد مبيعات كافية لعرض ترتيب اليوم.</p>}
          </div>
        </article>
      </section>

      <section className="md-panel mt-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">النشاط</span><h2 className="mt-2 text-xl font-black">آخر العمليات</h2></div><Link href="/retail/workspace/reports" className="text-xs font-bold text-violet-200">عرض التقارير</Link></div>
        <div className="mt-4 grid divide-y divide-white/8">
          {snapshot.recent_activity.map((item) => (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={`${item.kind}-${item.id}`}>
              <div className="min-w-0"><span className="rounded-full bg-white/[.05] px-2 py-1 text-[10px] text-slate-400">{item.kind}</span><strong className="ms-2 text-sm">{item.label}</strong></div>
              <div className="text-left"><strong className="text-sm">{formatMoney(item.amount, workspace.currency)}</strong><p className="mt-1 text-[10px] text-slate-500">{formatDateTime(item.occurred_at)}</p></div>
            </div>
          ))}
          {!snapshot.recent_activity.length ? <p className="py-10 text-center text-sm text-slate-500">ابدأ بإضافة منتج ثم نفّذ أول عملية لتظهر هنا.</p> : null}
        </div>
      </section>
    </main>
  );
}
