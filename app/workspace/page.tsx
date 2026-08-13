import Link from "next/link";
import {
  Badge,
  ButtonLink,
  EmptyState,
  Notice,
  Panel,
  Stat,
  StatusBadge,
} from "@/components/ui/Enterprise";
import { Icon, type IconName } from "@/components/ui/Icons";
import { WorkspaceModule, WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";
import { requireBusinessWorkspace, type BusinessWorkspace, type WorkspaceSector } from "@/src/lib/business";
import { formatDateTime } from "@/src/lib/format";
import {
  connectionStatusLabel,
  connectionStatusTone,
  getConnectedOverview,
  latestHealthByConnection,
} from "@/src/lib/services/experience";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { sectorMetrics } from "@/src/lib/v2/sector-report";

export const dynamic = "force-dynamic";
export const metadata = { title: "نظرة عامة | مساحة مَدار" };

export default async function WorkspaceHome({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const [context, params] = await Promise.all([requireBusinessWorkspace(), searchParams]);
  return context.workspace.operating_mode === "CONNECTED_EXTERNAL"
    ? <ConnectedDashboard workspace={context.workspace} sector={context.sector} />
    : <NativeDashboard workspace={context.workspace} sector={context.sector} moduleUnavailable={params.module === "unavailable"} />;
}

async function ConnectedDashboard({ workspace, sector }: { workspace: BusinessWorkspace; sector: WorkspaceSector }) {
  const overview = await getConnectedOverview(workspace.id);
  const connections = overview.connections.data;
  const healthByConnection = latestHealthByConnection(overview.health.data);
  const hasConnectionError = connections.some((item) => ["error", "disconnected"].includes(item.status));
  const hasConnecting = connections.some((item) => ["draft", "verifying"].includes(item.status));
  const overall = !connections.length ? "draft" : hasConnectionError ? "error" : hasConnecting ? "pending" : "active";
  const latestSuccess = connections.map((item) => item.last_success_at).filter((value): value is string => Boolean(value)).sort().at(-1) || null;
  const recordTypes = new Set(overview.records.data.map((record) => record.entity_type));
  const failedSections = Object.values(overview).filter((item) => item.failed).length;

  return <WorkspaceModule>
    <WorkspaceModuleHeader
      eyebrow="ملخص مباشر · ربط تجارة قائمة"
      title={`مركز قيادة ${workspace.name}`}
      description="ابدأ بصحة الربط وحداثة البيانات، ثم انتقل إلى التقارير أو اسأل ORBY ضمن سياق هذه المساحة."
      icon="layers"
      actions={<><ButtonLink href="/workspace/connect" variant="secondary"><Icon name="layers" />فحص الربط</ButtonLink><ButtonLink href="/workspace/orby"><Icon name="sparkles" />اسأل ORBY</ButtonLink></>}
    />
    {failedSections ? <Notice title="بعض مؤشرات الربط لم تتحدث" variant="warning">بقية المساحة ما زالت قابلة للاستخدام. افتح مركز الربط للمحاولة مجددًا.</Notice> : null}

    <section className="md-service-primary-grid" aria-label="أهم مؤشرات الربط">
      <Stat label="حالة الربط" value={<StatusBadge status={overall}>{overall === "active" ? "متصل" : overall === "pending" ? "جارٍ الإعداد" : overall === "error" ? "يحتاج إصلاحًا" : "غير مربوط"}</StatusBadge>} detail={`${connections.length.toLocaleString("ar-YE")} اتصال`} />
      <Stat label="آخر مزامنة ناجحة" value={latestSuccess ? formatDateTime(latestSuccess) : "لم تتم بعد"} detail="من جميع الاتصالات الحالية" />
      <Stat label="البيانات الواصلة" value={overview.records.data.length.toLocaleString("ar-YE")} detail={`${recordTypes.size.toLocaleString("ar-YE")} نوع بيانات ضمن السجلات المحملة`} />
      <Stat label="تنبيهات مفتوحة" value={overview.incidents.data.length.toLocaleString("ar-YE")} detail="تحذيرات وأخطاء تحتاج متابعة" />
    </section>

    <section className="md-service-dashboard-grid">
      <Panel className="md-service-panel">
        <div className="md-service-panel-heading"><div><span className="md-eyebrow">الصحة أولًا</span><h2>الاتصالات الحالية</h2></div><Link href="/workspace/connect" className="md-button md-button-ghost md-button-sm">التفاصيل والمزامنة</Link></div>
        <div className="md-service-list">
          {connections.length ? connections.map((connection) => {
            const health = healthByConnection.get(connection.id);
            const status = health?.status || connection.status;
            return <article key={connection.id} className="md-service-list-row">
              <span className="md-service-list-icon"><Icon name="layers" /></span>
              <div><strong>{connection.name}</strong><small>{connection.connector_key} · {connection.connection_mode === "READ_ONLY" ? "قراءة فقط" : "كتابة محددة"}</small></div>
              <div className="md-service-row-meta"><StatusBadge status={connectionStatusTone(status)}>{connectionStatusLabel(status)}</StatusBadge><small>{connection.last_success_at ? `آخر نجاح ${formatDateTime(connection.last_success_at)}` : "لم تنجح مزامنة بعد"}</small></div>
            </article>;
          }) : <EmptyState compact title="لا يوجد اتصال بعد" description="ابدأ بموصل معتمد أو أرسل طلب موصل لنظامك الحالي." icon="layers" action={<ButtonLink href="/workspace/connect">إعداد أول اتصال</ButtonLink>} />}
        </div>
      </Panel>

      <Panel className="md-service-panel">
        <div className="md-service-panel-heading"><div><span className="md-eyebrow">يحتاج انتباهك</span><h2>التنبيهات والمشكلات</h2></div></div>
        <div className="md-service-list">
          {overview.incidents.data.length ? overview.incidents.data.map((incident) => <article key={incident.id} className="md-service-list-row is-warning">
            <span className="md-service-list-icon"><Icon name="warning" /></span>
            <div><strong>{incident.title}</strong><small>{formatDateTime(incident.opened_at)}</small></div>
            <Badge variant={incident.severity === "critical" || incident.severity === "error" ? "danger" : "warning"}>{incident.severity === "critical" ? "حرج" : incident.severity === "error" ? "خطأ" : "تحذير"}</Badge>
          </article>) : <EmptyState compact title="لا توجد تنبيهات مفتوحة" description={connections.length ? "لم تسجل مَدار مشكلة ربط تحتاج إجراءً حاليًا." : "ستظهر تنبيهات صحة الربط بعد إنشاء الاتصال."} icon="check" />}
        </div>
      </Panel>
    </section>

    <Panel className="md-service-panel">
      <div className="md-service-panel-heading"><div><span className="md-eyebrow">المزامنة</span><h2>آخر العمليات</h2></div><Link href="/workspace/data" className="md-button md-button-ghost md-button-sm">البيانات الواصلة</Link></div>
      <div className="md-service-activity">
        {overview.runs.data.length ? overview.runs.data.map((run) => <article key={run.id}>
          <StatusBadge status={connectionStatusTone(run.status)}>{connectionStatusLabel(run.status)}</StatusBadge>
          <div><strong>{run.sync_mode === "initial" ? "مزامنة أولى" : "مزامنة تزايدية"}</strong><small>{Number(run.records_received).toLocaleString("ar-YE")} سجل · {formatDateTime(run.started_at)}</small>{run.error_message ? <p>{run.error_message}</p> : null}</div>
        </article>) : <EmptyState compact title="لا يوجد سجل مزامنة" description="بعد تشغيل أول مزامنة ستظهر مدتها وحالتها وعدد السجلات هنا." icon="clock" />}
      </div>
    </Panel>

    <QuickActions items={[
      { href: "/workspace/connect", icon: "layers", label: connections.length ? "مزامنة وفحص الربط" : "إعداد أول اتصال" },
      { href: "/workspace/data", icon: "document", label: "استعراض البيانات" },
      ...(sector.enabledModules.includes("analytics") ? [{ href: "/workspace/analytics", icon: "chart" as IconName, label: "فتح التقارير" }] : []),
      { href: "/workspace/orby", icon: "sparkles", label: `اسأل ORBY عن ${sector.specializationName}` },
    ]} />
  </WorkspaceModule>;
}

async function NativeDashboard({ workspace, sector, moduleUnavailable }: { workspace: BusinessWorkspace; sector: WorkspaceSector; moduleUnavailable: boolean }) {
  const id = encodeURIComponent(workspace.id);
  const [metrics, tasks, activity] = await Promise.all([
    sectorMetrics(workspace.id, workspace.currency, sector.extension),
    sector.enabledModules.includes("tasks")
      ? supabaseFetch(`/rest/v1/business_tasks?organization_id=eq.${id}&status=in.(todo,in_progress)&select=id,title,priority,due_at&order=due_at.asc.nullslast&limit=6`).catch(() => [])
      : Promise.resolve([]),
    supabaseFetch(`/rest/v1/sector_operation_events?organization_id=eq.${id}&select=id,event_key,entity_type,occurred_at&order=occurred_at.desc&limit=6`).catch(() => []),
  ]) as [Awaited<ReturnType<typeof sectorMetrics>>, Array<{ id: string; title: string; priority: string; due_at: string | null }>, Array<{ id: number; event_key: string; entity_type: string; occurred_at: string }>];
  const primaryAction = nativePrimaryAction(sector);
  const visibleMetrics = nativeVisibleMetrics(metrics, sector);
  const shortcuts = nativeQuickActions(sector).filter((item) => !item.module || sector.enabledModules.includes(item.module));

  return <WorkspaceModule>
    <WorkspaceModuleHeader
      eyebrow="ملخص مباشر · إنشاء تجارة على مَدار"
      title={workspace.name}
      description={`تشغيل ${sector.specializationName} من مصدر حقيقة واحد داخل مَدار، مع عرض ما هو مفعّل فعليًا فقط.`}
      icon={sector.extension === "hospitality" ? "home" : "store"}
      actions={<><ButtonLink href="/workspace/orby" variant="secondary"><Icon name="sparkles" />اسأل ORBY</ButtonLink><ButtonLink href={workspace.setup_status === "ready" ? primaryAction.href : "/workspace/setup"}><Icon name={primaryAction.icon} />{workspace.setup_status === "ready" ? primaryAction.label : "استكمال الإعداد"}</ButtonLink></>}
    />
    {moduleUnavailable ? <Notice title="هذه الوحدة غير مفعّلة في المساحة" variant="warning">أعدناك إلى النظرة العامة بدل فتح وظيفة غير متاحة. راجع إعدادات النشاط إذا كانت الوحدة مطلوبة.</Notice> : null}

    <section className="md-service-primary-grid" aria-label="أهم مؤشرات النشاط">
      {visibleMetrics.map((metric) => <Link key={metric.key} href={metric.href} className="md-service-stat-link"><Stat label={metric.label} value={metric.value} detail="فتح التفاصيل" /></Link>)}
    </section>
    {!visibleMetrics.length ? <EmptyState compact title="لا توجد مؤشرات مفعّلة بعد" description="فعّل وحدة تشغيل فعلية من إعدادات النشاط؛ لن نعرض أرقامًا لوظائف غير مفعّلة." icon="chart" action={<ButtonLink href="/workspace/setup" variant="secondary">إعداد الوحدات</ButtonLink>} /> : null}

    <section className="md-service-dashboard-grid">
      <Panel className="md-service-panel">
        <div className="md-service-panel-heading"><div><span className="md-eyebrow">العمل الحالي</span><h2>المهام الأقرب</h2></div>{sector.enabledModules.includes("tasks") ? <Link href="/workspace/tasks" className="md-button md-button-ghost md-button-sm">كل المهام</Link> : null}</div>
        <div className="md-service-list">{tasks.length ? tasks.map((task) => <article className="md-service-list-row" key={task.id}><span className="md-service-list-icon"><Icon name="check" /></span><div><strong>{task.title}</strong><small>{task.due_at ? formatDateTime(task.due_at) : "دون موعد محدد"}</small></div><Badge variant={task.priority === "urgent" || task.priority === "high" ? "warning" : "default"}>{priorityLabel(task.priority)}</Badge></article>) : <EmptyState compact title="لا توجد مهام مفتوحة" description="لا نضيف مهام افتراضية. تظهر هنا المهام الحقيقية عند إنشائها." icon="check" />}</div>
      </Panel>
      <Panel className="md-service-panel">
        <div className="md-service-panel-heading"><div><span className="md-eyebrow">آخر النشاط</span><h2>ما حدث داخل المساحة</h2></div><Link href="/workspace/activity" className="md-button md-button-ghost md-button-sm">السجل الكامل</Link></div>
        <div className="md-service-list">{activity.length ? activity.map((event) => <article className="md-service-list-row" key={event.id}><span className="md-service-list-icon"><Icon name="clock" /></span><div><strong>{eventLabel(event.event_key)}</strong><small>{event.entity_type} · {formatDateTime(event.occurred_at)}</small></div></article>) : <EmptyState compact title="لا يوجد نشاط تشغيلي بعد" description="ابدأ أول عملية فعلية في الوحدة المفعّلة لتظهر هنا." icon="clock" />}</div>
      </Panel>
    </section>

    <QuickActions items={shortcuts.map(({ href, icon, label }) => ({ href, icon, label }))} />
  </WorkspaceModule>;
}

function QuickActions({ items }: { items: Array<{ href: string; icon: IconName; label: string }> }) {
  return <section className="md-service-quick-actions" aria-labelledby="quick-actions-title"><div><span className="md-eyebrow">إجراءات سريعة</span><h2 id="quick-actions-title">ماذا تريد أن تفعل الآن؟</h2></div><div>{items.map((item) => <Link key={`${item.href}-${item.label}`} href={item.href}><span><Icon name={item.icon} /></span><strong>{item.label}</strong><Icon name="arrow" className="md-icon-directional" /></Link>)}</div></section>;
}

function nativePrimaryAction(sector: WorkspaceSector): { href: string; label: string; icon: IconName } {
  if (sector.extension === "food_service" && sector.enabledModules.includes("restaurant")) return { href: "/workspace/restaurant", label: "فتح تشغيل المطعم", icon: "store" };
  if (sector.extension === "hospitality" && sector.enabledModules.includes("hotel")) return { href: "/workspace/hotel", label: "فتح تشغيل الفندق", icon: "home" };
  if (sector.extension === "commerce" && sector.enabledModules.includes("sales")) return { href: "/workspace/sales", label: "تسجيل عملية بيع", icon: "chart" };
  return { href: "/workspace/setup", label: "إعداد وحدات النشاط", icon: "settings" };
}

function nativeVisibleMetrics(metrics: Awaited<ReturnType<typeof sectorMetrics>>, sector: WorkspaceSector) {
  const moduleForMetric: Record<string, string> = sector.extension === "food_service"
    ? { orders: "restaurant", revenue: "restaurant", food_cost: "inventory", profit: "analytics" }
    : sector.extension === "hospitality"
      ? { rooms: "hotel", occupied: "hotel", occupancy: "analytics", room_revenue: "analytics" }
      : { revenue: "sales", cogs: "procurement", returns: "sales", profit: "analytics" };
  return metrics.filter((metric) => sector.enabledModules.includes(moduleForMetric[metric.key])).slice(0, 4);
}

function nativeQuickActions(sector: WorkspaceSector): Array<{ href: string; icon: IconName; label: string; module?: string }> {
  if (sector.extension === "food_service") return [
    { href: "/workspace/restaurant", icon: "store", label: "الطلبات والمطبخ", module: "restaurant" },
    { href: "/workspace/inventory", icon: "layers", label: "المكونات والمخزون", module: "inventory" },
    { href: "/workspace/analytics", icon: "chart", label: "تقارير المطعم", module: "analytics" },
    { href: "/workspace/orby", icon: "sparkles", label: "اسأل ORBY" },
  ];
  if (sector.extension === "hospitality") return [
    { href: "/workspace/hotel", icon: "home", label: "الحجوزات والإقامة", module: "hotel" },
    { href: "/workspace/analytics", icon: "chart", label: "تقارير الإشغال", module: "analytics" },
    { href: "/workspace/setup", icon: "settings", label: "إعدادات النشاط" },
    { href: "/workspace/orby", icon: "sparkles", label: "اسأل ORBY" },
  ];
  return [
    { href: "/workspace/sales", icon: "chart", label: "عملية بيع", module: "sales" },
    { href: "/workspace/products", icon: "store", label: "إضافة منتج", module: "products" },
    { href: "/workspace/expenses", icon: "document", label: "تسجيل مصروف", module: "expenses" },
    { href: "/workspace/orby", icon: "sparkles", label: "اسأل ORBY" },
  ];
}

function priorityLabel(priority: string) {
  return ({ low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" } as Record<string, string>)[priority] || priority;
}

function eventLabel(event: string) {
  return ({
    "commerce.purchase.received": "تم استلام مشتريات",
    "commerce.sale.returned": "تم تسجيل مرتجع بيع",
    "restaurant.order.completed": "اكتمل طلب مطعم",
    "hotel.reservation.created": "أضيف حجز فندقي",
  } as Record<string, string>)[event] || event.replaceAll(".", " · ");
}
