import type { Metadata } from "next";
import { DocumentComposer } from "@/components/retail-v0/retail/document-composer";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { formatDateTime, formatMoney } from "@/src/lib/retail/format";
import { relationName } from "@/src/lib/retail/relations";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { getProducts, getRecentPurchases, getSuppliers } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "المشتريات" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const [products, suppliers, purchases] = await Promise.all([getProducts(workspace.id), getSuppliers(workspace.id), getRecentPurchases(workspace.id)]);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="تكلفة ومخزون" title="المشتريات" description="يزيد المخزون ويعاد حساب متوسط التكلفة، ويُنشأ المستحق وقيد الصندوق عند الحاجة." />
    {role !== "VIEWER" ? <DocumentComposer mode="purchase" products={products} parties={suppliers.map(({ id, name }) => ({ id, name }))} currency={workspace.currency} operationId={crypto.randomUUID()} /> : null}
    <section className="surface p-5"><h2 className="text-lg font-black">آخر المشتريات</h2><div className="table-wrap mt-4"><table className="data-table" data-mobile="list"><thead><tr><th>المرجع</th><th>المورد</th><th>الوقت</th><th>الدفع</th><th>المدفوع</th><th>الإجمالي</th></tr></thead><tbody>{purchases.map((purchase) => <tr key={purchase.id}><td data-label="المرجع"><strong>{purchase.purchase_number}</strong></td><td data-label="المورد">{relationName(purchase.suppliers, "شراء مباشر")}</td><td data-label="الوقت">{formatDateTime(purchase.purchased_at)}</td><td data-label="حالة الدفع"><span className="status-pill">{purchase.payment_status}</span></td><td data-label="المدفوع">{formatMoney(purchase.amount_paid, workspace.currency)}</td><td data-label="الإجمالي">{formatMoney(purchase.total, workspace.currency)}</td></tr>)}</tbody></table>{!purchases.length ? <p className="muted p-8 text-center">لا توجد مشتريات بعد.</p> : null}</div></section>
  </div>;
}
