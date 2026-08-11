import type { Metadata } from "next";
import { DocumentComposer } from "@/components/retail-v0/retail/document-composer";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { formatDateTime, formatMoney } from "@/src/lib/retail/format";
import { relationName } from "@/src/lib/retail/relations";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { getCustomers, getProducts, getRecentSales } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "المبيعات" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const [products, customers, sales] = await Promise.all([getProducts(workspace.id), getCustomers(workspace.id), getRecentSales(workspace.id)]);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="عملية ذرّية" title="المبيعات" description="إتمام البيع يرحّل الفاتورة والمخزون والصندوق وذمة العميل معًا، أو يتراجع عنها كلها." />
    <DocumentComposer mode="sale" products={products.filter((product) => product.status === "active")} parties={customers.map(({ id, name }) => ({ id, name }))} currency={workspace.currency} operationId={crypto.randomUUID()} />
    <section className="surface p-5"><h2 className="text-lg font-black">آخر الفواتير</h2><div className="table-wrap mt-4"><table className="data-table"><thead><tr><th>الفاتورة</th><th>العميل</th><th>الوقت</th><th>الدفع</th><th>المدفوع</th><th>الإجمالي</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>{sale.invoice_number}</strong></td><td>{relationName(sale.customers, "بيع مباشر")}</td><td>{formatDateTime(sale.sold_at)}</td><td><span className="status-pill">{sale.payment_status}</span></td><td>{formatMoney(sale.amount_paid, workspace.currency)}</td><td>{formatMoney(sale.total, workspace.currency)}</td></tr>)}</tbody></table>{!sales.length ? <p className="muted p-8 text-center">لا توجد فواتير بعد.</p> : null}</div></section>
  </div>;
}
