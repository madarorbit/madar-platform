import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import {
  reviewV2LocalPayment,
  savePaymentMethod,
} from "@/app/actions/local-payments";
import { requireAdmin } from "@/src/lib/auth";
import { businessMoney } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الدفع والاشتراكات | إدارة مَدار" };

type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  method_type: string;
  account_name: string | null;
  account_identifier: string | null;
  instructions: string | null;
  currency: "YER" | "SAR" | "USD";
  is_active: boolean;
  sort_order: number;
};
type NamedRelation = { name: string } | Array<{ name: string }> | null;
type VariantRelation =
  | { code: string; level_code: string; term_months: number }
  | Array<{ code: string; level_code: string; term_months: number }>
  | null;
type V2Payment = {
  id: string;
  status: "under_review" | "approved" | "rejected";
  amount: number;
  currency: string;
  payment_reference: string;
  review_note: string | null;
  created_at: string;
  payment_methods: NamedRelation;
  organizations: NamedRelation;
  pricing_variants: VariantRelation;
};
type LegacyPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  payment_reference: string;
  review_note?: string | null;
  created_at: string;
  payment_methods: NamedRelation;
  organizations?: NamedRelation;
  workspace_requests?:
    | { name: string; type: string; status: string }
    | Array<{ name: string; type: string; status: string }>
    | null;
};
type BetaSlot = {
  ordinal: number;
  status: string;
  user_id: string | null;
  organization_id: string | null;
  reserved_until: string | null;
  activated_at: string | null;
};

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null;
const statusLabels: Record<string, string> = {
  under_review: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  activated: "مفعّل",
  reserved: "محجوز",
  available: "متاح",
};

