"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { register } from "@/app/actions/auth";
import {
  Button,
  Field,
  Input,
  Notice,
  Panel,
} from "@/components/ui/Enterprise";
import {
  accountTypeLabels,
  operatingModeLabels,
  planLevelLabels,
  type AccountType,
  type OperatingMode,
  type PlanLevel,
  type PlanTerm,
  type SupportedCurrency,
} from "@/src/lib/v2/account";
import { quotePrice } from "@/src/lib/v2/pricing";
import { LAUNCH_SPECIALIZATIONS } from "@/src/lib/v2/verticals";

type State = { error?: string; success?: string };
const steps = [
  "بيانات الحساب",
  "نوع الحساب",
  "النشاط والتشغيل",
  "الباقة",
  "المراجعة",
];
const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export default function RegisterWizard({
  specializations = LAUNCH_SPECIALIZATIONS.map((item) => ({
    code: item.code,
    nameAr: item.nameAr,
  })),
}: {
  specializations?: Array<{ code: string; nameAr: string }>;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    register,
    {},
  );
  const [step, setStep] = useState(0),
    [accountType, setAccountType] = useState<AccountType>("PERSONAL"),
    [mode, setMode] = useState<OperatingMode>("MADAR_NATIVE"),
    [level, setLevel] = useState<PlanLevel>("BASIC"),
    [term, setTerm] = useState<PlanTerm>(1),
    [currency, setCurrency] = useState<SupportedCurrency>("SAR"),
    [businessName, setBusinessName] = useState(""),
    [slug, setSlug] = useState("");
  const effectiveStep = accountType === "PERSONAL" && step > 1 ? 4 : step;
  const quote = useMemo(
    () => quotePrice(level, term, mode, currency),
    [level, term, mode, currency],
  );
  const advance = (event: React.MouseEvent<HTMLButtonElement>) => {
    const form = event.currentTarget.form;
    if (!form) return;
    const visible = form.querySelector(`[data-step="${effectiveStep}"]`),
      fields = visible?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "input,select",
      );
    if (fields && ![...fields].every((field) => field.reportValidity())) return;
    setStep(
      accountType === "PERSONAL" && effectiveStep === 1
        ? 4
        : Math.min(4, effectiveStep + 1),
    );
  };
  const back = () =>
    setStep(
      accountType === "PERSONAL" && effectiveStep === 4
        ? 1
        : Math.max(0, effectiveStep - 1),
    );
  return (
    <Panel className="mx-auto max-w-3xl">
      <div
        className="mb-6 grid grid-cols-5 gap-2"
        aria-label="تقدم إنشاء الحساب"
      >
        {steps.map((label, index) => (
          <div
            key={label}
            className={`rounded-lg px-2 py-2 text-center text-[11px] ${index <= effectiveStep ? "bg-violet-400/15 text-violet-100" : "bg-white/[.03] text-slate-500"}`}
          >
            <span className="block font-black">{index + 1}</span>
            <span className="hidden sm:block">{label}</span>
          </div>
        ))}
      </div>
      <form action={formAction} className="grid gap-5" noValidate>
        <section
          data-step="0"
          hidden={effectiveStep !== 0}
          className="grid gap-4"
        >
          <h2 className="text-2xl font-black">بيانات الدخول</h2>
          <Field label="الاسم الكامل">
            <Input
              required
              minLength={2}
              name="full_name"
              autoComplete="name"
            />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input required name="email" type="email" autoComplete="email" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="كلمة المرور">
              <Input
                required
                minLength={8}
                name="password"
                type="password"
                autoComplete="new-password"
              />
            </Field>
            <Field label="تأكيد كلمة المرور">
              <Input
                required
                minLength={8}
                name="confirm"
                type="password"
                autoComplete="new-password"
              />
            </Field>
          </div>
        </section>
        <section
          data-step="1"
          hidden={effectiveStep !== 1}
          className="grid gap-4"
        >
          <h2 className="text-2xl font-black">كيف ستستخدم مَدار؟</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["PERSONAL", "BUSINESS"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-2xl border p-5 ${accountType === value ? "border-violet-300/50 bg-violet-300/10" : "border-white/10 bg-white/[.025]"}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="account_type"
                  value={value}
                  checked={accountType === value}
                  onChange={() => setAccountType(value)}
                />
                <strong>{accountTypeLabels[value]}</strong>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  {value === "PERSONAL"
                    ? "مساحة الطالب وأوربي الشخصي، دون أدوات الأعمال."
                    : "مساحة عمل تجارية فقط، مهيأة حسب النشاط وطريقة التشغيل."}
                </p>
              </label>
            ))}
          </div>
        </section>
        <section
          data-step="2"
          hidden={effectiveStep !== 2}
          className="grid gap-4"
        >
          <h2 className="text-2xl font-black">نوع النشاط وطريقة التشغيل</h2>
          <Field label="اسم النشاط">
            <Input
              required={accountType === "BUSINESS"}
              minLength={2}
              maxLength={120}
              name="business_name"
              value={businessName}
              onChange={(event) => {
                const value = event.target.value;
                setBusinessName(value);
                setSlug((current) =>
                  current && current !== slugify(businessName)
                    ? current
                    : slugify(value),
                );
              }}
            />
          </Field>
          <Field label="الرابط المختصر">
            <Input
              required={accountType === "BUSINESS"}
              minLength={3}
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              name="business_slug"
              dir="ltr"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
            />
          </Field>
          <Field label="نوع النشاط">
            <select
              required={accountType === "BUSINESS"}
              name="activity_specialization_code"
              defaultValue={specializations[0]?.code}
              className="field w-full rounded-xl p-3"
            >
              {specializations.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.nameAr}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["MADAR_NATIVE", "CONNECTED_EXTERNAL"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-2xl border p-4 ${mode === value ? "border-emerald-300/50 bg-emerald-300/10" : "border-white/10"}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="operating_mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <strong>{operatingModeLabels[value]}</strong>
                <p className="mt-2 text-xs leading-6 text-slate-400">
                  {value === "MADAR_NATIVE"
                    ? "مَدار هو مصدر الحقيقة ويشغّل النشاط بالكامل."
                    : "نظامك القائم هو مصدر الحقيقة، ومَدار يقرأ ويكتب فقط وفق موافقاتك."}
                </p>
              </label>
            ))}
          </div>
        </section>
        <section
          data-step="3"
          hidden={effectiveStep !== 3}
          className="grid gap-5"
        >
          <h2 className="text-2xl font-black">اختر الباقة والمدة</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["BASIC", "PREMIUM", "FULL"] as const).map((value) => (
              <label
                key={value}
                className={`cursor-pointer rounded-2xl border p-4 ${level === value ? "border-violet-300/50 bg-violet-300/10" : "border-white/10"}`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="plan_level"
                  value={value}
                  checked={level === value}
                  onChange={() => setLevel(value)}
                />
                <strong>{planLevelLabels[value]}</strong>
                <span className="mt-2 block text-sm text-slate-400">
                  من{" "}
                  {quotePrice(value, 1, mode, currency).amount.toLocaleString(
                    "ar-SA",
                  )}{" "}
                  {currency} شهريًا
                </span>
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="مدة الاشتراك">
              <select
                name="term_months"
                value={term}
                onChange={(event) =>
                  setTerm(Number(event.target.value) as PlanTerm)
                }
                className="field w-full rounded-xl p-3"
              >
                <option value={1}>شهر واحد</option>
                <option value={6}>6 أشهر — خصم 10%</option>
                <option value={12}>12 شهرًا — خصم 20%</option>
              </select>
            </Field>
            <Field label="عملة الدفع">
              <select
                name="currency"
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value as SupportedCurrency)
                }
                className="field w-full rounded-xl p-3"
              >
                <option value="SAR">ريال سعودي SAR</option>
                <option value="USD">دولار أمريكي USD</option>
                <option value="YER">ريال يمني YER</option>
              </select>
            </Field>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/5 p-5">
            <p className="text-sm text-slate-400">
              الإجمالي بعد الخصم
              {mode === "CONNECTED_EXTERNAL" ? " وزيادة الربط 20%" : ""}
            </p>
            <strong className="mt-2 block text-3xl text-emerald-200">
              {quote.amount.toLocaleString("ar-SA")} {quote.currency}
            </strong>
            <p className="mt-2 text-xs leading-6 text-amber-100">
              {quote.launchNotice}
            </p>
          </div>
        </section>
        <section
          data-step="4"
          hidden={effectiveStep !== 4}
          className="grid gap-4"
        >
          <h2 className="text-2xl font-black">راجع الاختيار وأنشئ الحساب</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-sm leading-8">
            <p>
              <b>نوع الحساب:</b> {accountTypeLabels[accountType]}
            </p>
            {accountType === "BUSINESS" ? (
              <>
                <p>
                  <b>النشاط:</b> {businessName}
                </p>
                <p>
                  <b>طريقة التشغيل:</b> {operatingModeLabels[mode]}
                </p>
                <p>
                  <b>الباقة:</b> {planLevelLabels[level]} لمدة {term} شهر
                </p>
                <p>
                  <b>السعر:</b> {quote.amount.toLocaleString("ar-SA")}{" "}
                  {currency}
                </p>
                <p className="text-emerald-200">
                  <b>التجربة المجانية:</b> 20 يومًا
                </p>
              </>
            ) : (
              <p className="text-emerald-200">
                ستفتح لك مساحة الطالب مباشرة، ولن تظهر أدوات الأعمال.
              </p>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3 text-sm leading-6 text-slate-300">
            <input
              required
              name="terms"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-violet-500"
            />
            <span>
              أوافق على{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-bold text-emerald-300 underline"
              >
                شروط الاستخدام
              </Link>{" "}
              و
              <Link
                href="/privacy"
                target="_blank"
                className="font-bold text-emerald-300 underline"
              >
                سياسة الخصوصية
              </Link>
              .
            </span>
          </label>
        </section>
        {state.error && (
          <Notice title="تعذر إنشاء الحساب" variant="danger">
            {state.error}
          </Notice>
        )}
        <div className="flex flex-wrap justify-between gap-3">
          {effectiveStep > 0 ? (
            <Button type="button" variant="secondary" onClick={back}>
              السابق
            </Button>
          ) : (
            <span />
          )}
          {effectiveStep < 4 ? (
            <Button type="button" onClick={advance}>
              التالي
            </Button>
          ) : (
            <Button disabled={pending} type="submit">
              {pending ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب وبدء التجربة"}
            </Button>
          )}
        </div>
      </form>
    </Panel>
  );
}
