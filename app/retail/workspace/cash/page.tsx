import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatDateTime, formatMoney } from "@/src/lib/retail/format";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { adjustCashAction } from "@/src/lib/retail/server/retail/actions";
import { getCashTransactions } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "الصندوق" };

export default async function CashPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const { account, transactions } = await getCashTransactions(workspace.id);
  const canAdjust = role === "OWNER" || role === "MANAGER";
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="CASH LEDGER" title="الصندوق" description="هذا الرصيد نقدي فقط؛ لا يساوي الإيراد ولا يشمل الذمم أو حسابات البنك والمحافظ." action={<div className="surface-soft px-5 py-3"><span className="muted text-xs">الرصيد الحالي</span><strong className="mr-3 text-xl">{formatMoney(account?.current_balance, workspace.currency)}</strong></div>} />
    <section className={`grid gap-4 ${canAdjust ? "xl:grid-cols-[minmax(0,1fr)_370px]" : ""}`}>
      <div className="table-wrap"><table className="data-table" data-mobile="list"><thead><tr><th>الوقت</th><th>النوع</th><th>الاتجاه</th><th>المبلغ</th><th>الرصيد بعد الحركة</th><th>ملاحظات</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td data-label="الوقت">{formatDateTime(transaction.occurred_at)}</td><td data-label="النوع">{transaction.transaction_type}</td><td data-label="الاتجاه"><span className={transaction.direction === "IN" ? "status-pill" : "status-pill status-danger"}>{transaction.direction === "IN" ? "داخل" : "خارج"}</span></td><td data-label="المبلغ">{formatMoney(transaction.amount, workspace.currency)}</td><td data-label="الرصيد بعدها">{formatMoney(transaction.balance_after, workspace.currency)}</td><td data-label="ملاحظات">{transaction.notes ?? "—"}</td></tr>)}</tbody></table>{!transactions.length ? <p className="muted p-8 text-center">ابدأ برصيد افتتاحي أو نفّذ بيعًا نقديًا.</p> : null}</div>
      {canAdjust ? <form action={adjustCashAction} className="surface grid content-start gap-4 p-5"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><h2 className="text-lg font-black">قيد صندوق يدوي</h2><label className="field"><span>النوع</span><select className="input" name="transaction_type"><option value="OPENING">رصيد افتتاحي (مرة واحدة)</option><option value="MANUAL_ADJUSTMENT">تسوية يدوية</option></select></label><label className="field"><span>المبلغ (+ داخل / - خارج)</span><input className="input" type="number" name="amount_delta" step="0.01" required /></label><label className="field"><span>السبب *</span><textarea className="input" name="notes" minLength={3} required /></label><SubmitButton>حفظ القيد</SubmitButton></form> : null}
    </section></div>;
}
