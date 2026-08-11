import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatDateTime, formatQuantity } from "@/src/lib/retail/format";
import { relationName } from "@/src/lib/retail/relations";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { adjustInventoryAction } from "@/src/lib/retail/server/retail/actions";
import { getInventoryMovements, getProducts } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "المخزون" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const [products, movements] = await Promise.all([getProducts(workspace.id), getInventoryMovements(workspace.id)]);
  return <div className="content-grid"><FlashMessage {...params} /><PageHeader eyebrow="INVENTORY LEDGER" title="المخزون" description="كل رقم له حركة: افتتاحي، شراء، بيع، مرتجع أو تسوية بسبب واضح." />
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
      <div className="table-wrap"><table className="data-table"><thead><tr><th>الوقت</th><th>المنتج</th><th>النوع</th><th>التغير</th><th>الرصيد بعد الحركة</th><th>السبب</th></tr></thead><tbody>{movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.occurred_at)}</td><td>{relationName(movement.products)}</td><td>{movement.movement_type}</td><td className={Number(movement.quantity_delta) > 0 ? "text-emerald-200" : "text-red-200"}>{Number(movement.quantity_delta) > 0 ? "+" : ""}{formatQuantity(movement.quantity_delta)}</td><td>{formatQuantity(movement.balance_after)}</td><td>{movement.notes ?? "—"}</td></tr>)}</tbody></table>{!movements.length ? <p className="muted p-8 text-center">ستظهر الحركات بعد الرصيد الافتتاحي أو أول شراء.</p> : null}</div>
      <form action={adjustInventoryAction} className="surface grid content-start gap-4 p-5"><input type="hidden" name="operation_id" value={crypto.randomUUID()} /><h2 className="text-lg font-black">تسوية مخزون</h2><label className="field"><span>المنتج</span><select className="input" name="product_id" required><option value="">اختر…</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} — {formatQuantity(product.stock_on_hand)}</option>)}</select></label><label className="field"><span>نوع التسوية</span><select className="input" name="movement_type"><option value="MANUAL_ADJUSTMENT">زيادة/نقص يدوي</option><option value="COUNT_ADJUSTMENT">نتيجة جرد فعلي</option></select></label><label className="field"><span>التغير (+ أو -)</span><input className="input" type="number" name="quantity_delta" step="0.001" placeholder="مثال: -2" /></label><label className="field"><span>الكمية المعدودة (للجرد)</span><input className="input" type="number" name="counted_quantity" min="0" step="0.001" /></label><label className="field"><span>السبب *</span><textarea className="input" name="notes" minLength={3} required /></label><SubmitButton>حفظ التسوية</SubmitButton></form>
    </section></div>;
}
