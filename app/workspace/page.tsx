import Link from "next/link";
import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { Icon, type IconName } from "@/components/ui/Icons";
import { sectorMetrics } from "@/src/lib/v2/sector-report";

export const dynamic = "force-dynamic";
export const metadata = { title: "لوحة معلومات الأعمال | مَدار | ORBIT" };

export default async function WorkspaceHome() {
  const { workspace, sector } = await requireBusinessWorkspace(),
    id = encodeURIComponent(workspace.id);
  const [metrics, tasks, incidents] = await Promise.all([
    sectorMetrics(workspace.id, workspace.currency, sector.extension),
    supabaseFetch(
      `/rest/v1/business_tasks?organization_id=eq.${id}&status=in.(todo,in_progress)&select=id,title,priority,due_at&order=due_at.asc.nullslast&limit=6`,
    ).catch(() => []),
    workspace.operating_mode === "CONNECTED_EXTERNAL"
      ? supabaseFetch(
          `/rest/v1/integration_health_incidents?organization_id=eq.${id}&status=neq.resolved&select=id,severity,title,opened_at&order=opened_at.desc&limit=6`,
        ).catch(() => [])
      : Promise.resolve([]),
  ]);
  const primaryAction =
    sector.extension === "food_service"
      ? { href: "/workspace/restaurant", label: "فتح تشغيل المطعم" }
      : sector.extension === "hospitality"
        ? { href: "/workspace/hotel", label: "فتح تشغيل الفندق" }
        : { href: "/workspace/sales", label: "تسجيل عملية بيع" };
  return (
    <main className="mx-auto max-w-7xl p-4 py-6 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
              {sector.specializationName}
            </span>
            <span className="rounded-full bg-violet-300/10 px-3 py-1 text-xs text-violet-100">
              {workspace.operating_mode === "MADAR_NATIVE"
                ? "مَدار مصدر الحقيقة"
                : "النظام الخارجي مصدر الحقيقة"}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black sm:text-3xl">
            ملخص مباشر لمساحة {workspace.name}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
            مؤشرات ومصطلحات ووحدات تشغيل متكيفة مع نشاطك، دون فرض نموذج متجر على
            المطعم أو الفندق.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard-app" className="md-button md-button-secondary">
            <Icon name="automation" />
            تطبيق لوحة القيادة
          </Link>
          <Link
            href={primaryAction.href}
            className="md-button md-button-primary"
          >
            <Icon name="chart" />
            {primaryAction.label}
          </Link>
        </div>
      </header>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Link
            key={metric.key}
            href={metric.href}
            className="md-card md-card-interactive flex items-center gap-3 p-4"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-200">
              <Icon name="chart" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-slate-500">
                {metric.label}
              </span>
              <strong className="mt-1 block truncate text-lg">
                {metric.value}
              </strong>
            </span>
          </Link>
        ))}
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="md-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-violet-300">العمل الحالي</p>
              <h3 className="mt-1 text-lg font-black">المهام الأقرب</h3>
            </div>
            <Link
              href="/workspace/tasks"
              className="md-button md-button-ghost md-button-sm"
            >
              كل المهام
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {tasks.length ? (
              tasks.map(
                (task: {
                  id: string;
                  title: string;
                  priority: string;
                  due_at: string | null;
                }) => (
                  <div
                    key={task.id}
                    className="rounded-xl border border-white/10 bg-white/[.025] p-3"
                  >
                    <div className="flex justify-between gap-4">
                      <span className="truncate text-sm">{task.title}</span>
                      <strong className="text-xs text-violet-200">
                        {task.priority}
                      </strong>
                    </div>
                    {task.due_at && (
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(task.due_at).toLocaleString("ar-YE")}
                      </p>
                    )}
                  </div>
                ),
              )
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                لا توجد مهام مفتوحة.
              </p>
            )}
          </div>
        </article>
        <article className="md-panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-300">
                مراقبة أوربي ومَدار
              </p>
              <h3 className="mt-1 text-lg font-black">التنبيهات التشغيلية</h3>
            </div>
            <Link
              href={
                workspace.operating_mode === "CONNECTED_EXTERNAL"
                  ? "/workspace/connect"
                  : "/workspace/orby"
              }
              className="md-button md-button-ghost md-button-sm"
            >
              فتح المركز
            </Link>
          </div>
          <div className="mt-4 grid gap-2">
            {incidents.length ? (
              incidents.map(
                (incident: {
                  id: string;
                  severity: string;
                  title: string;
                  opened_at: string;
                }) => (
                  <div
                    key={incident.id}
                    className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3"
                  >
                    <strong className="text-sm text-amber-100">
                      {incident.title}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {incident.severity} ·{" "}
                      {new Date(incident.opened_at).toLocaleString("ar-YE")}
                    </p>
                  </div>
                ),
              )
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">
                لا توجد تنبيهات حرجة حاليًا.
              </p>
            )}
          </div>
        </article>
      </section>
      <section className="mt-5">
        <h3 className="mb-3 text-sm font-black">اختصارات القطاع</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sectorShortcuts(sector.extension).map((item) => (
            <Shortcut key={item.href} {...item} />
          ))}
        </div>
      </section>
    </main>
  );
}

function sectorShortcuts(
  extension: "commerce" | "food_service" | "hospitality",
): { href: string; icon: IconName; label: string }[] {
  if (extension === "food_service")
    return [
      {
        href: "/workspace/restaurant",
        icon: "store",
        label: "الطلبات والمطبخ",
      },
      {
        href: "/workspace/inventory",
        icon: "layers",
        label: "المكونات والمخزون",
      },
      { href: "/workspace/analytics", icon: "chart", label: "تكلفة الوصفات" },
      { href: "/workspace/orby", icon: "sparkles", label: "اسأل أوربي" },
    ];
  if (extension === "hospitality")
    return [
      { href: "/workspace/hotel", icon: "home", label: "الحجوزات والإقامة" },
      { href: "/workspace/hotel", icon: "calendar", label: "الغرف والتوفر" },
      { href: "/workspace/analytics", icon: "chart", label: "تقارير الإشغال" },
      { href: "/workspace/orby", icon: "sparkles", label: "اسأل أوربي" },
    ];
  return [
    {
      href: "/workspace/procurement",
      icon: "briefcase",
      label: "شراء واستلام",
    },
    { href: "/workspace/inventory", icon: "layers", label: "المخزون والتكلفة" },
    { href: "/workspace/sales", icon: "chart", label: "البيع والمرتجعات" },
    { href: "/workspace/orby", icon: "sparkles", label: "اسأل أوربي" },
  ];
}
function Shortcut({
  href,
  icon,
  label,
}: {
  href: string;
  icon: IconName;
  label: string;
}) {
  return (
    <Link href={href} className="md-dashboard-shortcut">
      <span className="md-dashboard-shortcut-icon">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <b className="text-sm">{label}</b>
    </Link>
  );
}
