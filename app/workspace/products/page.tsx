import ActionFeedback from "@/components/business/ActionFeedback";
import { createBusinessProduct } from "@/app/actions/business";
import { businessMoney, requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { Badge, ButtonLink } from "@/components/ui/Enterprise";
import { WorkspaceDrawer, WorkspaceModule, WorkspaceModuleHeader, WorkspaceRecordLink, WorkspaceToolbar } from "@/components/workspace/WorkspaceModule";

export const dynamic = "force-dynamic";
export const metadata = { title: "المنتجات | مَدار" };

type Product = {
  id: string; name: string; sku: string | null; category: string | null; description: string | null;
  price: number; cost: number; stock_quantity: number; low_stock_threshold: number; is_active: boolean;
};

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; q?: string; panel?: string }> }) {
  const { workspace } = await requireBusinessWorkspace();
  const params = await searchParams;
  const products = (await supabaseFetch(`/rest/v1/business_products?organization_id=eq.${encodeURIComponent(workspace.id)}&select=*&order=created_at.desc`)) as Product[];
  const query = (params.q || "").trim().toLocaleLowerCase("ar");
  const filtered = query ? products.filter((product) => [product.name, product.sku, product.category].filter(Boolean).join(" ").toLocaleLowerCase("ar").includes(query)) : products;
  const selected = params.panel && params.panel !== "new" ? products.find((product) => product.id === params.panel) : null;
  const closeHref = query ? `/workspace/products?q=${encodeURIComponent(params.q || "")}` : "/workspace/products";

  return <WorkspaceModule>
    <WorkspaceModuleHeader eyebrow="التشغيل" title="الأصناف والمنتجات" description="كتالوج واحد واضح للأسعار والتكلفة والمخزون، مع فتح التفاصيل دون مغادرة القائمة." icon="store" actions={<ButtonLink href="/workspace/products?panel=new" size="sm">إضافة منتج</ButtonLink>} tabs={[
      { label: "المنتجات", href: "/workspace/products", active: true },
      { label: "المخزون", href: "/workspace/inventory" },
      { label: "المشتريات", href: "/workspace/procurement" },
    ]} />
    <ActionFeedback success={params.success} error={params.error} />
    <WorkspaceToolbar action="/workspace/products" query={params.q} placeholder="ابحث بالاسم أو SKU أو التصنيف" count={filtered.length}>
      <ButtonLink href="/workspace/imports" variant="secondary" size="sm">استيراد</ButtonLink>
    </WorkspaceToolbar>
    <section className="md-table-wrap mt-3">
      <table className="md-entity-table text-right">
        <thead><tr><th>المنتج</th><th>SKU</th><th>السعر</th><th>التكلفة</th><th>المخزون</th><th>الحالة</th></tr></thead>
        <tbody>{filtered.length ? filtered.map((product) => {
          const low = Number(product.stock_quantity) <= Number(product.low_stock_threshold);
          return <tr key={product.id}>
            <td><WorkspaceRecordLink href={`/workspace/products?panel=${product.id}${query ? `&q=${encodeURIComponent(params.q || "")}` : ""}`} title={product.name} description={product.category || "دون تصنيف"} /></td>
            <td className="text-slate-400">{product.sku || "—"}</td>
            <td>{businessMoney(product.price, workspace.currency)}</td>
            <td className="text-slate-400">{businessMoney(product.cost, workspace.currency)}</td>
            <td><Badge variant={low ? "warning" : "success"}>{product.stock_quantity}</Badge></td>
            <td><Badge variant={product.is_active ? "success" : "default"}>{product.is_active ? "نشط" : "مؤرشف"}</Badge></td>
          </tr>;
        }) : <tr><td colSpan={6} className="py-16 text-center text-slate-400">{query ? "لا توجد منتجات مطابقة للبحث." : "أضف أول منتج لتبدأ تشغيل تجارتك."}</td></tr>}</tbody>
      </table>
    </section>

    {params.panel === "new" && <WorkspaceDrawer title="إضافة منتج" description="أدخل البيانات الأساسية الآن، ويمكن استكمال التفاصيل لاحقًا." closeHref={closeHref}>
      <form action={createBusinessProduct} className="md-drawer-form">
        <label className="md-field"><span className="md-label">اسم المنتج</span><input className="field" name="name" required placeholder="مثال: عطر مدار 100مل" /></label>
        <div className="md-detail-grid"><label className="md-field"><span className="md-label">SKU</span><input className="field" name="sku" placeholder="اختياري" /></label><label className="md-field"><span className="md-label">التصنيف</span><input className="field" name="category" placeholder="العطور" /></label></div>
        <label className="md-field"><span className="md-label">الوصف</span><textarea className="field" name="description" rows={4} placeholder="وصف مختصر للاستخدام الداخلي" /></label>
        <div className="md-detail-grid"><label className="md-field"><span className="md-label">التكلفة</span><input className="field" name="cost" type="number" min="0" step="0.01" defaultValue="0" required /></label><label className="md-field"><span className="md-label">سعر البيع</span><input className="field" name="price" type="number" min="0" step="0.01" required /></label></div>
        <div className="md-detail-grid"><label className="md-field"><span className="md-label">الرصيد الافتتاحي</span><input className="field" name="opening_stock" type="number" min="0" step="0.001" defaultValue="0" required /></label><label className="md-field"><span className="md-label">حد التنبيه</span><input className="field" name="low_stock_threshold" type="number" min="0" step="0.001" defaultValue="0" required /></label></div>
        <button className="md-button md-button-primary">حفظ المنتج</button>
      </form>
    </WorkspaceDrawer>}

    {selected && <WorkspaceDrawer title={selected.name} description="تفاصيل الصنف ضمن مساحة العمل الحالية." closeHref={closeHref}>
      <div className="md-drawer-section"><div className="flex items-center justify-between gap-3"><Badge variant={selected.is_active ? "success" : "default"}>{selected.is_active ? "نشط" : "مؤرشف"}</Badge><strong>{businessMoney(selected.price, workspace.currency)}</strong></div>{selected.description && <p className="text-sm leading-7 text-slate-300">{selected.description}</p>}</div>
      <div className="md-detail-grid mt-4"><div className="md-detail-field"><span>SKU</span><strong>{selected.sku || "غير محدد"}</strong></div><div className="md-detail-field"><span>التصنيف</span><strong>{selected.category || "غير مصنف"}</strong></div><div className="md-detail-field"><span>التكلفة</span><strong>{businessMoney(selected.cost, workspace.currency)}</strong></div><div className="md-detail-field"><span>المخزون</span><strong>{selected.stock_quantity}</strong></div><div className="md-detail-field"><span>حد التنبيه</span><strong>{selected.low_stock_threshold}</strong></div><div className="md-detail-field"><span>هامش الوحدة</span><strong>{businessMoney(Number(selected.price) - Number(selected.cost), workspace.currency)}</strong></div></div>
      <div className="mt-5 flex gap-2"><ButtonLink href="/workspace/inventory" variant="secondary" size="sm">فتح المخزون</ButtonLink><ButtonLink href="/workspace/sales" variant="secondary" size="sm">فتح المبيعات</ButtonLink></div>
    </WorkspaceDrawer>}
  </WorkspaceModule>;
}
