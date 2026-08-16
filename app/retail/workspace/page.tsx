import type { Metadata } from "next";
import Link from "next/link";
import {
  DashboardAlertBlock,
  DashboardCriticalException,
  DashboardDataState,
  DashboardDrillDownLink,
  DashboardEmptyState,
  DashboardErrorState,
  DashboardFilterBar,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardSection,
  DashboardSupportingInfo,
  DashboardVisualizationShell,
  DataTrustIndicator,
  DateRangeControl,
  MetricContext,
  TrendChart,
} from "@/components/dashboard";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { ButtonLink, Card, Panel } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { WorkspaceModule, WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";
import {
  buildRetailOverviewModel,
  resolveRetailOverviewSelection,
  RETAIL_CURRENT_METRICS,
  RETAIL_PRIMARY_METRICS,
  RETAIL_SUPPORTING_METRICS,
} from "@/src/lib/retail/analytics/overview";
import { formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { getAnalyticsSnapshot, localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { getProducts } from "@/src/lib/retail/server/retail/queries";
import type { NormalizedMetricResult } from "@/src/lib/dashboard/metrics";

export const metadata: Metadata = { title: "MADAR Retail | النظرة العامة" };

type DashboardParams = {
  range?: string;
  from?: string;
  to?: string;
  success?: string;
  error?: string;
};

function metricValue(result: NormalizedMetricResult, currency: string) {
  if (result.value === null) return "—";
  if (result.unit.kind === "money") return formatMoney(result.value, result.unit.currency || currency);
  return new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 2 }).format(result.value);
}

function periodLabel(range: ReturnType<typeof resolveRetailOverviewSelection>["range"]) {
  if (range === "today") return "اليوم";
  if (range === "30d") return "آخر 30 يومًا";
  if (range === "custom") return "الفترة المخصصة";
  return "آخر 7 أيام";
}

function comparisonContext(result: NormalizedMetricResult, currency: string) {
  const comparison = result.comparison;
  if (!comparison) return null;
  const delta = comparison.absoluteDelta === null ? "—" : formatMoney(comparison.absoluteDelta, currency);
  const percentage = comparison.percentageDelta === null
    ? comparison.percentageDeltaReason === "zero_reference"
      ? "النسبة غير قابلة للحساب لأن الفترة السابقة كانت صفرًا"
      : "النسبة غير متاحة"
    : `${new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 1 }).format(comparison.percentageDelta)}%`;
  return <MetricContext label="مقارنة بالفترة السابقة" value={<><bdi dir="ltr">{delta}</bdi><span> · {percentage}</span></>} kind="delta" />;
}

function dailyLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("ar-YE", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function itemNames(items: ReadonlyArray<{ name: string }>) {
  return items.slice(0, 4).map((item) => item.name).join("، ");
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<DashboardParams> }) {
  const [{ workspace, user, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const today = localDate(workspace.timezone);
  const selection = resolveRetailOverviewSelection({
    range: params.range,
    from: params.from,
    to: params.to,
    timezone: workspace.timezone,
    today,
  });
  const [snapshotResult, productsResult] = await Promise.allSettled([
    getAnalyticsSnapshot(workspace.id, selection.from, selection.to),
    getProducts(workspace.id),
  ]);
  const canWrite = role !== "VIEWER";
  const presets = [
    { label: "اليوم", href: "/retail/workspace?range=today", active: selection.range === "today" },
    { label: "آخر 7 أيام", href: "/retail/workspace?range=7d", active: selection.range === "7d" },
    { label: "آخر 30 يومًا", href: "/retail/workspace?range=30d", active: selection.range === "30d" },
  ];

  return (
    <WorkspaceModule className="mx-auto max-w-7xl">
      <FlashMessage success={params.success} error={params.error} />
      <WorkspaceModuleHeader
        eyebrow="نظرة Retail"
        title={workspace.name}
        description="راقب أداء تجارتك، افهم ما تغيّر، وانتقل مباشرة إلى ما يحتاج قرارًا أو إجراءً."
        icon="store"
        actions={<>
          <ButtonLink href={`/orby?conversation=new&organization=${encodeURIComponent(user.platformOrganizationId)}&service=MADAR_RETAIL`} variant="secondary"><Icon name="sparkles" />اسأل ORBY</ButtonLink>
          {canWrite ? <ButtonLink href="/retail/workspace/sales"><Icon name="store" />بيع جديد</ButtonLink> : null}
        </>}
      />

      <DashboardFilterBar
        scope="global"
        label="فترة الأداء"
        description="مؤشرات الأداء تتبع الفترة المختارة. الأرصدة الموسومة «حاليًا» تبقى حالة راهنة ولا تتغير دلالتها مع الفترة."
      >
        <DateRangeControl
          presets={presets}
          from={selection.from}
          to={selection.to}
          action="/retail/workspace"
          label="فترة أداء Retail"
        />
      </DashboardFilterBar>

      {snapshotResult.status === "rejected" ? (
        <DashboardErrorState
          compact={false}
          title="تعذر تجهيز نظرة Retail"
          description="تعذر التحقق من بيانات الأداء من مصدر Retail الآن. لم يتم استبدال القيم المفقودة بأصفار."
          action={<ButtonLink href="/retail/workspace" variant="secondary">إعادة المحاولة</ButtonLink>}
        />
      ) : (() => {
        const snapshot = snapshotResult.value;
        const overview = buildRetailOverviewModel(snapshot, selection);
        const firstUse = productsResult.status === "fulfilled" && productsResult.value.length === 0 && snapshot.metrics.orders === 0;
        const selectedPeriod = periodLabel(selection.range);
        const trendData = overview.trend.map((item) => ({ label: dailyLabel(item.label), netSales: item.netSales }));

        if (firstUse) {
          return (
            <DashboardSection
              eyebrow="البدء"
              title="جهّز أول منتج قبل قراءة الأداء"
              description="لا توجد منتجات ولا فواتير بعد، لذلك لا يعرض مَدار شاشة أرقام صفرية كثيفة على أنها Dashboard مكتملة."
              priority="primary"
            >
              <DashboardEmptyState
                title="تجارتك جاهزة لأول منتج"
                description={canWrite ? "أضف أول منتج، وبعد أول عملية بيع ستظهر مؤشرات الأداء والاتجاهات هنا." : "لا توجد بيانات تشغيلية بعد. اطلب من مالك أو مدير المساحة إضافة أول منتج."}
                icon="store"
                action={canWrite ? <ButtonLink href="/retail/workspace/products">إضافة أول منتج</ButtonLink> : undefined}
              />
            </DashboardSection>
          );
        }

        return <>
          {overview.criticalInventory.length ? (
            <DashboardCriticalException
              title={`${overview.criticalInventory.length} ${overview.criticalInventory.length === 1 ? "منتج نفد مخزونه" : "منتجات نفد مخزونها"}`}
              description={`المتوفر الآن صفر: ${itemNames(overview.criticalInventory)}${overview.criticalInventory.length > 4 ? "…" : ""}`}
              impact="قد تتعطل مبيعات هذه الأصناف حتى تتم مراجعة المخزون أو التوريد."
              action={<DashboardDrillDownLink href="/retail/workspace/inventory">فتح المخزون</DashboardDrillDownLink>}
            />
          ) : null}

          {productsResult.status === "rejected" ? (
            <DashboardDataState
              state="partial"
              title="تعذر التحقق من حالة المنتجات كاملة"
              description="مؤشرات الأداء متاحة، لكن فحص First-use من قائمة المنتجات لم يكتمل."
            />
          ) : null}

          <DashboardSection
            eyebrow="الأداء"
            title="كيف أداء تجارتك؟"
            description={`أهم مؤشرات القرار خلال ${selectedPeriod}. المقارنة تظهر فقط عندما يوفّر المصدر مرجعًا موثوقًا.`}
            priority="primary"
            actions={<DashboardDrillDownLink href="/retail/workspace/reports">فتح التقارير</DashboardDrillDownLink>}
          >
            <DashboardMetricGrid>
              {RETAIL_PRIMARY_METRICS.map((descriptor) => {
                const result = overview.primary[descriptor.id];
                return (
                  <DashboardMetricCard
                    key={descriptor.id}
                    label={descriptor.label}
                    value={metricValue(result, workspace.currency)}
                    supportingContext={<span>{descriptor.description}</span>}
                    comparison={descriptor.id === "retail.net_sales" ? comparisonContext(result, workspace.currency) : undefined}
                    action={<DashboardDrillDownLink href={descriptor.href}>التحقيق</DashboardDrillDownLink>}
                    valueDirection="ltr"
                  />
                );
              })}
            </DashboardMetricGrid>
          </DashboardSection>

          <DashboardSection
            eyebrow="الاتجاه"
            title="ماذا تغيّر؟"
            description="اتجاه صافي المبيعات اليومية فقط؛ لا يضيف مَدار رسومًا بلا سؤال واضح."
            actions={<DashboardDrillDownLink href="/retail/workspace/reports">تحليل أعمق</DashboardDrillDownLink>}
          >
            <DashboardVisualizationShell
              title="صافي المبيعات اليومية"
              description={`خلال ${selectedPeriod}`}
              state={trendData.length ? "ready" : "empty"}
              stateTitle="لا توجد نقاط زمنية"
              stateDescription="لا توجد بيانات يومية ذات معنى لهذه الفترة."
              trust={<DataTrustIndicator state="unknown" label="حداثة المصدر على مستوى الأعمال غير معروفة" detail="وقت تنفيذ القراءة لا يُعامل كـ dataAsOf للأحداث التجارية." />}
            >
              <TrendChart
                data={trendData}
                series={[{
                  key: "netSales",
                  label: "صافي المبيعات",
                  color: "series-1",
                  format: { style: "currency", currency: workspace.currency, locale: "ar-YE", numberingSystem: "latn" },
                }]}
                ariaLabel={`اتجاه صافي المبيعات اليومية خلال ${selectedPeriod}`}
                summary="يمثل كل موضع يومًا واحدًا وصافي المبيعات المسجلة فيه. الاتجاه الرقمي لا يحمل حكمًا تجاريًا تلقائيًا."
                includeZero
              />
            </DashboardVisualizationShell>
          </DashboardSection>

          {overview.attentionInventory.length ? (
            <DashboardSection
              eyebrow="الانتباه"
              title="ما الذي يحتاج انتباهك الآن؟"
              description="هذه المنتجات وصلت إلى حد المخزون الأدنى المسجل، دون اختراع درجة مخاطر أو Threshold مالي إضافي."
              actions={<DashboardDrillDownLink href="/retail/workspace/inventory">فتح المخزون</DashboardDrillDownLink>}
            >
              <DashboardAlertBlock
                title={`${overview.attentionInventory.length} ${overview.attentionInventory.length === 1 ? "منتج عند حد إعادة الطلب" : "منتجات عند حد إعادة الطلب"}`}
                description={`${itemNames(overview.attentionInventory)}${overview.attentionInventory.length > 4 ? "…" : ""}`}
                severity="attention"
                meta="يعتمد التنبيه فقط على minimum_stock المسجل للمنتج."
              />
            </DashboardSection>
          ) : null}

          <DashboardSection
            eyebrow="الحالة الراهنة"
            title="الوضع المالي الحالي"
            description="هذه أرصدة Current State من Retail، وليست مؤشرات أداء للفترة المختارة."
            priority="normal"
          >
            <DashboardMetricGrid>
              {RETAIL_CURRENT_METRICS.map((descriptor) => {
                const result = overview.current[descriptor.id];
                return (
                  <DashboardMetricCard
                    key={descriptor.id}
                    label={descriptor.label}
                    value={metricValue(result, workspace.currency)}
                    supportingContext={<MetricContext label="السياق" value="حاليًا" kind="reference" />}
                    action={<DashboardDrillDownLink href={descriptor.href}>فتح التفاصيل</DashboardDrillDownLink>}
                    valueDirection="ltr"
                  />
                );
              })}
            </DashboardMetricGrid>
          </DashboardSection>

          <DashboardSection
            eyebrow="سياق مساعد"
            title="مؤشرات تشغيلية مساندة"
            description="تساعد على تفسير الأداء دون مزاحمة مؤشرات القرار الأساسية."
            priority="supporting"
          >
            <DashboardMetricGrid>
              {RETAIL_SUPPORTING_METRICS.map((descriptor) => {
                const result = overview.supporting[descriptor.id];
                return (
                  <DashboardMetricCard
                    key={descriptor.id}
                    label={descriptor.label}
                    value={metricValue(result, workspace.currency)}
                    supportingContext={<span>{descriptor.description}</span>}
                    action={<DashboardDrillDownLink href={descriptor.href}>عرض التفاصيل</DashboardDrillDownLink>}
                    valueDirection="ltr"
                  />
                );
              })}
            </DashboardMetricGrid>
          </DashboardSection>

          <DashboardSection
            eyebrow="المنتجات"
            title="الأكثر مبيعًا"
            description={`ترتيب حسب الكمية المباعة خلال ${selectedPeriod}. التفاصيل الأعمق تبقى في التقارير.`}
            actions={<DashboardDrillDownLink href="/retail/workspace/reports">التقرير الكامل</DashboardDrillDownLink>}
          >
            <Panel className="p-4 sm:p-5">
              {overview.topProducts.length ? (
                <div className="grid gap-2">
                  {overview.topProducts.slice(0, 6).map((item, index) => (
                    <div className="md-retail-list-row" key={item.id}>
                      <span className="md-retail-rank" aria-label={`الترتيب ${index + 1}`}>{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{item.name}</p>
                        <p className="md-type-caption md-muted mt-1">{formatQuantity(item.quantity_sold)} مباعة</p>
                      </div>
                      <strong className="text-sm"><bdi dir="ltr">{formatMoney(item.revenue, workspace.currency)}</bdi></strong>
                    </div>
                  ))}
                </div>
              ) : (
                <DashboardEmptyState compact title="لا يوجد ترتيب لهذه الفترة" description="المتجر قائم، لكن لا توجد مبيعات منتجات كافية ضمن الفترة المختارة." icon="chart" />
              )}
            </Panel>
          </DashboardSection>

          {canWrite ? (
            <DashboardSection
              eyebrow="إجراءات"
              title="إجراءات سريعة"
              description="إجراءات تشغيلية أقل أولوية من قرار البيع الرئيسي الموجود في رأس الصفحة."
              priority="supporting"
            >
              <Card as="div">
                <DashboardSupportingInfo>
                  <div className="md-service-quick-actions"><div>
                    <Link href="/retail/workspace/products"><span><Icon name="layers" /></span><strong>إضافة منتج</strong><Icon name="arrow" className="md-icon-directional" /></Link>
                    <Link href="/retail/workspace/expenses"><span><Icon name="note" /></span><strong>تسجيل مصروف</strong><Icon name="arrow" className="md-icon-directional" /></Link>
                    <Link href="/retail/workspace/inventory"><span><Icon name="chart" /></span><strong>تسوية المخزون</strong><Icon name="arrow" className="md-icon-directional" /></Link>
                  </div></div>
                </DashboardSupportingInfo>
              </Card>
            </DashboardSection>
          ) : null}
        </>;
      })()}
    </WorkspaceModule>
  );
}