import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import {
  adjustFounderV2Subscription,
  updateFounderOrganization,
} from "@/app/actions/founder";
import { requireSuperAdmin } from "@/src/lib/auth";
import { businessMoney } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "المساحات واشتراكات V2 | مَدار" };

type Organization = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: "active" | "suspended" | "archived";
  currency: string;
  operating_mode: "MADAR_NATIVE" | "CONNECTED_EXTERNAL";
  setup_status: string;
  created_at: string;
};
type OwnerMembership = {
  organization_id: string;
  role: string;
  profiles:
    | { full_name: string | null; email: string | null }
    | Array<{ full_name: string | null; email: string | null }>
    | null;
};
type Variant = {
  code: string;
  level_code: string;
  term_months: number;
};
type Subscription = {
  id: string;
  organization_id: string;
  status: string;
  ends_at: string | null;
  trial_ends_at: string | null;
  trial_days_remaining: number;
  locked_amount: number;
  currency: string;
  is_grandfathered: boolean;
  created_at: string;
  pricing_variants: Variant | Variant[] | null;
};

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null;
const statusLabels: Record<string, string> = {
  trialing: "تجربة",
  active: "نشط",
  past_due: "يحتاج تجديدًا",
  expired: "منتهي",
  cancelled: "ملغى",
  missing: "غير مكتمل",
  suspended: "موقوفة",
  archived: "مؤرشفة",
};

