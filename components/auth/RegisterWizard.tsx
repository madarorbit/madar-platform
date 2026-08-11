"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/app/actions/auth";
import { Button, Field, Input, Notice, Panel } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";

type State = { error?: string; success?: string };

export default function RegisterWizard() {
  const [state, formAction, pending] = useActionState<State, FormData>(register, {});
  return (
    <Panel className="mx-auto w-full max-w-xl p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-300/15 text-violet-100"><Icon name="user" /></span>
        <div><h2 className="text-2xl font-black">إنشاء حساب مَدار</h2><p className="mt-1 text-sm leading-6 text-slate-400">ننشىء حسابك فقط. ستختار الخدمات وتُعدّ كل واحدة منها لاحقًا من مركز الحساب.</p></div>
      </div>
      <form action={formAction} className="mt-7 grid gap-5">
        <Field label="الاسم الكامل"><Input required minLength={2} maxLength={120} name="full_name" autoComplete="name" /></Field>
        <Field label="البريد الإلكتروني"><Input required name="email" type="email" autoComplete="email" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="كلمة المرور"><Input required minLength={8} name="password" type="password" autoComplete="new-password" /></Field>
          <Field label="تأكيد كلمة المرور"><Input required minLength={8} name="confirm" type="password" autoComplete="new-password" /></Field>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm leading-6 text-slate-300">
          <input required name="terms" type="checkbox" className="mt-1 h-4 w-4 accent-violet-500" />
          <span>أوافق على <Link href="/terms" target="_blank" className="font-bold text-emerald-300 underline">شروط الاستخدام</Link> و<Link href="/privacy" target="_blank" className="font-bold text-emerald-300 underline">سياسة الخصوصية</Link>.</span>
        </label>
        {state.error ? <Notice title="تعذر إنشاء الحساب" variant="danger">{state.error}</Notice> : null}
        <Button disabled={pending} size="lg" type="submit">{pending ? "جارٍ إنشاء الحساب…" : "إنشاء حساب مَدار"}</Button>
        <p className="text-center text-sm text-slate-400">سنرسل رسالة تأكيد إلى بريدك. لا تُنشأ مساحة أو تجربة أو اشتراك تلقائيًا.</p>
      </form>
    </Panel>
  );
}
