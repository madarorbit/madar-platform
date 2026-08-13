import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatMoney } from "@/src/lib/retail/format";
import { relationName, relationValue } from "@/src/lib/retail/relations";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { collectReceivableAction, payPayableAction } from "@/src/lib/retail/server/retail/actions";
import { getOpenDebts } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "الديون والتحصيل" };

export default async function DebtsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const { receivables, payables } = await getOpenDebts(workspace.id);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="DEBT LEDGER" title="الديون والتحصيل" description="التسوية الجزئية تنقص القيد المفتوح وتضيف حركة مستقلة؛ الرصيد لا يُكتب فوقه." />
    <section className="grid gap-4 xl:grid-cols-2">
      <article className="surface p-5"><h2 className="text-lg font-black">لنا عند العملاء</h2><div className="mt-4 grid gap-3">{receivables.map((debt) => <div className="surface-soft p-4" key={debt.id}><div className="flex items-start justify-between gap-3"><div><strong>{relationName(debt.customers)}</strong><p className="muted text-xs">فاتورة {relationValue(debt.sales, "invoice_number")}</p></div><strong className="text-amber-200">{formatMoney(debt.balance_due, workspace.currency)}</strong></div>{role !== "VIEWER" ? <form action={collectReceivableAction} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><input type="hidden" name="ledger_id" value={debt.id} /><input className="input" type="number" name="amount" min="0.01" max={Number(debt.balance_due)} step="0.01" placeholder="المبلغ" required /><select className="input" name="payment_method"><option value="CASH">نقدًا</option><option value="BANK">بنك</option><option value="WALLET">محفظة</option><option value="OTHER">أخرى</option></select><SubmitButton className="button-primary col-span-2 sm:col-span-1">تحصيل</SubmitButton></form> : null}</div>)}{!receivables.length ? <p className="muted py-8 text-center">لا توجد ديون عملاء مفتوحة.</p> : null}</div></article>
      <article className="surface p-5"><h2 className="text-lg font-black">علينا للموردين</h2><div className="mt-4 grid gap-3">{payables.map((debt) => <div className="surface-soft p-4" key={debt.id}><div className="flex items-start justify-between gap-3"><div><strong>{relationName(debt.suppliers)}</strong><p className="muted text-xs">شراء {relationValue(debt.purchases, "purchase_number")}</p></div><strong className="text-amber-200">{formatMoney(debt.balance_due, workspace.currency)}</strong></div>{role !== "VIEWER" ? <form action={payPayableAction} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><input type="hidden" name="ledger_id" value={debt.id} /><input className="input" type="number" name="amount" min="0.01" max={Number(debt.balance_due)} step="0.01" placeholder="المبلغ" required /><select className="input" name="payment_method"><option value="CASH">نقدًا</option><option value="BANK">بنك</option><option value="WALLET">محفظة</option><option value="OTHER">أخرى</option></select><SubmitButton className="button-primary col-span-2 sm:col-span-1">دفع</SubmitButton></form> : null}</div>)}{!payables.length ? <p className="muted py-8 text-center">لا توجد مستحقات موردين مفتوحة.</p> : null}</div></article>
    </section></div>;
}
