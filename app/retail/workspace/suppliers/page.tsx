import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatDateTime, formatMoney } from "@/src/lib/retail/format";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { upsertSupplierAction } from "@/src/lib/retail/server/retail/actions";
import { getSuppliers } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "الموردون" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const suppliers = await getSuppliers(workspace.id);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="الموردون" title="الموردون والمستحقات" description="كل رصيد مرتبط بعملية شراء ودفعات مسجلة." />
    <section className={`grid gap-4 ${role !== "VIEWER" ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <div className="table-wrap"><table className="data-table" data-mobile="list"><thead><tr><th>المورد</th><th>الهاتف</th><th>إجمالي المشتريات</th><th>المستحق</th><th>آخر تعامل</th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td data-label="المورد"><strong>{supplier.name}</strong></td><td data-label="الهاتف" dir="ltr">{supplier.phone ?? "—"}</td><td data-label="إجمالي المشتريات">{formatMoney(supplier.total_purchases, workspace.currency)}</td><td data-label="المستحق" className={Number(supplier.balance_due) > 0 ? "text-amber-200" : ""}>{formatMoney(supplier.balance_due, workspace.currency)}</td><td data-label="آخر تعامل">{formatDateTime(supplier.last_transaction_at)}</td></tr>)}</tbody></table>{!suppliers.length ? <p className="muted p-8 text-center">أضف موردًا عند أول شراء آجل.</p> : null}</div>
      {role !== "VIEWER" ? <form action={upsertSupplierAction} className="surface grid content-start gap-4 p-5"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><h2 className="text-lg font-black">مورد جديد</h2><label className="field"><span>الاسم *</span><input className="input" name="name" required /></label><label className="field"><span>الهاتف</span><input className="input" name="phone" inputMode="tel" /></label><label className="field"><span>ملاحظات</span><textarea className="input" name="notes" /></label><SubmitButton>حفظ المورد</SubmitButton></form> : null}
    </section></div>;
}
