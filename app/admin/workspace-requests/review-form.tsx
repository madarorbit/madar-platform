"use client";

import { useActionState } from "react";
import { reviewServiceRequest, type ServiceActionState } from "@/app/actions/services";

export default function ReviewForm({ id, retry = false }: { id: string; retry?: boolean }) {
  const [state, action, pending] = useActionState<ServiceActionState, FormData>(reviewServiceRequest, {});
  return (
    <form action={action} className="mt-5 grid gap-3">
      <input type="hidden" name="request_id" value={id} />
      <textarea name="reason" maxLength={500} className="field w-full rounded-xl p-3" placeholder="سبب الرفض أو ملاحظة القرار" />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="approve" disabled={pending} className="rounded-xl bg-emerald-300 px-4 py-2 font-black text-slate-950">
          {retry ? "إعادة محاولة تجهيز Retail" : "اعتماد وتفعيل الخدمة"}
        </button>
        {!retry ? <button name="decision" value="reject" disabled={pending} className="rounded-xl bg-red-300/15 px-4 py-2 font-bold text-red-100">رفض</button> : null}
      </div>
      {state.error ? <p className="text-sm font-bold text-red-200">{state.error}</p> : null}
      {state.success ? <p className="text-sm font-bold text-emerald-200">{state.success}</p> : null}
    </form>
  );
}
