import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatMoney } from "@/src/lib/retail/format";
import { localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { createExpenseAction } from "@/src/lib/retail/server/retail/actions";
import { getRecentExpenses } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "المصروفات" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const expenses = await getRecentExpenses(workspace.id);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="التشغيل" title="المصروفات" description="المصروف النقدي يخفض الصندوق فورًا، وكل المصروفات تدخل في الربح التشغيلي التقديري." />
    <section className={`grid gap-4 ${role !== "VIEWER" ? "xl:grid-cols-[minmax(0,1fr)_370px]" : ""}`}>
      <div className="table-wrap"><table className="data-table" data-mobile="list"><thead><tr><th>التاريخ</th><th>الفئة</th><th>الوصف</th><th>الطريقة</th><th>المبلغ</th></tr></thead><tbody>{expenses.map((expense) => <tr key={expense.id}><td data-label="التاريخ">{expense.expense_date}</td><td data-label="الفئة">{expense.category}</td><td data-label="الوصف">{expense.description}</td><td data-label="وسيلة الدفع">{expense.payment_method}</td><td data-label="المبلغ">{formatMoney(expense.amount, workspace.currency)}</td></tr>)}</tbody></table>{!expenses.length ? <p className="muted p-8 text-center">لا توجد مصروفات مسجلة.</p> : null}</div>
      {role !== "VIEWER" ? <form action={createExpenseAction} className="surface grid content-start gap-4 p-5"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><h2 className="text-lg font-black">مصروف جديد</h2><label className="field"><span>الفئة</span><input className="input" name="category" placeholder="إيجار، نقل، كهرباء…" required /></label><label className="field"><span>المبلغ</span><input className="input" type="number" name="amount" min="0.01" step="0.01" required /></label><label className="field"><span>التاريخ</span><input className="input" type="date" name="expense_date" defaultValue={localDate(workspace.timezone)} required /></label><label className="field"><span>وسيلة الدفع</span><select className="input" name="payment_method"><option value="CASH">نقدًا</option><option value="BANK">حساب بنكي</option><option value="WALLET">محفظة</option><option value="OTHER">أخرى</option></select></label><label className="field"><span>الوصف</span><textarea className="input" name="description" required /></label><SubmitButton>تسجيل المصروف</SubmitButton></form> : null}
    </section></div>;
}
