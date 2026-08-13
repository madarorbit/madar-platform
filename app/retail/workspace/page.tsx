import type { Metadata } from "next";
import Link from "next/link";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { formatDateTime, formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { getAnalyticsSnapshot, localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { Icon, type IconName } from "@/components/ui/Icons";
import { Badge, Card, EmptyState, Panel, StatusBadge } from "@/components/ui/Enterprise";

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
      <header className="md-retail-dashboard-header">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="active">MADAR Retail</StatusBadge>
            <Badge>{workspace.currency}</Badge>
          </div>
          <h1 className="md-type-h1 mt-4">{workspace.name}</h1>
          <p className="md-type-body-sm md-muted mt-2 max-w-2xl">لوحة تشغيل يومية مختصرة للمبيعات والمخزون والصندوق والديون. افتح التفاصيل عند الحاجة بدل ازدحام الشاشة بكل شيء.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/orby?conversation=new&organization=${encodeURIComponent(user.platformOrganizationId)}`} className="md-button md-button-secondary"><Icon name="sparkles" />اسأل ORBY</Link>
          <Link href="/retail/workspace/sales" className="md-button md-button-primary"><Icon name="store" />بيع جديد</Link>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, hint], index) => (
          <Card as="article" key={label} className="md-retail-metric">
            <div className="flex items-start justify-between gap-3">
              <span className="md-type-label md-muted">{label}</span>
              <span className="md-feature-icon is-purple is-small"><Icon name={metricIcons[index]} className="h-4 w-4" /></span>
            </div>
            <div><strong className="md-type-stat block">{value}</strong><p className="md-type-caption md-muted mt-1">{hint}</p></div>
          </Card>
        ))}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-2">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">المخزون</span><h2 className="mt-2 text-xl font-black">يحتاج انتباهك</h2></div><Link href="/retail/workspace/inventory" className="md-button md-button-ghost md-button-sm">فتح المخزون</Link></div>
          <div className="mt-4 grid gap-2">
            {snapshot.low_stock.length ? snapshot.low_stock.slice(0, 6).map((item) => (
              <div className="md-retail-list-row" key={item.id}>
                <div className="min-w-0"><p className="truncate font-bold">{item.name}</p><p className="md-type-caption md-muted mt-1">{item.sku ?? "دون SKU"}</p></div>
                <StatusBadge status={item.stock_on_hand === 0 ? "error" : "pending"}>{formatQuantity(item.stock_on_hand)} / {formatQuantity(item.minimum_stock)}</StatusBadge>
              </div>
            )) : <EmptyState compact title="المخزون مستقر" description="المخزون ضمن الحدود المسجلة حاليًا." icon="check" />}
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">الأداء</span><h2 className="mt-2 text-xl font-black">أفضل المنتجات اليوم</h2></div><Link href="/retail/workspace/reports" className="md-button md-button-ghost md-button-sm">التقرير الكامل</Link></div>
          <div className="mt-4 grid gap-2">
            {snapshot.top_products.length ? snapshot.top_products.slice(0, 6).map((item, index) => (
              <div className="md-retail-list-row" key={item.id}>
                <span className="md-retail-rank">{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate font-bold">{item.name}</p><p className="md-type-caption md-muted mt-1">{formatQuantity(item.quantity_sold)} مباعة</p></div>
                <strong className="text-sm">{formatMoney(item.revenue, workspace.currency)}</strong>
              </div>
            )) : <EmptyState compact title="لا يوجد ترتيب بعد" description="لا توجد مبيعات كافية لعرض ترتيب اليوم." icon="chart" />}
          </div>
        </Panel>
      </section>

      <Panel className="mt-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">النشاط</span><h2 className="md-type-h3 mt-2">آخر العمليات</h2></div><Link href="/retail/workspace/reports" className="md-button md-button-link">عرض التقارير</Link></div>
        <div className="md-retail-activity-list">
          {snapshot.recent_activity.map((item) => (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={`${item.kind}-${item.id}`}>
              <div className="min-w-0"><Badge>{item.kind}</Badge><strong className="ms-2 text-sm">{item.label}</strong></div>
              <div className="text-left"><strong className="text-sm">{formatMoney(item.amount, workspace.currency)}</strong><p className="md-type-caption md-muted mt-1">{formatDateTime(item.occurred_at)}</p></div>
            </div>
          ))}
          {!snapshot.recent_activity.length ? <EmptyState compact title="لا توجد عمليات بعد" description="ابدأ بإضافة منتج ثم نفّذ أول عملية لتظهر هنا." icon="note" /> : null}
        </div>
      </Panel>
    </main>
  );
}
