import type { Metadata } from "next";
import Link from "next/link";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { formatDateTime, formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { getAnalyticsSnapshot, localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";

export const metadata: Metadata = { title: "لوحة التجارة" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, user }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const today = localDate(workspace.timezone);
  const snapshot = await getAnalyticsSnapshot(workspace.id, today, today);
  const m = snapshot.metrics;
  const metrics = [
    ["مبيعات اليوم", formatMoney(m.revenue, workspace.currency), "صافي المبيعات بعد المرتجعات"],
    ["الربح التقديري", formatMoney(m.estimated_gross_profit, workspace.currency), "بعد تكلفة البضاعة التقديرية"],
    ["المصروفات", formatMoney(m.expenses, workspace.currency), "خلال اليوم"],
    ["الصندوق", formatMoney(m.cash_position, workspace.currency), "الرصيد النقدي الحالي"],
    ["ديون العملاء", formatMoney(m.receivables, workspace.currency), "ليست نقدًا محصلًا"],
    ["مستحقات الموردين", formatMoney(m.payables, workspace.currency), "المبلغ المتبقي"],
    ["قيمة المخزون", formatMoney(m.inventory_value, workspace.currency), "بمتوسط التكلفة"],
    ["متوسط الفاتورة", formatMoney(m.average_order_value, workspace.currency), `${m.orders} فاتورة`],
  ];
  return (
    <div className="content-grid">
      <FlashMessage success={params.success} error={params.error} />
      <PageHeader eyebrow="نظرة اليوم" title={`مرحبًا في ${workspace.name}`} description="الإيراد والربح والصندوق مفاهيم منفصلة؛ تعرض كل بطاقة تعريفها بوضوح." action={<div className="flex flex-wrap gap-2"><Link className="button-secondary" href={`/orby?conversation=new&organization=${encodeURIComponent(user.platformOrganizationId)}`}>فتح ORBY</Link><Link className="button-primary" href="/retail/workspace/sales">بيع جديد</Link></div>} />
      <section className="metric-grid">
        {metrics.map(([label, value, hint]) => <article className="surface metric-card" key={label}><p className="muted text-xs font-bold">{label}</p><p className="value">{value}</p><p className="muted mt-2 text-xs">{hint}</p></article>)}
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="surface p-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black">منخفض المخزون</h2><Link className="text-mint text-sm" href="/retail/workspace/inventory">كل المخزون</Link></div>
          <div className="mt-4 grid gap-2">
            {snapshot.low_stock.length ? snapshot.low_stock.slice(0, 6).map((item) => <div className="surface-soft flex items-center justify-between gap-3 p-3" key={item.id}><div><p className="font-bold">{item.name}</p><p className="muted text-xs">{item.sku ?? "دون SKU"}</p></div><span className={item.stock_on_hand === 0 ? "status-pill status-danger" : "status-pill status-warning"}>{formatQuantity(item.stock_on_hand)} / {formatQuantity(item.minimum_stock)}</span></div>) : <p className="muted py-8 text-center text-sm">لا توجد منتجات عند حد التنبيه.</p>}
          </div>
        </article>
        <article className="surface p-5">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black">أفضل المنتجات اليوم</h2><Link className="text-mint text-sm" href="/retail/workspace/reports">التقرير</Link></div>
          <div className="mt-4 grid gap-2">
            {snapshot.top_products.length ? snapshot.top_products.slice(0, 6).map((item, index) => <div className="flex items-center gap-3 border-b border-slate-800 py-3 last:border-0" key={item.id}><span className="text-violet font-black">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{item.name}</p><p className="muted text-xs">{formatQuantity(item.quantity_sold)} مباعة</p></div><strong>{formatMoney(item.revenue, workspace.currency)}</strong></div>) : <p className="muted py-8 text-center text-sm">لا توجد مبيعات لهذا اليوم بعد.</p>}
          </div>
        </article>
      </section>
      <section className="surface p-5">
        <h2 className="text-lg font-black">آخر العمليات</h2>
        <div className="mt-3 grid gap-1">
          {snapshot.recent_activity.map((item) => <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 py-3 last:border-0" key={`${item.kind}-${item.id}`}><div><span className="status-pill">{item.kind}</span><strong className="mr-2">{item.label}</strong></div><div className="text-left"><strong>{formatMoney(item.amount, workspace.currency)}</strong><p className="muted text-xs">{formatDateTime(item.occurred_at)}</p></div></div>)}
          {!snapshot.recent_activity.length ? <p className="muted py-8 text-center text-sm">ابدأ بإضافة منتج ثم نفّذ أول عملية.</p> : null}
        </div>
      </section>
    </div>
  );
}
