import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatDateTime, formatMoney } from "@/src/lib/retail/format";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { upsertCustomerAction } from "@/src/lib/retail/server/retail/actions";
import { getCustomers } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "العملاء" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const customers = await getCustomers(workspace.id);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="العملاء" title="العملاء والأرصدة" description="الرصيد مستمد من سجل الذمم والتحصيلات، وليس رقمًا قابلًا للتحرير." />
    <section className={`grid gap-4 ${role !== "VIEWER" ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <div className="table-wrap"><table className="data-table" data-mobile="list"><thead><tr><th>العميل</th><th>الهاتف</th><th>إجمالي المبيعات</th><th>المستحق</th><th>آخر تعامل</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td data-label="العميل"><strong>{customer.name}</strong></td><td data-label="الهاتف" dir="ltr">{customer.phone ?? "—"}</td><td data-label="إجمالي المبيعات">{formatMoney(customer.total_sales, workspace.currency)}</td><td data-label="المستحق" className={Number(customer.balance_due) > 0 ? "text-amber-200" : ""}>{formatMoney(customer.balance_due, workspace.currency)}</td><td data-label="آخر تعامل">{formatDateTime(customer.last_transaction_at)}</td></tr>)}</tbody></table>{!customers.length ? <p className="muted p-8 text-center">لا يوجد عملاء بعد. العميل اختياري للبيع النقدي.</p> : null}</div>
      {role !== "VIEWER" ? <form action={upsertCustomerAction} className="surface grid content-start gap-4 p-5"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><h2 className="text-lg font-black">عميل جديد</h2><label className="field"><span>الاسم *</span><input className="input" name="name" required /></label><label className="field"><span>الهاتف</span><input className="input" name="phone" inputMode="tel" /></label><label className="field"><span>ملاحظات</span><textarea className="input" name="notes" /></label><SubmitButton>حفظ العميل</SubmitButton></form> : null}
    </section></div>;
}
