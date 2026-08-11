import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import { broadcastFounderNotification } from "@/app/actions/founder";
import { requireSuperAdmin } from "@/src/lib/auth";
import { businessMoney } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "مركز قيادة المؤسس | مَدار" };

type Overview = {
  users: { total: number; active: number; admins: number };
  workspaces: {
    total: number;
    active: number;
    suspended: number;
    without_v2_subscription: number;
  };
  subscriptions: {
    total: number;
    trialing: number;
    active: number;
    past_due: number;
    expired: number;
    cancelled: number;
    pending_payments: number;
    approved_revenue: Record<string, number>;
  };
  store: {
    products: number;
    services: number;
    orders: number;
    approved_revenue: number;
  };
  operations: {
    pending_workspace_requests: number;
    open_feedback: number;
    privacy_requests: number;
    integration_incidents: number;
  };
  generated_at: string;
};
const scalar = <T,>(value: unknown) =>
  Array.isArray(value) ? (value[0] as T) : (value as T);

export default async function FounderPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const profile = await requireSuperAdmin(),
    params = await searchParams;
  const [overviewValue, workspaces] = await Promise.all([
    supabaseFetch("/rest/v1/rpc/founder_platform_overview", {
      method: "POST",
      body: "{}",
    }),
    supabaseFetch(
      "/rest/v1/organizations?select=id,name,status&type=neq.STUDENT&order=created_at.desc&limit=250",
    ),
  ]);
  const overview = scalar<Overview>(overviewValue),
    lockedSubscriptions =
      overview.subscriptions.expired + overview.subscriptions.cancelled,
    alerts = [
      overview.subscriptions.pending_payments > 0
        ? {
            level: "warning",
            title: `${overview.subscriptions.pending_payments} دفعة تنتظر المراجعة`,
            body: "راجع الإثباتات قبل أن تتراكم طلبات فتح المساحات أو تجديدها.",
            href: "/admin/local-payments",
          }
        : null,
      overview.workspaces.without_v2_subscription > 0
        ? {
            level: "critical",
            title: `${overview.workspaces.without_v2_subscription} مساحة دون اشتراك خدمة`,
            body: "هذه المساحات مقفلة احترازيًا وتحتاج تصحيح التهيئة أو دفعًا معتمدًا.",
            href: "/admin/founder/workspaces?subscription=missing",
          }
        : null,
      overview.operations.integration_incidents > 0
        ? {
            level: "critical",
            title: `${overview.operations.integration_incidents} حادث ربط مفتوح`,
            body: "راجع صحة الموصلات ومصدر الحقيقة قبل تنفيذ أي كتابة عكسية.",
            href: "/admin/system-health",
          }
        : null,
      lockedSubscriptions > 0
        ? {
            level: "info",
            title: `${lockedSubscriptions} اشتراك منتهٍ أو ملغى`,
            body: "بيانات العملاء محفوظة، والوصول التشغيلي يظل مقفلاً حتى الاعتماد.",
            href: "/admin/founder/workspaces?subscription=expired",
          }
        : null,
      overview.operations.open_feedback > 0
        ? {
            level: "info",
            title: `${overview.operations.open_feedback} بلاغات أو ملاحظات مفتوحة`,
            body: "رتبها حسب الأثر على الاستقرار وتجربة العملاء.",
            href: "/admin/support-operations",
          }
        : null,
    ].filter(Boolean) as Array<{
      level: string;
      title: string;
      body: string;
      href: string;
    }>;
  const commandLinks = [
    [
      "/admin/local-payments",
      "مراجعة المدفوعات",
      "اعتماد أو رفض إثباتات الخدمات وإدارة طرق الدفع.",
    ],
    [
      "/admin/founder/workspaces",
      "المساحات والاشتراكات",
      "إدارة إغلاق المساحات والصلاحية الزمنية دون حذف البيانات.",
    ],
    [
      "/admin/orby-os/observability",
      "أداء أوربي",
      "مراقبة التشغيل والسجلات والتكلفة والأخطاء والمهام.",
    ],
    [
      "/admin/orby-os/models",
      "مزودات أوربي",
      "فحص البوابات الخارجية والنماذج وحالة التفعيل الآمن.",
    ],
    [
      "/admin/system-health",
      "صحة المنصة",
      "مراجعة قاعدة البيانات والخدمات ومؤشرات الإطلاق.",
    ],
    [
      "/admin/founder/audit",
      "سجل القرارات",
      "تتبع كل عملية إدارية حساسة ومن نفذها ووقتها.",
    ],
    [
      "/admin/founder/users",
      "الحسابات والصلاحيات",
      "البحث عن المستخدمين وتحديث أدوارهم وحالاتهم.",
    ],
    [
      "/admin/founder/settings",
      "إعدادات المنصة",
      "التحكم بالتسجيل والصيانة والمتجر وأوربي والإعلانات.",
    ],
  ];
  const operationalLinks = [
    ["/admin/support-operations", "الدعم والخصوصية"],
    ["/admin/products", "منتجات متجر مَدار"],
    ["/admin/services", "خدمات مَدار"],
    ["/admin/orders", "طلبات المتجر"],
    ["/admin/reports", "تقارير المتجر"],
    ["/admin/applications", "طلبات التوظيف"],
  ];

  return (
    <main className="mx-auto max-w-7xl p-4 py-8 sm:p-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-bold text-emerald-300">FOUNDER COMMAND CENTER</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            مركز قيادة مَدار
          </h1>
          <p className="mt-3 max-w-3xl leading-8 text-slate-300">
            {profile.full_name} · رؤية موحدة للمنصة والعملاء والمدفوعات والربط
            وأوربي. الحساب المؤسس محمي من التعطيل أو خفض الصلاحية.
          </p>
        </div>
        <Link href="/admin" className="md-button md-button-secondary">
          لوحة الإدارة العامة
        </Link>
      </div>

      <div className="mt-6">
        <ActionFeedback {...params} />
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="المستخدمون النشطون" value={overview.users.active} />
        <Metric label="مساحات الأعمال" value={overview.workspaces.total} />
        <Metric
          label="دفعات تنتظر المراجعة"
          value={overview.subscriptions.pending_payments}
          tone={overview.subscriptions.pending_payments ? "warning" : "success"}
        />
        <Metric
          label="حوادث الربط المفتوحة"
          value={overview.operations.integration_incidents}
          tone={
            overview.operations.integration_incidents ? "danger" : "success"
          }
        />
        <Metric label="تجارب نشطة" value={overview.subscriptions.trialing} />
        <Metric label="اشتراكات نشطة" value={overview.subscriptions.active} />
        <Metric
          label="تحتاج تجديدًا"
          value={overview.subscriptions.past_due}
          tone={overview.subscriptions.past_due ? "warning" : "neutral"}
        />
        <Metric
          label="مساحات دون اشتراك خدمة"
          value={overview.workspaces.without_v2_subscription}
          tone={
            overview.workspaces.without_v2_subscription ? "danger" : "success"
          }
        />
      </section>

      <section className="mt-10 grid gap-7 lg:grid-cols-[1fr_370px]">
        <article>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">أهم التنبيهات</h2>
              <p className="mt-2 text-sm text-slate-400">
                مرتبة بحسب ما يحتاج قرارًا أو متابعة تشغيلية.
              </p>
            </div>
            <span className="text-sm text-slate-500">
              {alerts.length} تنبيه
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            {alerts.length ? (
              alerts.map((alert) => (
                <Link
                  key={`${alert.href}-${alert.title}`}
                  href={alert.href}
                  className={`rounded-2xl border p-5 transition hover:bg-white/[.035] ${
                    alert.level === "critical"
                      ? "border-red-300/20 bg-red-300/[.045]"
                      : alert.level === "warning"
                        ? "border-amber-300/20 bg-amber-300/[.045]"
                        : "border-white/10 bg-white/[.025]"
                  }`}
                >
                  <strong>{alert.title}</strong>
                  <p className="mt-2 text-sm leading-7 text-slate-400">
                    {alert.body}
                  </p>
                </Link>
              ))
            ) : (
              <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[.045] p-6 text-emerald-100">
                لا توجد تنبيهات تشغيلية حرجة حاليًا.
              </p>
            )}
          </div>
        </article>

        <article className="md-panel">
          <h2 className="text-2xl font-black">الإيرادات المعتمدة</h2>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            مجموع طلبات الدفع المحلية التي اعتمدتها الإدارة، مع فصل العملات لمنع
            جمع قيم غير قابلة للمقارنة.
          </p>
          <div className="mt-5 grid gap-3">
            {Object.entries(overview.subscriptions.approved_revenue).length ? (
              Object.entries(overview.subscriptions.approved_revenue).map(
                ([currency, amount]) => (
                  <div
                    key={currency}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-4"
                  >
                    <span>{currency}</span>
                    <strong className="text-xl text-emerald-200">
                      {businessMoney(amount, currency)}
                    </strong>
                  </div>
                ),
              )
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
                لا توجد مدفوعات معتمدة بعد.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="mt-11">
        <h2 className="text-2xl font-black">إجراءات القيادة</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {commandLinks.map(([href, title, description]) => (
            <Link
              key={href}
              href={href}
              className="rounded-3xl border border-violet-300/20 bg-violet-300/[.055] p-5 transition hover:-translate-y-0.5 hover:border-violet-300/50"
            >
              <h3 className="text-lg font-black text-violet-100">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                {description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-11 grid gap-8 lg:grid-cols-[1fr_430px]">
        <article>
          <h2 className="text-2xl font-black">الإدارة التشغيلية</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {operationalLinks.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-white/10 bg-white/[.03] p-4 font-bold transition hover:border-emerald-300/40 hover:text-emerald-200"
              >
                {label}
              </Link>
            ))}
          </div>
        </article>

        <form
          action={broadcastFounderNotification}
          className="md-panel grid gap-4 border-emerald-300/20 bg-emerald-300/[.045]"
        >
          <div>
            <h2 className="text-2xl font-black">إشعار من المؤسس</h2>
            <p className="mt-2 text-sm text-slate-400">
              الروابط الخارجية مرفوضة؛ يسمح فقط بمسار داخلي آمن داخل مَدار.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-bold">
            الجمهور
            <select name="audience" className="field rounded-xl p-3">
              <option value="all">جميع الحسابات النشطة</option>
              <option value="customers">العملاء والمحررون</option>
              <option value="admins">الإدارة فقط</option>
              <option value="workspace">مساحة عمل محددة</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            المساحة عند اختيار جمهور محدد
            <select
              name="organization_id"
              defaultValue=""
              className="field rounded-xl p-3"
            >
              <option value="">لا توجد</option>
              {workspaces?.map(
                (workspace: { id: string; name: string; status: string }) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {workspace.status}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            العنوان
            <input
              name="title"
              required
              minLength={3}
              maxLength={180}
              className="field rounded-xl p-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            الرسالة
            <textarea
              name="body"
              required
              minLength={3}
              maxLength={2000}
              rows={5}
              className="field rounded-xl p-3"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold">
            رابط داخلي اختياري
            <input
              name="link"
              maxLength={500}
              placeholder="/account/notifications"
              className="field rounded-xl p-3"
              dir="ltr"
            />
          </label>
          <button className="md-button md-button-primary">إرسال الإشعار</button>
        </form>
      </section>

      <p className="mt-8 text-xs text-slate-500">
        آخر تحديث للمؤشرات:{" "}
        {new Date(overview.generated_at).toLocaleString("ar-YE")}
      </p>
    </main>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "text-slate-100",
    success: "text-emerald-200",
    warning: "text-amber-200",
    danger: "text-red-200",
  }[tone];
  return (
    <article className="md-card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <strong className={`mt-2 block text-3xl ${toneClass}`}>
        {value.toLocaleString("ar-YE")}
      </strong>
    </article>
  );
}
