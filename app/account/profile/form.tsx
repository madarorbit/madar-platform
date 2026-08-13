"use client";

import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { removeProfileAvatar, updateProfile } from "@/app/actions/auth";
import { Avatar, Button, Field, Input, Notice } from "@/components/ui/Enterprise";

type ActionState = { success?: string; error?: string };

export default function ProfileForm({ fullName, phone, hasAvatar }: { fullName: string; phone: string; hasAvatar: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfile, {});
  const [removeState, removeAction, removing] = useActionState<ActionState, FormData>(removeProfileAvatar, {});
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return <section className="md-account-section md-profile-editor">
    <div className="md-profile-avatar-row">
      <div className="md-profile-avatar-preview">
        {preview ? <span className="md-avatar md-avatar-lg"><Image src={preview} alt="معاينة صورة الحساب الجديدة" fill sizes="64px" unoptimized /></span> : <Avatar src={hasAvatar ? "/account/avatar" : null} alt="صورة حسابك" size="lg" />}
      </div>
      <div className="min-w-0 flex-1"><h2>صورة الحساب</h2><p className="md-type-body-sm md-muted">JPEG أو PNG أو WebP، حتى 5MB. تظهر الصورة نفسها في الشريط العلوي وكل طبقات مَدار.</p></div>
      {hasAvatar ? <form action={removeAction}><Button type="submit" variant="ghost" size="sm" loading={removing}>إزالة الصورة</Button></form> : null}
    </div>
    {removeState.error ? <Notice title={removeState.error} variant="danger" /> : removeState.success ? <Notice title={removeState.success} variant="success" /> : null}

    <form action={action} encType="multipart/form-data" className="md-profile-form">
      <Field label="استبدال صورة الحساب" help="اترك الحقل فارغًا للإبقاء على الصورة الحالية.">
        <Input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          setPreview((current) => { if (current) URL.revokeObjectURL(current); return file ? URL.createObjectURL(file) : null; });
        }} />
      </Field>
      <div className="md-profile-fields">
        <Field label="الاسم الكامل"><Input required minLength={2} maxLength={120} name="full_name" defaultValue={fullName} autoComplete="name" /></Field>
        <Field label="رقم الهاتف" help="اختياري، ويُستخدم للتواصل المرتبط بالخدمات فقط."><Input name="phone" defaultValue={phone} autoComplete="tel" dir="ltr" /></Field>
      </div>
      {state.error ? <Notice title={state.error} variant="danger" /> : state.success ? <Notice title={state.success} variant="success" /> : null}
      <div className="md-form-actions"><Button type="submit" loading={pending}>حفظ التغييرات</Button></div>
    </form>
  </section>;
}
