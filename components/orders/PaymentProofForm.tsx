"use client";

import { useActionState } from "react";
import { submitPaymentProof, type OrderState } from "@/app/actions/orders";
import { Button, Field, Input, Notice } from "@/components/ui/Enterprise";

const initial: OrderState = {};

export default function PaymentProofForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState<OrderState, FormData>(submitPaymentProof, initial);
  return <form action={action} className="md-account-section md-account-form-stack">
    <input type="hidden" name="order_id" value={orderId} />
    <div><span className="md-eyebrow">متابعة الدفع</span><h2>إرسال بيانات التحويل</h2></div>
    <Field label="رقم العملية" help="إلزامي، من 3 إلى 120 حرفًا."><Input required name="payment_reference" minLength={3} maxLength={120} dir="ltr" /></Field>
    <Field label="صورة أو PDF للإثبات" help="اختياري حتى الحد المعتمد. يبقى المرفق خاصًا بالمراجعة."><Input name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></Field>
    {state.error ? <Notice title={state.error} variant="danger" /> : state.success ? <Notice title={state.success} variant="success" /> : null}
    <Button type="submit" loading={pending} className="w-full">إرسال للمراجعة</Button>
  </form>;
}