export default async function FounderWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    q?: string;
    subscription?: string;
  }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams,
    query = String(params.q || "").trim().toLocaleLowerCase("ar"),
    subscriptionFilter = String(params.subscription || "");
  const [organizationRows, ownerRows, subscriptionRows] = await Promise.all([
    supabaseFetch(
      "/rest/v1/organizations?type=neq.STUDENT&select=id,name,slug,type,status,currency,operating_mode,setup_status,created_at&order=created_at.desc",
    ),
    supabaseFetch(
      "/rest/v1/organization_members?role=eq.OWNER&select=organization_id,role,profiles(full_name,email)",
    ),
    supabaseFetch(
      "/rest/v1/pricing_current_subscriptions?select=id,organization_id,status,ends_at,trial_ends_at,trial_days_remaining,locked_amount,currency,is_grandfathered,created_at,pricing_variants(code,level_code,term_months)&order=created_at.desc",
    ),
  ]);
  const organizations = (organizationRows || []) as Organization[],
    owners = (ownerRows || []) as OwnerMembership[],
    subscriptions = (subscriptionRows || []) as Subscription[],
    ownerByOrg = new Map(
      owners.map((owner) => [owner.organization_id, one(owner.profiles)]),
    ),
    subscriptionByOrg = new Map<string, Subscription>();
  for (const subscription of subscriptions)
    if (!subscriptionByOrg.has(subscription.organization_id))
      subscriptionByOrg.set(subscription.organization_id, subscription);

  const filtered = organizations.filter((organization) => {
      const owner = ownerByOrg.get(organization.id),
        subscription = subscriptionByOrg.get(organization.id),
        subscriptionStatus = subscription?.status || "missing",
        searchable = `${organization.name} ${organization.slug} ${owner?.full_name || ""} ${owner?.email || ""}`.toLocaleLowerCase("ar");
      return (
        (!query || searchable.includes(query)) &&
        (!subscriptionFilter || subscriptionStatus === subscriptionFilter)
      );
    }),
    missing = organizations.filter(
      (organization) => !subscriptionByOrg.has(organization.id),
    ).length,
    locked = organizations.filter((organization) =>
      ["expired", "cancelled"].includes(
        subscriptionByOrg.get(organization.id)?.status || "missing",
      ),
    ).length,
    active = organizations.filter((organization) =>
      ["trialing", "active", "past_due"].includes(
        subscriptionByOrg.get(organization.id)?.status || "missing",
      ),
    ).length;

  return (
    <main className="mx-auto max-w-7xl p-4 py-8 sm:p-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-bold text-violet-200">مركز المؤسس</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            المساحات واشتراكات V2
          </h1>
          <p className="mt-3 max-w-3xl leading-8 text-slate-400">
            إدارة حالة مساحة العمل ولقطة اشتراك V2 الحالية. لا تُقرأ أو تُعدّل
            اشتراكات V1 من هذه الصفحة، ولا يؤدي الإيقاف أو الانتهاء إلى حذف
            بيانات العميل.
          </p>
        </div>
        <Link href="/admin/founder" className="md-button md-button-secondary">
          العودة لمركز القيادة
        </Link>
      </div>

      <div className="mt-6">
        <ActionFeedback success={params.success} error={params.error} />
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="كل مساحات الأعمال" value={organizations.length} />
        <Metric label="اشتراك أو تجربة سارية" value={active} />
        <Metric label="مساحات مقفلة" value={locked} />
        <Metric label="دون لقطة V2" value={missing} danger={missing > 0} />
      </section>

      <form className="mt-7 grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-[1fr_230px_auto]">
        <label className="grid gap-2 text-sm font-bold">
          البحث
          <input
            name="q"
            defaultValue={params.q || ""}
            className="field rounded-xl p-3"
            placeholder="اسم المساحة أو المالك أو البريد"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          حالة الاشتراك
          <select
            name="subscription"
            defaultValue={subscriptionFilter}
            className="field rounded-xl p-3"
          >
            <option value="">كل الحالات</option>
            <option value="trialing">تجربة</option>
            <option value="active">نشط</option>
            <option value="past_due">يحتاج تجديدًا</option>
            <option value="expired">منتهي</option>
            <option value="cancelled">ملغى</option>
            <option value="missing">دون لقطة V2</option>
          </select>
        </label>
        <button className="md-button md-button-primary self-end">تطبيق</button>
      </form>

      <section className="mt-7 space-y-5">
        {filtered.map((organization) => {
          const owner = ownerByOrg.get(organization.id),
            subscription = subscriptionByOrg.get(organization.id),
            variant = one(subscription?.pricing_variants),
            deadline = subscription?.ends_at || subscription?.trial_ends_at;
          return (
            <article key={organization.id} className="md-panel">
              <div className="grid gap-7 xl:grid-cols-[1fr_300px_430px]">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <StatusPill status={organization.status} />
                    <StatusPill status={subscription?.status || "missing"} />
                    <span className="rounded-full bg-white/10 px-3 py-1">
                      {organization.operating_mode === "CONNECTED_EXTERNAL"
                        ? "ربط خارجي"
                        : "مَدار أساسي"}
                    </span>
                    {subscription?.is_grandfathered ? (
                      <span className="rounded-full bg-amber-300/10 px-3 py-1 text-amber-100">
                        انتقال محفوظ من V1
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-2xl font-black">
                    {organization.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    /{organization.slug} · {organization.currency} · إعداد{" "}
                    {organization.setup_status}
                  </p>
                  <p className="mt-4 text-sm">
                    المالك: <strong>{owner?.full_name || "غير معروف"}</strong>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {owner?.email || "—"} · أُنشئت{" "}
                    {new Date(organization.created_at).toLocaleDateString("ar-YE")}
                  </p>

                  {subscription ? (
                    <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">الباقة الحالية</p>
                        <strong className="mt-1 block">
                          {variant?.code || "باقة V2"}
                        </strong>
                        <p className="mt-1 text-xs text-slate-400">
                          {variant?.term_months || "—"} شهر
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">السعر المحفوظ</p>
                        <strong className="mt-1 block text-emerald-200">
                          {businessMoney(
                            subscription.locked_amount,
                            subscription.currency,
                          )}
                        </strong>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-slate-500">موعد الانتهاء</p>
                        <strong className="mt-1 block">
                          {deadline
                            ? new Date(deadline).toLocaleString("ar-YE")
                            : "غير محدد — يحتاج مراجعة"}
                        </strong>
                        {subscription.status === "trialing" ? (
                          <p className="mt-1 text-xs text-violet-200">
                            متبقي {subscription.trial_days_remaining} يومًا
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-100">
                      لا توجد لقطة اشتراك V2. المساحة مقفلة احترازيًا ولا يمكن
                      منحها وصولًا من منطق V1.
                    </p>
                  )}
                </div>

                <form
                  action={updateFounderOrganization}
                  className="grid content-start gap-4 rounded-2xl border border-white/10 p-5"
                >
                  <input
                    type="hidden"
                    name="organization_id"
                    value={organization.id}
                  />
                  <h3 className="font-black">حالة مساحة العمل</h3>
                  <select
                    name="status"
                    defaultValue={organization.status}
                    className="field rounded-xl p-3"
                  >
                    <option value="active">نشطة</option>
                    <option value="suspended">موقوفة مؤقتًا</option>
                    <option value="archived">مؤرشفة</option>
                  </select>
                  <button className="md-button md-button-secondary">
                    تحديث المساحة
                  </button>
                  <p className="text-xs leading-6 text-slate-500">
                    هذا التحكم مستقل عن صلاحية الاشتراك، ولا يحذف أي سجل أو ملف.
                  </p>
                </form>

                {subscription ? (
                  <form
                    action={adjustFounderV2Subscription}
                    className="grid content-start gap-4 rounded-2xl border border-violet-300/20 bg-violet-300/[.05] p-5"
                  >
                    <input
                      type="hidden"
                      name="organization_id"
                      value={organization.id}
                    />
                    <h3 className="font-black text-violet-100">
                      الصلاحية الزمنية V2
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm font-bold">
                        تعديل الأيام
                        <input
                          name="days_delta"
                          type="number"
                          min={-3650}
                          max={3650}
                          defaultValue={0}
                          className="field rounded-xl p-3"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-bold">
                        الحالة
                        <select
                          name="subscription_status"
                          defaultValue={
                            subscription.status === "trialing"
                              ? "active"
                              : subscription.status
                          }
                          className="field rounded-xl p-3"
                        >
                          <option value="active">نشط</option>
                          <option value="past_due">يحتاج تجديدًا</option>
                          <option value="expired">منتهي</option>
                          <option value="cancelled">ملغى</option>
                        </select>
                      </label>
                    </div>
                    <button className="md-button md-button-primary">
                      حفظ اشتراك V2
                    </button>
                    <p className="text-xs leading-6 text-slate-500">
                      إعادة التنشيط تتطلب تاريخ انتهاء مستقبليًا. كل تغيير يُسجل
                      ويرسل إشعارًا لإدارة المساحة.
                    </p>
                  </form>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-7 text-slate-500">
                    لا يمكن تعديل صلاحية زمنية دون لقطة V2. يجب إصلاح التهيئة أو
                    اعتماد دفع V2 بدل إنشاء اشتراك إداري غير مسعّر.
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!filtered.length ? (
          <p className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-500">
            لا توجد مساحات مطابقة للبحث والتصفية.
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <article className="md-card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <strong
        className={`mt-2 block text-3xl ${danger ? "text-red-200" : "text-slate-100"}`}
      >
        {value.toLocaleString("ar-YE")}
      </strong>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const className = ["active", "trialing"].includes(status)
    ? "bg-emerald-300/10 text-emerald-100"
    : ["past_due", "suspended"].includes(status)
      ? "bg-amber-300/10 text-amber-100"
      : ["expired", "cancelled", "missing"].includes(status)
        ? "bg-red-300/10 text-red-100"
        : "bg-white/10 text-slate-300";
  return (
    <span className={`rounded-full px-3 py-1 ${className}`}>
      {statusLabels[status] || status}
    </span>
  );
}
