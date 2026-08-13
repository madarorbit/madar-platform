import type { Metadata } from "next";
import Link from "next/link";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { formatDateTime, formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { getAnalyticsSnapshot, localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { getProducts } from "@/src/lib/retail/server/retail/queries";
import { Icon, type IconName } from "@/components/ui/Icons";
import { Badge, ButtonLink, Card, EmptyState, Notice, Panel, StatusBadge } from "@/components/ui/Enterprise";
import { WorkspaceModule, WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";

export const metadata: Metadata = { title: "MADAR Retail | لوحة التجارة" };

const metricIcons: IconName[] = ["store", "chart", "store", "note"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, user, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const today = localDate(workspace.timezone);
  const [snapshot, products] = await Promise.all([
    getAnalyticsSnapshot(workspace.id, today, today),
    getProducts(workspace.id),
  ]);
  const m = snapshot.metrics;
  const primaryMetrics = [
    ["مبيعات اليوم", formatMoney(m.revenue, workspace.currency), "صافي المبيعات بعد المرتجعات"],
    ["الربح التقديري", formatMoney(m.estimated_gross_profit, workspace.currency), "بعد تكلفة البضاعة التقديرية"],
    ["الصندوق", formatMoney(m.cash_position, workspace.currency), "الرصيد النقدي الحالي"],
    ["المصروفات", formatMoney(m.expenses, workspace.currency), "مصروفات اليوم"],
  ] as const;
  const canWrite = role !== "VIEWER";
  const firstUse = products.length === 0 && m.orders === 0;

  return (
    <WorkspaceModule className="mx-auto max-w-7xl">
      <FlashMessage success={params.success} error={params.error} />
      <WorkspaceModuleHeader
        eyebrow="تشغيل التجارة اليومي"
        title={workspace.name}
        description="ابدأ بالبيع وما يحتاج انتباهك، ثم افتح تفاصيل المخزون والصندوق والديون عند الحاجة."
        icon="store"
        actions={<><ButtonLink href={`/orby?conversation=new&organization=${encodeURIComponent(user.platformOrganizationId)}&service=MADAR_RETAIL`} variant="secondary"><Icon name="sparkles" />اسأل ORBY</ButtonLink>{canWrite ? <ButtonLink href="/retail/workspace/sales"><Icon name="store" />بيع جديد</ButtonLink> : null}</>}
      />

      {firstUse ? <Notice title="ابدأ تجهيز تجارتك" variant="info">أضف أول منتج، ثم ستكون عملية البيع متاحة من الإجراء الرئيسي دون خطوات زائدة.</Notice> : null}

      <section className="md-service-primary-grid" aria-label="أهم مؤشرات اليوم">
        {primaryMetrics.map(([label, value, hint], index) => (
          <Card as="article" key={label} className="md-retail-metric">
            <div className="flex items-start justify-between gap-3">
              <span className="md-type-label md-muted">{label}</span>
              <span className="md-feature-icon is-purple is-small"><Icon name={metricIcons[index]} className="h-4 w-4" /></span>
            </div>
            <div><strong className="md-type-stat block">{value}</strong><p className="md-type-caption md-muted mt-1">{hint}</p></div>
          </Card>
        ))}
      </section>

      <section className="md-service-summary-strip" aria-label="ملخص مالي وتشغيلي">
        <div><span>ديون العملاء</span><strong>{formatMoney(m.receivables, workspace.currency)}</strong></div>
        <div><span>مستحقات الموردين</span><strong>{formatMoney(m.payables, workspace.currency)}</strong></div>
        <div><span>قيمة المخزون</span><strong>{formatMoney(m.inventory_value, workspace.currency)}</strong></div>
        <div><span>متوسط الفاتورة</span><strong>{formatMoney(m.average_order_value, workspace.currency)} · {m.orders.toLocaleString("ar-YE")} فاتورة</strong></div>
      </section>

      {canWrite ? <section className="md-service-quick-actions" aria-labelledby="retail-quick-actions"><div><span className="md-eyebrow">إجراءات سريعة</span><h2 id="retail-quick-actions">شغّل تجارتك الآن</h2></div><div>
        <Link href="/retail/workspace/sales"><span><Icon name="store" /></span><strong>بيع جديد</strong><Icon name="arrow" className="md-icon-directional" /></Link>
        <Link href="/retail/workspace/products"><span><Icon name="layers" /></span><strong>إضافة منتج</strong><Icon name="arrow" className="md-icon-directional" /></Link>
        <Link href="/retail/workspace/expenses"><span><Icon name="note" /></span><strong>تسجيل مصروف</strong><Icon name="arrow" className="md-icon-directional" /></Link>
        <Link href="/retail/workspace/inventory"><span><Icon name="chart" /></span><strong>تسوية المخزون</strong><Icon name="arrow" className="md-icon-directional" /></Link>
      </div></section> : null}

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
    </WorkspaceModule>
  );
}
