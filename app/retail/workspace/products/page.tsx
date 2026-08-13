import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { FlashMessage } from "@/components/retail-v0/ui/flash-message";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { relationName } from "@/src/lib/retail/relations";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { createProductAction, upsertCategoryAction } from "@/src/lib/retail/server/retail/actions";
import { getCategories, getProducts } from "@/src/lib/retail/server/retail/queries";

export const metadata: Metadata = { title: "المنتجات" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const [{ workspace, role }, params] = await Promise.all([requireWorkspace(), searchParams]);
  const [products, categories] = await Promise.all([getProducts(workspace.id), getCategories(workspace.id)]);
  const canWrite = role !== "VIEWER";
  return (
    <div className="content-grid">
      <FlashMessage {...params} />
      <PageHeader eyebrow="الكتالوج" title="المنتجات" description="الرصيد الظاهر ناتج عن سجل حركات؛ لا يمكن تعديله من بطاقة المنتج مباشرة." />
      <section className={`grid gap-4 ${canWrite ? "xl:grid-cols-[minmax(0,1fr)_390px]" : ""}`}>
        <div className="table-wrap">
          <table className="data-table" data-mobile="list"><thead><tr><th>المنتج</th><th>التصنيف</th><th>البيع</th><th>متوسط التكلفة</th><th>المخزون</th><th>التنبيه</th><th>الحالة</th></tr></thead>
            <tbody>{products.map((product) => <tr key={product.id}><td data-label="المنتج"><strong>{product.name}</strong><small className="muted block">{product.sku ?? product.barcode ?? "دون رمز"}</small></td><td data-label="التصنيف">{relationName(product.categories)}</td><td data-label="سعر البيع">{formatMoney(product.sale_price, workspace.currency)}</td><td data-label="متوسط التكلفة">{formatMoney(product.average_cost, workspace.currency)}</td><td data-label="المخزون">{formatQuantity(product.stock_on_hand)} {product.unit}</td><td data-label="حد التنبيه">{formatQuantity(product.minimum_stock)}</td><td data-label="الحالة"><span className={product.stock_on_hand <= product.minimum_stock ? "status-pill status-warning" : "status-pill"}>{product.status === "active" ? "نشط" : "متوقف"}</span></td></tr>)}</tbody>
          </table>
          {!products.length ? <p className="muted p-8 text-center">لا توجد منتجات. أضف أول منتج من النموذج.</p> : null}
        </div>
        {canWrite ? <div className="grid content-start gap-4">
          <form action={createProductAction} className="surface grid gap-4 p-5" encType="multipart/form-data">
            <input type="hidden" name="operation_id" value={crypto.randomUUID()} />
            <h2 className="text-lg font-black">منتج جديد</h2>
            <label className="field"><span>اسم المنتج *</span><input className="input" name="name" required /></label>
            <div className="grid grid-cols-2 gap-3"><label className="field"><span>SKU</span><input className="input" name="sku" dir="ltr" /></label><label className="field"><span>Barcode</span><input className="input" name="barcode" dir="ltr" /></label></div>
            <label className="field"><span>التصنيف</span><select className="input" name="category_id"><option value="">دون تصنيف</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3"><label className="field"><span>سعر الشراء</span><input className="input" type="number" name="purchase_price" min="0" step="0.01" defaultValue="0" required /></label><label className="field"><span>سعر البيع</span><input className="input" type="number" name="sale_price" min="0" step="0.01" defaultValue="0" required /></label></div>
            <div className="grid grid-cols-2 gap-3"><label className="field"><span>رصيد افتتاحي</span><input className="input" type="number" name="opening_quantity" min="0" step="0.001" defaultValue="0" required /></label><label className="field"><span>حد التنبيه</span><input className="input" type="number" name="minimum_stock" min="0" step="0.001" defaultValue="0" required /></label></div>
            <label className="field"><span>الوحدة</span><input className="input" name="unit" defaultValue="قطعة" required /></label>
            <label className="field"><span>صورة (اختيارية)</span><input className="input" type="file" name="image" accept="image/jpeg,image/png,image/webp" /></label>
            <label className="field"><span>ملاحظات</span><textarea className="input" name="notes" /></label>
            <SubmitButton>إضافة المنتج</SubmitButton>
          </form>
          <form action={upsertCategoryAction} className="surface grid gap-3 p-5">
            <input type="hidden" name="operation_id" value={crypto.randomUUID()} /><h2 className="font-black">تصنيف سريع</h2>
            <label className="field"><span>اسم التصنيف</span><input className="input" name="name" required /></label><SubmitButton className="button-secondary">حفظ التصنيف</SubmitButton>
          </form>
        </div> : null}
      </section>
    </div>
  );
}
