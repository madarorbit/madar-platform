import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import V2PaymentForm from "@/components/payments/V2PaymentForm";
import V2ActionForm from "@/components/v2/V2ActionForm";
import { changeV2Subscription } from "@/app/actions/v2-operations";
import { businessMoney, requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import {
  operatingModeLabels,
  planLevelLabels,
  type PlanLevel,
} from "@/src/lib/v2/account";

export const dynamic = "force-dynamic";
export const metadata = { title: "الاشتراك والدفع | مَدار" };

const rank = (level: string) =>
  level === "BASIC" ? 1 : level === "PREMIUM" ? 2 : 3;
const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null;
const statusLabels: Record<string, string> = {
  trialing: "تجربة مجانية",
  active: "نشط",
  past_due: "يحتاج تجديدًا",
  expired: "منتهي",
  cancelled: "ملغى",
  missing: "غير مكتمل",
  under_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  scheduled: "مجدول",
  applied: "مطبّق",
};
const entitlementLabels: Record<string, string> = {
  workspace_access: "فتح مساحة العمل",
  team_members: "أعضاء الفريق",
  products: "المنتجات",
  storage_mb: "التخزين بالميجابايت",
  import_rows: "صفوف الاستيراد",
  orby_daily_messages: "رسائل أوربي اليومية",
  orby_write_tools: "أدوات أوربي التنفيذية",
  connectors: "الاتصالات النشطة",
  advanced_analytics: "التحليلات المتقدمة",
  reverse_write: "الكتابة العكسية",
};

type Variant = {
  id: string;
  code: string;
  level_code: PlanLevel;
  term_months: number;
  operating_mode: "MADAR_NATIVE" | "CONNECTED_EXTERNAL";
};
type Snapshot = {
  id: string;
  status: string;
  currency: string;
  locked_amount: number;
  locked_entitlements: Record<string, unknown>;
  trial_ends_at: string | null;
  trial_days_remaining: number;
  starts_at: string;
  ends_at: string | null;
  is_grandfathered: boolean;
  pricing_variants: Variant | Variant[];
};
type Catalog = {
  id: string;
  code: string;
  level_code: PlanLevel;
  name_ar: string;
  description_ar: string;
  term_months: number;
  operating_mode: string;
  duration_discount: number;
  mode_multiplier: number;
  trial_days: number;
  currency: string;
  amount: number;
  monthly_equivalent: number;
  launch_notice: string;
  entitlements: Record<string, unknown>;
};
type PaymentRequest = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  payment_reference: string;
  review_note: string | null;
  created_at: string;
};
type SubscriptionChange = {
  id: string;
  change_type: string;
  effective_at: string;
  status: string;
};

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    expired?: string;
    missing?: string;
    cancelled?: string;
  }>;
}) {
  const { workspace, subscriptionStatus } = await requireBusinessWorkspace({
      allowExpired: true,
      allowMissing: true,
      allowCancelled: true,
    }),
    params = await searchParams,
    id = encodeURIComponent(workspace.id),
    currency = encodeURIComponent(workspace.currency);
  const [snapshots, catalogRows, methodRows, requestRows, changeRows] =
    await Promise.all([
      supabaseFetch(
        `/rest/v1/pricing_current_subscriptions?organization_id=eq.${id}&select=id,status,currency,locked_amount,locked_entitlements,trial_ends_at,trial_days_remaining,starts_at,ends_at,is_grandfathered,pricing_variants(id,code,level_code,term_months,operating_mode)&order=created_at.desc&limit=1`,
      ),
      supabaseFetch(
        `/rest/v1/pricing_public_catalog?operating_mode=eq.${workspace.operating_mode}&currency=eq.${currency}&select=*&order=level_code,term_months`,
      ),
      supabaseFetch(
        `/rest/v1/payment_methods?is_active=eq.true&currency=eq.${currency}&select=id,name,currency,account_name,account_identifier,instructions&order=sort_order`,
      ),
      supabaseFetch(
        `/rest/v1/pricing_local_payment_requests?organization_id=eq.${id}&select=id,status,currency,amount,payment_reference,review_note,created_at,pricing_variants(code,level_code,term_months),payment_methods(name)&order=created_at.desc&limit=30`,
      ),
      supabaseFetch(
        `/rest/v1/pricing_subscription_changes?organization_id=eq.${id}&select=id,change_type,effective_at,status,requested_at,pricing_variants!pricing_subscription_changes_to_variant_id_fkey(code,level_code,term_months)&order=requested_at.desc&limit=20`,
      ).catch(() => []),
    ]);
  const snapshot = (snapshots?.[0] || null) as Snapshot | null,
    variant = snapshot ? one(snapshot.pricing_variants) : null,
    items = (catalogRows || []) as Catalog[],
    requests = (requestRows || []) as PaymentRequest[],
    changes = (changeRows || []) as SubscriptionChange[],
    currentLevel = variant?.level_code || "BASIC",
    lower = snapshot
      ? items.filter((item) => rank(item.level_code) < rank(currentLevel))
      : [],
    isLocked = ["missing", "expired", "cancelled"].includes(
      subscriptionStatus,
    );

  return (
    <main className="mx-auto max-w-7xl p-4 py-8 sm:p-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <header>
          <p className="font-bold text-emerald-300">
            MADAR Pricing & Entitlements Engine
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            الاشتراك والدفع
          </h1>
          <p className="mt-3 text-slate-300">
            {workspace.name} · {operatingModeLabels[workspace.operating_mode]} ·{" "}
            {workspace.currency}
          </p>
        </header>
        <Link href="/account" className="md-button md-button-secondary">
          العودة إلى الحساب
        </Link>
      </div>

      <div className="mt-6">
        <ActionFeedback success={params.success} error={params.error} />
      </div>

      {isLocked ? (
        <LockedNotice status={subscriptionStatus} />
      ) : snapshot?.status === "trialing" ? (
        <p className="mt-6 rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4 text-violet-100">
          التجربة المجانية نشطة. متبقي {snapshot.trial_days_remaining} يومًا من 20
          يومًا، ويُحسم العدد باستخدام وقت الخادم.
        </p>
      ) : null}

      <section className="mt-7 grid gap-7 lg:grid-cols-[1fr_420px]">
        {snapshot && variant ? (
          <article className="md-panel">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                    {statusLabels[subscriptionStatus] || subscriptionStatus}
                  </span>
                  {snapshot.is_grandfathered ? (
                    <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                      بيانات محفوظة من الانتقال إلى V2
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-4 text-3xl font-black">
                  {planLevelLabels[currentLevel]}
                </h2>
                <p className="mt-2 text-slate-400">
                  {variant.term_months} شهر · {variant.code}
                </p>
              </div>
              <div className="text-left">
                <strong className="text-3xl text-emerald-200">
                  {businessMoney(snapshot.locked_amount, snapshot.currency)}
                </strong>
                <p className="mt-1 text-xs text-slate-500">
                  السعر المحفوظ للدورة الحالية
                </p>
              </div>
            </div>

            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <DateMetric label="بداية الدورة" value={snapshot.starts_at} />
              <DateMetric label="نهاية الدورة" value={snapshot.ends_at} />
            </dl>

            <h3 className="mt-7 text-xl font-black">الاستحقاقات الفعلية</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(snapshot.locked_entitlements).map(
                ([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-white/10 p-3"
                  >
                    <p className="text-xs text-slate-500">
                      {entitlementLabels[key] || key}
                    </p>
                    <strong className="mt-1 block">
                      {formatEntitlement(value)}
                    </strong>
                  </div>
                ),
              )}
            </div>
            <p className="mt-6 text-xs leading-6 text-amber-100">
              سعر خاص بمناسبة الإطلاق الأول، وسيتم تغييره لاحقًا. السعر المحفوظ
              في الاشتراك لا يتغير داخل الدورة الحالية.
            </p>
          </article>
        ) : (
          <article className="md-panel border-red-300/20 bg-red-300/[.035]">
            <span className="rounded-full bg-red-300/10 px-3 py-1 text-xs text-red-100">
              اشتراك غير مكتمل
            </span>
            <h2 className="mt-4 text-2xl font-black">
              لا توجد لقطة اشتراك V2 لهذه المساحة
            </h2>
            <p className="mt-3 max-w-2xl leading-8 text-slate-300">
              أُغلقت أدوات مساحة العمل حمايةً للبيانات، لكن لم تُحذف أي بيانات.
              يمكنك اختيار باقة V2 وإرسال إثبات الدفع من النموذج المجاور، أو
              مراجعة الإدارة لإصلاح التهيئة الحالية دون إنشاء مساحة أخرى.
            </p>
          </article>
        )}

        <V2PaymentForm
          catalog={items}
          methods={methodRows || []}
          currentLevel={currentLevel}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-black">خيارات الباقات المتاحة</h2>
        <p className="mt-2 text-slate-400">
          الأسعار أدناه بعملة مساحة العمل فقط. وضع الربط أعلى بنسبة 20%، وخصم 6
          أشهر 10% و12 شهرًا 20%.
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead className="bg-white/[.05]">
                <tr>
                  <th className="p-4">المستوى</th>
                  <th className="p-4">المدة</th>
                  <th className="p-4">الخصم</th>
                  <th className="p-4">الوضع</th>
                  <th className="p-4">الإجمالي</th>
                  <th className="p-4">شهريًا</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-white/10 transition-colors hover:bg-white/[.025]"
                  >
                    <td className="p-4 font-bold">{item.name_ar}</td>
                    <td className="p-4">{item.term_months} شهر</td>
                    <td className="p-4">
                      {Math.round(item.duration_discount * 100)}%
                    </td>
                    <td className="p-4">
                      {item.operating_mode === "CONNECTED_EXTERNAL"
                        ? "ربط قائم +20%"
                        : "مَدار أساسي"}
                    </td>
                    <td className="p-4">
                      {businessMoney(item.amount, item.currency)}
                    </td>
                    <td className="p-4">
                      {businessMoney(item.monthly_equivalent, item.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {snapshot && lower.length > 0 && !isLocked ? (
        <section className="mt-10 max-w-xl">
          <V2ActionForm
            action={changeV2Subscription}
            title="جدولة خفض المستوى"
            description="لا يتغير وصولك الآن؛ يبدأ المستوى الأقل بعد نهاية الدورة الحالية."
            submitLabel="جدولة الخفض"
          >
            <select
              name="variant_id"
              required
              className="field w-full rounded-xl p-3"
            >
              {lower.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name_ar} · {item.term_months} شهر ·{" "}
                  {businessMoney(item.amount, item.currency)}
                </option>
              ))}
            </select>
            <input type="hidden" name="currency" value={workspace.currency} />
          </V2ActionForm>
        </section>
      ) : null}

      <section className="mt-10 grid gap-7 lg:grid-cols-2">
        <HistorySection title="طلبات الدفع">
          {requests.length ? (
            requests.map((item) => (
              <article
                key={item.id}
                className="md-card flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <strong>{businessMoney(item.amount, item.currency)}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.payment_reference} ·{" "}
                    {new Date(item.created_at).toLocaleString("ar-YE")}
                  </p>
                  {item.review_note ? (
                    <p className="mt-2 text-sm text-red-200">
                      {item.review_note}
                    </p>
                  ) : null}
                </div>
                <span>{statusLabels[item.status] || item.status}</span>
              </article>
            ))
          ) : (
            <EmptyHistory text="لا توجد طلبات دفع." />
          )}
        </HistorySection>

        <HistorySection title="تغييرات الدورة التالية">
          {changes.length ? (
            changes.map((item) => (
              <article
                key={item.id}
                className="md-card flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <strong>{changeTypeLabel(item.change_type)}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.effective_at).toLocaleString("ar-YE")}
                  </p>
                </div>
                <span>{statusLabels[item.status] || item.status}</span>
              </article>
            ))
          ) : (
            <EmptyHistory text="لا توجد تغييرات مجدولة." />
          )}
        </HistorySection>
      </section>
    </main>
  );
}

function LockedNotice({ status }: { status: string }) {
  const copy =
    status === "expired"
      ? "انتهت مدة الاشتراك أو التجربة، لذلك أُغلقت أدوات مساحة العمل تلقائيًا دون حذف بياناتك."
      : status === "cancelled"
        ? "الاشتراك ملغى، لذلك يقتصر الوصول الآن على الحساب والدفع حتى اعتماد اشتراك جديد."
        : "لم يكتمل ربط اشتراك V2 بهذه المساحة، لذلك أُغلق الوصول التشغيلي احترازيًا.";
  return (
    <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 p-5 text-red-50">
      <strong className="text-lg">مساحة العمل مقفلة مؤقتًا</strong>
      <p className="mt-2 leading-7">{copy}</p>
      <p className="mt-2 text-sm text-red-100/80">
        إعادة الفتح تتم فقط بعد اعتماد الإدارة لطلب الدفع وفق قواعد مَدار V2.0.
      </p>
    </div>
  );
}

function DateMetric({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-white/10 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold">
        {value ? new Date(value).toLocaleString("ar-YE") : "غير محدد"}
      </dd>
    </div>
  );
}

function formatEntitlement(value: unknown) {
  if (value === -1 || value === "-1") return "غير محدود";
  if (value === true || value === "true") return "متاح";
  if (value === false || value === "false") return "غير متاح";
  return String(value);
}

function changeTypeLabel(type: string) {
  return (
    {
      UPGRADE: "ترقية",
      DOWNGRADE: "خفض مستوى",
      TERM_CHANGE: "تغيير مدة",
      MODE_CHANGE: "تغيير وضع التشغيل",
    }[type] || type
  );
}

function HistorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-2xl font-black">{title}</h2>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function EmptyHistory({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-slate-500">
      {text}
    </p>
  );
}
