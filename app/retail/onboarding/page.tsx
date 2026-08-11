import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brand } from "@/components/retail-v0/layout/brand";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatMoney } from "@/src/lib/retail/format";
import { createClient } from "@/src/lib/retail/supabase/server";
import { requireUser } from "@/src/lib/retail/server/auth/context";
import {
  completeOnboardingAction, savePlanAction, saveRetailTypeAction,
  saveTradeDetailsAction, saveTradeSettingsAction,
} from "./actions";

export const metadata: Metadata = { title: "إعداد تجارتك" };

const SUBTYPES = [
  ["GENERAL_RETAIL", "تجارة عامة بالتجزئة"], ["GROCERY", "بقالة"],
  ["CLOTHING", "ملابس"], ["PERFUME", "عطور"], ["ELECTRONICS", "إلكترونيات"],
  ["ACCESSORIES", "إكسسوارات"], ["SPARE_PARTS", "قطع غيار"], ["OTHER", "أخرى"],
] as const;

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string; error?: string; success?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  const [workspaceResult, draftResult, plansResult] = await Promise.all([
    supabase.from("retail_workspaces").select("id").eq("platform_organization_id", user.platformOrganizationId).maybeSingle(),
    supabase.from("onboarding_drafts").select("*").eq("user_id", user.id).eq("platform_organization_id", user.platformOrganizationId).maybeSingle(),
    supabase.from("plans").select("id,name_ar,description_ar,price_amount,currency,trial_days,features").eq("status", "active").eq("is_public", true).order("created_at"),
  ]);
  if (workspaceResult.data?.id) redirect("/retail/workspace");
  if (user.platformMembershipRole === "MEMBER") {
    return (
      <main className="container-shell grid min-h-[70vh] place-items-center py-10">
        <section className="surface max-w-xl p-7 text-center">
          <Brand />
          <h1 className="mt-7 text-2xl font-black">إنشاء Retail يحتاج صلاحية إدارة</h1>
          <p className="muted mt-3 leading-7">
            يمكن لمالك مساحة مَدار أو مديرها إنشاء Retail أول مرة. بعد الإنشاء ستصل إليه بصلاحية العضو الحالية تلقائيًا.
          </p>
          <a className="button-secondary mt-6" href="/workspace">العودة إلى منصة مَدار</a>
        </section>
      </main>
    );
  }
  const draft = draftResult.data;
  const requestedStep = Number(params.step ?? draft?.current_step ?? 1);
  const step = Math.min(5, Math.max(1, Number.isFinite(requestedStep) ? requestedStep : 1));

  return (
    <main className="container-shell py-7 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><Brand /><span className="status-pill">الخطوة {step} من 5</span></div>
        <div className="mb-6 grid grid-cols-5 gap-2" aria-label={`التقدم: ${step} من 5`}>
          {[1, 2, 3, 4, 5].map((value) => <div key={value} className={`h-1.5 rounded-full ${value <= step ? "bg-emerald-300" : "bg-slate-800"}`} />)}
        </div>
        <section className="surface p-5 sm:p-8">
          <FlashMessage error={params.error} success={params.success} />

          {step === 1 ? (
            <form action={saveTradeDetailsAction} className="mt-4 grid gap-5" encType="multipart/form-data">
              <div><p className="eyebrow">بيانات التجارة</p><h1 className="mt-2 text-3xl font-black">عرّفنا بمتجرك</h1><p className="muted mt-2">يمكنك تعديل هذه البيانات لاحقًا.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field sm:col-span-2"><span>اسم التجارة *</span><input className="input" name="trade_name" defaultValue={draft?.trade_name ?? ""} minLength={2} required autoFocus /></label>
                <label className="field"><span>اسم المالك</span><input className="input" name="owner_name" defaultValue={draft?.owner_name ?? user.fullName ?? ""} /></label>
                <label className="field"><span>الهاتف</span><input className="input" name="phone" inputMode="tel" defaultValue={draft?.phone ?? ""} /></label>
                <label className="field"><span>المدينة</span><input className="input" name="city" defaultValue={draft?.city ?? ""} /></label>
                <label className="field"><span>الدولة</span><select className="input" name="country" defaultValue={draft?.country ?? "YE"}><option value="YE">اليمن</option></select></label>
                <label className="field"><span>العملة</span><select className="input" name="currency" defaultValue={draft?.currency ?? "YER"}><option value="YER">YER — ريال يمني</option></select></label>
                <label className="field sm:col-span-2"><span>الشعار (اختياري)</span><input className="input" type="file" name="logo" accept="image/jpeg,image/png,image/webp" /><small className="muted">JPG أو PNG أو WebP، حتى 5MB. يتم التحقق من محتوى الملف وليس امتداده فقط.</small></label>
              </div>
              <SubmitButton>التالي: نوع النشاط</SubmitButton>
            </form>
          ) : null}

          {step === 2 ? (
            <form action={saveRetailTypeAction} className="mt-4 grid gap-5">
              <div><p className="eyebrow">RETAIL ONLY</p><h1 className="mt-2 text-3xl font-black">ما أقرب نوع لمتجرك؟</h1><p className="muted mt-2">كل الخيارات تبقى تحت نموذج تجارة التجزئة نفسه.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUBTYPES.map(([value, label]) => <label key={value} className="surface-soft flex cursor-pointer items-center gap-3 p-4"><input type="radio" name="subtype" value={value} defaultChecked={(draft?.subtype ?? "GENERAL_RETAIL") === value} required /><span className="font-bold">{label}</span></label>)}
              </div>
              <div className="flex gap-3"><a className="button-secondary" href="/retail/onboarding?step=1">السابق</a><SubmitButton>التالي: إعداد التجارة</SubmitButton></div>
            </form>
          ) : null}

          {step === 3 ? (
            <form action={saveTradeSettingsAction} className="mt-4 grid gap-5">
              <div><p className="eyebrow">إعداد التجارة</p><h1 className="mt-2 text-3xl font-black">إعدادات قليلة وواضحة</h1></div>
              <label className="field"><span>عرض الأسعار</span><select className="input" name="price_display" defaultValue={draft?.price_display ?? "simple"}><option value="simple">سعر بسيط</option><option value="tax_inclusive">سعر شامل الضريبة مستقبلًا</option></select></label>
              <label className="field"><span>بادئة أرقام الفواتير</span><input className="input" name="invoice_prefix" defaultValue={draft?.invoice_prefix ?? "MR"} maxLength={8} dir="ltr" required /></label>
              <label className="surface-soft flex items-center gap-3 p-4"><input type="checkbox" name="allow_credit_sales" defaultChecked={draft?.allow_credit_sales ?? true} /><span><strong className="block">السماح بالبيع الآجل</strong><small className="muted">يتطلب اختيار عميل، وينشئ رصيدًا في سجل ديونه.</small></span></label>
              <div className="surface-soft p-4"><strong>سياسة المخزون</strong><p className="muted mt-1 text-sm">منع الرصيد السالب. كل تغيير يحتاج حركة وسببًا.</p></div>
              <div className="flex gap-3"><a className="button-secondary" href="/retail/onboarding?step=2">السابق</a><SubmitButton>التالي: الاشتراك</SubmitButton></div>
            </form>
          ) : null}

          {step === 4 ? (
            <form action={savePlanAction} className="mt-4 grid gap-5">
              <div><p className="eyebrow">الاشتراك</p><h1 className="mt-2 text-3xl font-black">اختر خطة متاحة</h1><p className="muted mt-2">الخطط والأسعار تأتي من الإدارة وليست أرقامًا مضمّنة في الواجهة.</p></div>
              <div className="grid gap-3">
                {(plansResult.data ?? []).map((plan) => <label className="surface-soft flex cursor-pointer items-start gap-3 p-5" key={plan.id}><input className="mt-1" type="radio" name="plan_id" value={plan.id} defaultChecked={(draft?.selected_plan_id ?? plansResult.data?.[0]?.id) === plan.id} required /><span><strong className="text-lg">{plan.name_ar}</strong><span className="text-mint mt-1 block font-black">{plan.price_amount == null ? "تجربة دون سعر نهائي معتمد" : formatMoney(plan.price_amount, plan.currency)}</span><small className="muted mt-1 block">{plan.description_ar} {plan.trial_days > 0 ? `— ${plan.trial_days} يومًا تجريبيًا` : ""}</small></span></label>)}
              </div>
              <div className="flex gap-3"><a className="button-secondary" href="/retail/onboarding?step=3">السابق</a><SubmitButton>التالي: المراجعة</SubmitButton></div>
            </form>
          ) : null}

          {step === 5 ? (
            <form action={completeOnboardingAction} className="mt-4 grid gap-5">
              <input type="hidden" name="operation_id" value={crypto.randomUUID()} />
              <div><p className="eyebrow">إنشاء مساحة التجارة</p><h1 className="mt-2 text-3xl font-black">كل شيء جاهز</h1><p className="muted mt-2">سيتم إنشاء المساحة والصندوق والاشتراك والعضوية كعملية واحدة.</p></div>
              <div className="surface-soft grid gap-3 p-5 text-sm">
                <p><span className="muted">التجارة:</span> <strong>{draft?.trade_name}</strong></p>
                <p><span className="muted">النموذج:</span> <strong>RETAIL</strong></p>
                <p><span className="muted">العملة:</span> <strong>{draft?.currency}</strong></p>
                <p><span className="muted">البيع الآجل:</span> <strong>{draft?.allow_credit_sales ? "مسموح مع عميل" : "غير مسموح"}</strong></p>
              </div>
              <div className="flex gap-3"><a className="button-secondary" href="/retail/onboarding?step=4">السابق</a><SubmitButton pendingLabel="جارٍ إنشاء المساحة…">إنشاء مساحة التجارة</SubmitButton></div>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
