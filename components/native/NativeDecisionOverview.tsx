import Link from "next/link";
import {
  DashboardAlertBlock,
  DashboardCriticalException,
  DashboardDataState,
  DashboardDrillDownLink,
  DashboardEmptyState,
  DashboardMetricCard,
  DashboardMetricGrid,
  DashboardSection,
  DashboardStatusBlock,
  DataTrustIndicator,
  MetricContext,
} from "@/components/dashboard";
import { ButtonLink, Panel } from "@/components/ui/Enterprise";
import { Icon, type IconName } from "@/components/ui/Icons";
import { WorkspaceModule, WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";
import type { BusinessWorkspace, WorkspaceSector } from "@/src/lib/business";
import type { NormalizedMetricResult } from "@/src/lib/dashboard/metrics";
import {
  buildNativeOverviewModel,
  nativeCoreModule,
  nativeSetupRequired,
  type NativeAttentionItem,
  type NativeMetricView,
  type NativeOverviewContext,
  type NativeOverviewModel,
} from "@/src/lib/native/dashboard/domain";
import { getNativeDashboardData } from "@/src/lib/native/dashboard/server";

const decimal = new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("ar-YE", { maximumFractionDigits: 0 });

function metricValue(result: NormalizedMetricResult) {
  if (result.value === null) return "—";
  if (result.unit.kind === "money") {
    return new Intl.NumberFormat("ar-YE", {
      style: "currency",
      currency: result.unit.currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 2,
    }).format(result.value);
  }
  if (result.unit.kind === "percentage") return `${decimal.format(result.value)}٪`;
  if (result.unit.kind === "duration") {
    const unit = ({ milliseconds: "مللي ثانية", seconds: "ثانية", minutes: "دقيقة", hours: "ساعة", days: "يوم" } as const)[result.unit.unit];
    return `${decimal.format(result.value)} ${unit}`;
  }
  return result.unit.kind === "count" ? whole.format(result.value) : decimal.format(result.value);
}

function trustState(result: NormalizedMetricResult): "fresh" | "stale" | "partial" | "unknown" | "error" {
  if (result.availability.state === "error") return "error";
  if (result.availability.state !== "available" || result.coverage.state === "partial") return "partial";
  if (result.freshness.state === "fresh") return "fresh";
  if (result.freshness.state === "stale") return "stale";
  return "unknown";
}

function metricCard(metric: NativeMetricView) {
  return <DashboardMetricCard
    key={metric.result.metricId}
    label={metric.label}
    value={metricValue(metric.result)}
    supportingContext={<>
      <MetricContext label="السياق" value={metric.timeContext} kind="reference" />
      {metric.detail ? <span>{metric.detail}</span> : null}
    </>}
    trust={<DataTrustIndicator
      state={trustState(metric.result)}
      label={metric.result.availability.state === "available" ? "عقد بيانات موثوق" : "القيمة غير مكتملة"}
      detail={metric.result.freshness.state === "unknown" ? "لا توجد Freshness policy عامة لهذا المؤشر." : undefined}
      compact
    />}
    action={<DashboardDrillDownLink href={metric.href}>فتح التفاصيل</DashboardDrillDownLink>}
    valueDirection="auto"
  />;
}

function primaryAction(context: NativeOverviewContext): { href: string; label: string; icon: IconName } {
  if (context.setupStatus !== "ready" || !context.enabledModules.includes(nativeCoreModule(context.extension))) {
    return { href: "/workspace/setup", label: "استكمال الإعداد", icon: "settings" };
  }
  if (context.extension === "food_service") return { href: "/workspace/restaurant", label: "فتح تشغيل المطعم", icon: "store" };
  if (context.extension === "hospitality") return { href: "/workspace/hotel", label: "فتح تشغيل الفندق", icon: "home" };
  return { href: "/workspace/sales", label: "تسجيل عملية بيع", icon: "chart" };
}

function setupCopy(context: NativeOverviewContext) {
  if (context.setupStatus !== "ready") return "إعداد مساحة النشاط لم يكتمل بعد. أكمل الإعداد قبل عرض مؤشرات تشغيل قد توحي بأن النظام جاهز.";
  return `وحدة التشغيل الأساسية (${nativeCoreModule(context.extension)}) غير مفعلة. لا تعرض مَدار مؤشرات أو أصفارًا لوحدة غير متاحة.`;
}

function firstUseCopy(context: NativeOverviewContext) {
  if (context.extension === "food_service") {
    return { title: "ابدأ تشغيل المطعم", description: "لا توجد وصفات أو طلبات تشغيلية بعد. ابدأ من وحدة المطعم المفعلة.", href: "/workspace/restaurant", label: "فتح تشغيل المطعم" };
  }
  if (context.extension === "hospitality") {
    return { title: "ابدأ إعداد الفندق", description: "لا توجد منشآت أو غرف تشغيلية بعد. ابدأ من وحدة الفندق المفعلة.", href: "/workspace/hotel", label: "فتح تشغيل الفندق" };
  }
  if (context.enabledModules.includes("products")) {
    return { title: "ابدأ تشغيل التجارة", description: "لا توجد منتجات نشطة أو عمليات بيع مكتملة بعد. أضف أول منتج ثم سجّل أول عملية فعلية.", href: "/workspace/products", label: "إضافة أول منتج" };
  }
  return { title: "ابدأ تشغيل التجارة", description: "لا توجد عمليات بيع مكتملة بعد، ووحدة المنتجات غير مفعلة. ابدأ من وحدة المبيعات المتاحة.", href: "/workspace/sales", label: "فتح المبيعات" };
}

function attentionBlock(item: NativeAttentionItem) {
  const samples = item.samples?.length ? ` أمثلة: ${item.samples.join("، ")}.` : "";
  if (item.severity === "critical") {
    return <DashboardCriticalException key={`${item.href}-${item.title}`} title={item.title} description={`${item.description}${samples}`} action={<DashboardDrillDownLink href={item.href}>التصرف الآن</DashboardDrillDownLink>} />;
  }
  return <DashboardAlertBlock key={`${item.href}-${item.title}`} title={item.title} description={`${item.description}${samples}`} severity="attention" action={<DashboardDrillDownLink href={item.href}>فتح التفاصيل</DashboardDrillDownLink>} />;
}

function quickActions(context: NativeOverviewContext) {
  const actions: Array<{ href: string; label: string; icon: IconName; module: string }> = context.extension === "food_service"
    ? [
        { href: "/workspace/restaurant", label: "الطلبات والمطبخ", icon: "store", module: "restaurant" },
        { href: "/workspace/inventory", label: "المكونات والمخزون", icon: "layers", module: "inventory" },
        { href: "/workspace/tasks", label: "المهام", icon: "check", module: "tasks" },
        { href: "/workspace/orby", label: "اسأل ORBY", icon: "sparkles", module: "orby" },
      ]
    : context.extension === "hospitality"
      ? [
          { href: "/workspace/hotel", label: "تشغيل الفندق", icon: "home", module: "hotel" },
          { href: "/workspace/tasks", label: "المهام", icon: "check", module: "tasks" },
          { href: "/workspace/orby", label: "اسأل ORBY", icon: "sparkles", module: "orby" },
        ]
      : [
          { href: "/workspace/sales", label: "عملية بيع", icon: "chart", module: "sales" },
          { href: "/workspace/products", label: "إضافة منتج", icon: "store", module: "products" },
          { href: "/workspace/expenses", label: "تسجيل مصروف", icon: "document", module: "expenses" },
          { href: "/workspace/inventory", label: "المخزون", icon: "layers", module: "inventory" },
          { href: "/workspace/orby", label: "اسأل ORBY", icon: "sparkles", module: "orby" },
        ];
  return actions.filter((action) => context.enabledModules.includes(action.module));
}

function CurrentAndSupporting({ model }: { model: NativeOverviewModel }) {
  return <>
    {model.current.length ? <DashboardSection eyebrow="التشغيل" title="الحالة التشغيلية الحالية" description="Current State فقط؛ هذه القيم لا تتظاهر بأنها تتبع فترة زمنية عالمية." priority="normal"><DashboardMetricGrid>{model.current.map(metricCard)}</DashboardMetricGrid></DashboardSection> : null}
    {model.supporting.length ? <DashboardSection eyebrow="السياق" title="معلومات داعمة للقرار" description="مؤشرات مساندة فقط، وليست طبقة KPIs رئيسية إضافية." priority="supporting"><DashboardMetricGrid>{model.supporting.map(metricCard)}</DashboardMetricGrid></DashboardSection> : null}
  </>;
}

export async function NativeDecisionOverview({ workspace, sector, moduleUnavailable }: { workspace: BusinessWorkspace; sector: WorkspaceSector; moduleUnavailable: boolean }) {
  const context: NativeOverviewContext = Object.freeze({
    currency: workspace.currency,
    setupStatus: workspace.setup_status,
    extension: sector.extension,
    specializationName: sector.specializationName,
    enabledModules: Object.freeze([...sector.enabledModules]),
  });
  const action = primaryAction(context);
  const needsSetup = nativeSetupRequired(context);

  if (needsSetup) {
    return <WorkspaceModule>
      <WorkspaceModuleHeader
        eyebrow="نظرة Native"
        title={workspace.name}
        description={`تشغيل ${sector.specializationName} داخل مَدار يبدأ من الوحدات المفعلة فعليًا، وليس من Dashboard افتراضية.`}
        icon={sector.extension === "hospitality" ? "home" : "store"}
        actions={<ButtonLink href="/workspace/setup"><Icon name="settings" />استكمال الإعداد</ButtonLink>}
      />
      {moduleUnavailable ? <DashboardStatusBlock title="هذه الوحدة غير مفعّلة" description="أعدناك إلى النظرة العامة بدل فتح وظيفة غير متاحة. أكمل إعداد الوحدات المطلوبة قبل استخدامها." tone="warning" action={<DashboardDrillDownLink href="/workspace/setup">إعداد الوحدات</DashboardDrillDownLink>} /> : null}
      <DashboardSection eyebrow="الإعداد" title="مساحة النشاط غير جاهزة للتشغيل بعد" description="لا تعرض مَدار Dashboard ناقصة أو أرقامًا صفرية لوحدات لم تُفعّل." priority="primary">
        <DashboardEmptyState title="استكمل إعداد نشاطك" description={setupCopy(context)} icon="settings" action={<ButtonLink href="/workspace/setup">استكمال الإعداد</ButtonLink>} />
      </DashboardSection>
    </WorkspaceModule>;
  }

  const data = await getNativeDashboardData(workspace.id, context.extension, context.enabledModules);
  const model = buildNativeOverviewModel(context, data, new Date().toISOString());
  const starter = firstUseCopy(context);
  const actions = quickActions(context);

  return <WorkspaceModule>
    <WorkspaceModuleHeader
      eyebrow={`نظرة Native · ${sector.specializationName}`}
      title={workspace.name}
      description="راقب أهم مؤشرات قطاعك، ما يحتاج تدخلك الآن، والحالة التشغيلية الحالية؛ التفاصيل والتحقيق تبقى في وحداتها المتخصصة."
      icon={sector.extension === "hospitality" ? "home" : "store"}
      actions={<>
        {context.enabledModules.includes("orby") ? <ButtonLink href="/workspace/orby" variant="secondary"><Icon name="sparkles" />اسأل ORBY</ButtonLink> : null}
        <ButtonLink href={action.href}><Icon name={action.icon} />{action.label}</ButtonLink>
      </>}
    />

    {moduleUnavailable ? <DashboardStatusBlock title="هذه الوحدة غير مفعّلة" description="أعدناك إلى النظرة العامة بدل فتح وظيفة غير متاحة. لا تظهر مؤشرات أو إجراءات الوحدة المعطلة هنا." tone="warning" action={<DashboardDrillDownLink href="/workspace/setup">إعداد الوحدات</DashboardDrillDownLink>} /> : null}

    {model.critical.map(attentionBlock)}

    {model.isPartial ? <DashboardDataState state="partial" title="الصورة الحالية جزئية" description={`تعذر التحقق من: ${model.failedSources.join("، ") || "مصدر بيانات واحد على الأقل"}. القيم المفقودة لا تتحول إلى 0 ولا إلى حالة سليمة.`} action={<DashboardDrillDownLink href={action.href}>فتح التشغيل</DashboardDrillDownLink>} /> : null}

    {model.notices.length ? <DashboardSection eyebrow="الثقة" title="سياق يجب معرفته قبل قراءة الأرقام" description="تظهر هذه الرسائل عندما لا يمكن توحيد العملة أو الزمن بأمان؛ لا تنفذ مَدار FX أو افتراضات زمنية ضمن Phase 7."><div className="grid gap-3">{model.notices.map((notice) => <DashboardStatusBlock key={`${notice.href}-${notice.title}`} title={notice.title} description={notice.description} tone={notice.tone} action={<DashboardDrillDownLink href={notice.href}>فتح التفاصيل</DashboardDrillDownLink>} />)}</div></DashboardSection> : null}

    {model.isFirstUse ? <DashboardSection eyebrow="البدء" title={starter.title} description="هذه حالة First-use حقيقية وليست بديلًا عن صفر تشغيلي أثناء وجود نشاط." priority="primary"><DashboardEmptyState title={starter.title} description={starter.description} icon={context.extension === "hospitality" ? "home" : "store"} action={<ButtonLink href={starter.href}>{starter.label}</ButtonLink>} /></DashboardSection> : <>
      <DashboardSection eyebrow="الأهم" title="المؤشرات الأساسية لهذا القطاع" description="كل مؤشر يمر عبر Phase 4 ويحمل سياقه الزمني الحقيقي؛ لا توجد فترة عالمية أو مقارنة مختلقة." priority="primary">
        {model.primary.length ? <DashboardMetricGrid>{model.primary.map(metricCard)}</DashboardMetricGrid> : <DashboardDataState state="unknown" title="لا توجد مؤشرات موثوقة متاحة الآن" description="الوحدات المفعلة أو بياناتها الحالية لا تسمح بعرض KPI رئيسية دون اختراع قيمة." />}
      </DashboardSection>
      {model.attention.length ? <DashboardSection eyebrow="الانتباه" title="ما الذي يحتاج تدخلك الآن؟" description="تظهر فقط حقائق Domain تستحق إجراءً؛ الحالات التشغيلية العادية لا تتحول إلى Alerts."><div className="grid gap-3">{model.attention.map(attentionBlock)}</div></DashboardSection> : null}
      <CurrentAndSupporting model={model} />
    </>}

    <DashboardSection eyebrow="التحقيق" title="انتقل إلى الوحدة صاحبة القرار" description="Overview للمراقبة والقرار؛ التشغيل والتحقيق التفصيليان يبقيان في الوحدات المتخصصة." priority="supporting">
      <Panel className="p-4 sm:p-5"><div className="flex flex-wrap gap-2">
        <DashboardDrillDownLink href={action.href}>فتح التشغيل الرئيسي</DashboardDrillDownLink>
        <DashboardDrillDownLink href="/workspace/activity">سجل العمليات</DashboardDrillDownLink>
        {context.enabledModules.includes("analytics") ? <DashboardDrillDownLink href="/workspace/analytics">التحليلات</DashboardDrillDownLink> : null}
      </div></Panel>
    </DashboardSection>

    {actions.length ? <section className="md-service-quick-actions" aria-labelledby="native-quick-actions"><div><span className="md-eyebrow">إجراءات سريعة</span><h2 id="native-quick-actions">ماذا تريد أن تفعل الآن؟</h2></div><div>{actions.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href}><span><Icon name={item.icon} /></span><strong>{item.label}</strong><Icon name="arrow" className="md-icon-directional" /></Link>)}</div></section> : null}
  </WorkspaceModule>;
}
