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
      <div className="md-auth-heading">
        <span className="md-feature-icon is-purple"><Icon name="user" /></span>
        <div><h2 className="md-type-h2">إنشاء حساب مَدار</h2><p className="md-type-body-sm md-muted mt-1">ننشىء حسابك فقط. ستختار الخدمات وتُعدّ كل واحدة منها لاحقًا من مركز الحساب.</p></div>
      </div>
      <form action={formAction} className="mt-7 grid gap-5">
        <Field label="الاسم الكامل"><Input required minLength={2} maxLength={120} name="full_name" autoComplete="name" /></Field>
        <Field label="البريد الإلكتروني"><Input required name="email" type="email" autoComplete="email" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="كلمة المرور"><Input required minLength={8} name="password" type="password" autoComplete="new-password" /></Field>
          <Field label="تأكيد كلمة المرور"><Input required minLength={8} name="confirm" type="password" autoComplete="new-password" /></Field>
        </div>
        <label className="md-terms-control">
          <input required name="terms" type="checkbox" />
          <span>أوافق على <Link href="/terms" target="_blank">شروط الاستخدام</Link> و<Link href="/privacy" target="_blank">سياسة الخصوصية</Link>.</span>
        </label>
        {state.error ? <Notice title="تعذر إنشاء الحساب" variant="danger">{state.error}</Notice> : null}
        <Button loading={pending} size="lg" type="submit">إنشاء حساب مَدار</Button>
        <p className="md-type-body-sm md-muted text-center">سنرسل رسالة تأكيد إلى بريدك. لا تُنشأ مساحة أو تجربة أو اشتراك تلقائيًا.</p>
      </form>
    </Panel>
  );
}
