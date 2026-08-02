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
export const metadata = { title: "الباقات والأسعار | مَدار" };
const rank = (level: string) =>
  level === "BASIC" ? 1 : level === "PREMIUM" ? 2 : 3;
const one = <T,>(value: T | T[]) => (Array.isArray(value) ? value[0] : value);

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

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    expired?: string;
    missing?: string;
  }>;
}) {
  const { workspace, subscriptionStatus } = await requireBusinessWorkspace({
      allowExpired: true,
    }),
    params = await searchParams,
    id = encodeURIComponent(workspace.id);
  const [snapshots, catalog, methods, requests, changes] = await Promise.all([
      supabaseFetch(
        `/rest/v1/pricing_current_subscriptions?organization_id=eq.${id}&select=id,status,currency,locked_amount,locked_entitlements,trial_ends_at,trial_days_remaining,starts_at,ends_at,is_grandfathered,pricing_variants(id,code,level_code,term_months,operating_mode)&order=created_at.desc&limit=1`,
      ),
      supabaseFetch(
        `/rest/v1/pricing_public_catalog?operating_mode=eq.${workspace.operating_mode}&select=*&order=level_code,term_months,currency`,
      ),
      supabaseFetch(
        "/rest/v1/payment_methods?is_active=eq.true&select=id,name,currency,account_name,account_identifier,instructions&order=sort_order",
      ),
      supabaseFetch(
        `/rest/v1/pricing_local_payment_requests?organization_id=eq.${id}&select=id,status,currency,amount,payment_reference,review_note,created_at,pricing_variants(code,level_code,term_months),payment_methods(name)&order=created_at.desc&limit=30`,
      ),
      supabaseFetch(
        `/rest/v1/pricing_subscription_changes?organization_id=eq.${id}&select=id,change_type,effective_at,status,requested_at,pricing_variants!pricing_subscription_changes_to_variant_id_fkey(code,level_code,term_months)&order=requested_at.desc&limit=20`,
      ).catch(() => []),
    ]),
    snapshot = (snapshots?.[0] || null) as Snapshot | null;
  if (!snapshot)
    return (
      <main className="mx-auto max-w-3xl p-6 py-16">
        <h1 className="text-3xl font-black">لا توجد لقطة اشتراك V2</h1>
        <p className="mt-4 text-slate-300">
          حساب الأعمال لم يكتمل إنشاؤه. تواصل مع الإدارة لاستعادة التهيئة دون
          إنشاء مسار عمل ثانٍ.
        </p>
      </main>
    );
  const variant = one(snapshot.pricing_variants),
    items = (catalog || []) as Catalog[],
    currentLevel = variant.level_code,
    trialDays = snapshot.trial_days_remaining,
    lower = items.filter(
      (item) =>
        item.currency === snapshot.currency &&
        rank(item.level_code) < rank(currentLevel),
    );
  return (
    <main className="mx-auto max-w-7xl p-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <header>
          <p className="font-bold text-emerald-300">
            MADAR Pricing & Entitlements Engine
          </p>
          <h1 className="mt-2 text-4xl font-black">الباقات والأسعار</h1>
          <p className="mt-3 text-slate-300">
            {workspace.name} · {operatingModeLabels[workspace.operating_mode]}
          </p>
        </header>
        <Link href="/workspace" className="md-button md-button-secondary">
          العودة لمساحة العمل
        </Link>
      </div>
      <div className="mt-6">
        <ActionFeedback success={params.success} error={params.error} />
      </div>
      <section className="mt-7 grid gap-7 lg:grid-cols-[1fr_420px]">
        <article className="md-panel">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                {snapshot.status} · {subscriptionStatus}
              </span>
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
                سعر محفوظ لهذه الدورة
              </p>
            </div>
          </div>
          {snapshot.status === "trialing" && (
            <p className="mt-5 rounded-2xl border border-violet-300/20 bg-violet-300/10 p-4 text-violet-100">
              التجربة المجانية: متبقي {trialDays} يومًا من 20 يومًا.
            </p>
          )}
          <h3 className="mt-7 text-xl font-black">الاستحقاقات الفعلية</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(snapshot.locked_entitlements).map(
              ([key, value]) => (
                <div
                  key={key}
                  className="rounded-xl border border-white/10 p-3"
                >
                  <p className="text-xs text-slate-500">{key}</p>
                  <strong className="mt-1 block">
                    {String(value) === "-1" ? "غير محدود" : String(value)}
                  </strong>
                </div>
              ),
            )}
          </div>
          <p className="mt-6 text-xs leading-6 text-amber-100">
            سعر خاص بمناسبة الإطلاق الأول، وسيتم تغييره لاحقًا. السعر المحفوظ في
            اشتراكك لا يتغير داخل الدورة الحالية.
          </p>
        </article>
        <V2PaymentForm
          catalog={items}
          methods={methods || []}
          currentLevel={currentLevel}
        />
      </section>
      <section className="mt-10">
        <h2 className="text-2xl font-black">خيارات وضع التشغيل الحالي</h2>
        <p className="mt-2 text-slate-400">
          ينشئ المحرك 18 Variant من 3 مستويات × 3 مدد × نمطي تشغيل؛ وتعرض هذه
          القائمة نمط مساحتك بكل العملات المدعومة. وضع الربط أعلى بنسبة 20%،
          وخصم 6 أشهر 10% و12 شهرًا 20%.
        </p>
        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-right">
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
                    key={`${item.id}-${item.currency}`}
                    className="border-t border-white/10"
                  >
                    <td className="p-4 font-bold">{item.name_ar}</td>
                    <td className="p-4">{item.term_months} شهر</td>
                    <td className="p-4">{item.duration_discount * 100}%</td>
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
      {lower.length > 0 && (
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
            <input type="hidden" name="currency" value={snapshot.currency} />
          </V2ActionForm>
        </section>
      )}
      <section className="mt-10 grid gap-7 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-black">طلبات الدفع</h2>
          <div className="mt-4 grid gap-3">
            {requests.map(
              (item: {
                id: string;
                status: string;
                amount: number;
                currency: string;
                payment_reference: string;
                review_note: string | null;
                created_at: string;
              }) => (
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
                    {item.review_note && (
                      <p className="mt-2 text-sm text-red-200">
                        {item.review_note}
                      </p>
                    )}
                  </div>
                  <span>{item.status}</span>
                </article>
              ),
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black">تغييرات الدورة التالية</h2>
          <div className="mt-4 grid gap-3">
            {changes.map(
              (item: {
                id: string;
                change_type: string;
                effective_at: string;
                status: string;
              }) => (
                <article
                  key={item.id}
                  className="md-card flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <strong>{item.change_type}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(item.effective_at).toLocaleString("ar-YE")}
                    </p>
                  </div>
                  <span>{item.status}</span>
                </article>
              ),
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