export default async function LocalPaymentsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const feedback = await searchParams;
  const [methodRows, workspaceRows, renewalRows, slotRows, v2Rows] =
    await Promise.all([
      supabaseFetch("/rest/v1/payment_methods?select=*&order=sort_order.asc"),
      supabaseFetch(
        "/rest/v1/workspace_payment_submissions?select=id,status,amount,currency,payment_reference,created_at,workspace_request_id,payment_methods(name),workspace_requests(name,type,status)&order=created_at.desc&limit=100",
      ),
      supabaseFetch(
        "/rest/v1/subscription_renewal_requests?select=id,status,amount,currency,payment_reference,review_note,created_at,organization_id,payment_methods(name),organizations(name)&order=created_at.desc&limit=100",
      ),
      supabaseFetch(
        "/rest/v1/beta_founder_slots?select=ordinal,status,user_id,organization_id,reserved_until,activated_at&order=ordinal.asc",
      ),
      supabaseFetch(
        "/rest/v1/pricing_local_payment_requests?select=id,status,amount,currency,payment_reference,review_note,created_at,organization_id,payment_methods(name),organizations(name),pricing_variants(code,level_code,term_months)&order=created_at.desc&limit=100",
      ).catch(() => []),
    ]);
  const methods = (methodRows || []) as PaymentMethod[],
    workspacePayments = (workspaceRows || []) as LegacyPayment[],
    renewals = (renewalRows || []) as LegacyPayment[],
    betaSlots = (slotRows || []) as BetaSlot[],
    v2Payments = (v2Rows || []) as V2Payment[],
    underReview = v2Payments.filter(
      (payment) => payment.status === "under_review",
    ).length,
    approved = v2Payments.filter(
      (payment) => payment.status === "approved",
    ).length,
    rejected = v2Payments.filter(
      (payment) => payment.status === "rejected",
    ).length,
    activatedSlots = betaSlots.filter(
      (slot) => slot.status === "activated",
    ).length;

  return (
    <main className="mx-auto max-w-7xl p-4 py-8 sm:p-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin" className="md-button md-button-secondary md-button-sm">
          العودة إلى لوحة الإدارة
        </Link>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-100">
          MADAR V2.0 Financial Operations
        </span>
      </div>

      <header className="mt-6">
        <p className="font-bold text-emerald-300">الإدارة المالية</p>
        <h1 className="mt-2 text-3xl font-black sm:text-4xl">
          الدفع والاشتراكات
        </h1>
        <p className="mt-3 max-w-3xl leading-8 text-slate-300">
          مركز موحّد لإدارة طرق التحويل ومراجعة مدفوعات باقات مَدار V2.0.
          سجلات V1 محفوظة أدناه للقراءة والتدقيق فقط، ولا تُستخدم لتفعيل أي
          اشتراك جديد.
        </p>
      </header>

      <div className="mt-6">
        <ActionFeedback {...feedback} />
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="بانتظار المراجعة" value={underReview} tone="warning" />
        <Metric label="مدفوعات معتمدة" value={approved} tone="success" />
        <Metric label="مدفوعات مرفوضة" value={rejected} tone="danger" />
        <Metric
          label="طرق دفع مفعّلة"
          value={methods.filter((method) => method.is_active).length}
          tone="neutral"
        />
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">مدفوعات باقات V2</h2>
            <p className="mt-2 text-sm text-slate-400">
              رتبت الطلبات من الأحدث، وتبقى الموافقة الإدارية هي نقطة التفعيل
              الوحيدة.
            </p>
          </div>
          <strong className="text-sm text-amber-100">
            {underReview} طلب يحتاج قرارًا
          </strong>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {v2Payments.length ? (
            v2Payments.map((item) => {
              const organization = one(item.organizations),
                method = one(item.payment_methods),
                variant = one(item.pricing_variants);
              return (
                <article key={item.id} className="md-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <strong className="text-lg">
                        {organization?.name || "مساحة عمل"}
                      </strong>
                      <p className="mt-1 text-xs text-slate-400">
                        {variant?.code || "باقة V2"} · {method?.name || "طريقة دفع"}
                      </p>
                    </div>
                    <div className="text-left">
                      <strong className="block text-emerald-200">
                        {businessMoney(item.amount, item.currency)}
                      </strong>
                      <StatusPill status={item.status} />
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 rounded-2xl bg-white/[.035] p-4 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-slate-500">مرجع التحويل</dt>
                      <dd className="mt-1 font-bold">{item.payment_reference}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">وقت الإرسال</dt>
                      <dd className="mt-1">
                        {new Date(item.created_at).toLocaleString("ar-YE")}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/admin/local-payments/proof/v2/${item.id}`}
                      className="md-button md-button-secondary md-button-sm"
                    >
                      فتح الإثبات
                    </Link>
                    {item.status === "under_review" ? (
                      <form
                        action={reviewV2LocalPayment}
                        className="grid min-w-full flex-1 gap-2 sm:min-w-0 sm:grid-cols-[1fr_auto_auto]"
                      >
                        <input type="hidden" name="request_id" value={item.id} />
                        <input
                          name="note"
                          maxLength={500}
                          className="field min-w-0 rounded-xl px-3 py-2 text-sm"
                          placeholder="ملاحظة القرار"
                        />
                        <button
                          name="decision"
                          value="approve"
                          className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-slate-950"
                        >
                          اعتماد
                        </button>
                        <button
                          name="decision"
                          value="reject"
                          className="rounded-xl bg-red-300 px-4 py-2 text-xs font-black text-slate-950"
                        >
                          رفض
                        </button>
                      </form>
                    ) : null}
                  </div>
                  {item.review_note ? (
                    <p className="mt-3 rounded-xl bg-white/[.035] p-3 text-sm text-slate-300">
                      {item.review_note}
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <EmptyState text="لا توجد مدفوعات V2 حتى الآن." />
          )}
        </div>
      </section>

      <section className="mt-12">
        <div>
          <h2 className="text-2xl font-black">طرق الدفع</h2>
          <p className="mt-2 text-sm text-slate-400">
            لا يمكن تفعيل طريقة دون اسم حساب ومعرّف صالحين. ترتيب العرض محصور
            بين 0 و10000.
          </p>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {methods.map((method) => (
            <form
              action={savePaymentMethod}
              key={method.id}
              className="md-panel grid gap-4"
            >
              <input type="hidden" name="id" value={method.id} />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <strong className="text-xl">{method.name}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {method.code} · {method.method_type}
                  </p>
                </div>
                <StatusPill status={method.is_active ? "active" : "disabled"} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold">
                  اسم الحساب
                  <input
                    name="account_name"
                    maxLength={120}
                    defaultValue={method.account_name || ""}
                    className="field rounded-xl p-3"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  رقم الحساب أو المحفظة
                  <input
                    name="account_identifier"
                    maxLength={160}
                    defaultValue={method.account_identifier || ""}
                    className="field rounded-xl p-3"
                  />
                </label>
              </div>
              <label className="grid gap-2 text-sm font-bold">
                تعليمات التحويل
                <textarea
                  name="instructions"
                  maxLength={1000}
                  defaultValue={method.instructions || ""}
                  rows={3}
                  className="field rounded-xl p-3"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-bold">
                  العملة
                  <select
                    name="currency"
                    defaultValue={method.currency}
                    className="field rounded-xl p-3"
                  >
                    <option value="YER">YER</option>
                    <option value="SAR">SAR</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  ترتيب العرض
                  <input
                    name="sort_order"
                    type="number"
                    min={0}
                    max={10000}
                    defaultValue={method.sort_order}
                    className="field rounded-xl p-3"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  الحالة
                  <select
                    name="is_active"
                    defaultValue={String(method.is_active)}
                    className="field rounded-xl p-3"
                  >
                    <option value="true">مفعّلة</option>
                    <option value="false">معطلة</option>
                  </select>
                </label>
              </div>
              <button className="md-button md-button-primary">حفظ الطريقة</button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">مقاعد مؤسسي Beta</h2>
            <p className="mt-2 text-sm text-slate-400">
              متابعة تشغيلية دون ربطها بمسار تسعير V1.
            </p>
          </div>
          <strong className="text-emerald-200">
            {activatedSlots}/{betaSlots.length || 10} مفعّلة
          </strong>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {betaSlots.map((slot) => (
            <article key={slot.ordinal} className="md-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">المقعد #{slot.ordinal}</p>
                <StatusPill status={slot.status} />
              </div>
              {slot.reserved_until ? (
                <p className="mt-3 text-xs text-amber-200">
                  محجوز حتى {new Date(slot.reserved_until).toLocaleString("ar-YE")}
                </p>
              ) : null}
              {slot.activated_at ? (
                <p className="mt-3 text-xs text-emerald-200">
                  فُعّل {new Date(slot.activated_at).toLocaleDateString("ar-YE")}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <details className="mt-12 rounded-3xl border border-amber-300/15 bg-amber-300/[.035] p-5">
        <summary className="cursor-pointer font-black text-amber-100">
          أرشيف V1 للقراءة فقط ({workspacePayments.length + renewals.length})
        </summary>
        <p className="mt-3 text-sm leading-7 text-amber-50/70">
          هذه السجلات محفوظة لحماية بيانات العملاء والتدقيق التاريخي. أزيلت منها
          إجراءات الاعتماد والتجديد، ولا تمنح أي صلاحية وصول إلى مَدار V2.0.
        </p>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <LegacyList title="دفعات فتح المساحات" items={workspacePayments} />
          <LegacyList title="طلبات التجديد" items={renewals} />
        </div>
      </details>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    success: "text-emerald-200",
    warning: "text-amber-200",
    danger: "text-red-200",
    neutral: "text-slate-100",
  }[tone];
  return (
    <article className="md-card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <strong className={`mt-2 block text-3xl ${toneClass}`}>{value}</strong>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "approved" || status === "active" || status === "activated"
      ? "bg-emerald-300/10 text-emerald-100"
      : status === "under_review" || status === "reserved"
        ? "bg-amber-300/10 text-amber-100"
        : status === "rejected"
          ? "bg-red-300/10 text-red-100"
          : "bg-white/10 text-slate-300";
  return (
    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs ${className}`}>
      {status === "active"
        ? "مفعّلة"
        : status === "disabled"
          ? "معطلة"
          : statusLabels[status] || status}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500 lg:col-span-2">
      {text}
    </p>
  );
}

function LegacyList({
  title,
  items,
}: {
  title: string;
  items: LegacyPayment[];
}) {
  return (
    <article>
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 grid gap-3">
        {items.length ? (
          items.map((item) => {
            const organization = one(item.organizations),
              request = one(item.workspace_requests),
              method = one(item.payment_methods);
            return (
              <div key={item.id} className="rounded-2xl border border-white/10 p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <strong>{organization?.name || request?.name || "سجل قديم"}</strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {method?.name || "طريقة دفع"} · {item.payment_reference}
                    </p>
                  </div>
                  <span>{businessMoney(item.amount, item.currency)}</span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  {statusLabels[item.status] || item.status} ·{" "}
                  {new Date(item.created_at).toLocaleString("ar-YE")}
                </p>
              </div>
            );
          })
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
            لا توجد سجلات.
          </p>
        )}
      </div>
    </article>
  );
}
