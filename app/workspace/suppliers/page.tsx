import ActionFeedback from "@/components/business/ActionFeedback";
import { createBusinessSupplier } from "@/app/actions/business";
import { businessMoney, requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { Badge, ButtonLink } from "@/components/ui/Enterprise";
import { WorkspaceDrawer, WorkspaceModule, WorkspaceModuleHeader, WorkspaceRecordLink, WorkspaceToolbar } from "@/components/workspace/WorkspaceModule";

export const dynamic = "force-dynamic";
export const metadata = { title: "الموردون | مَدار" };
type Supplier = { id: string; name: string; contact_name: string | null; phone: string | null; email: string | null; address: string | null; balance_due: number; is_active: boolean; notes: string | null };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; q?: string; panel?: string }> }) {
  const { workspace } = await requireBusinessWorkspace();
  const params = await searchParams;
  const suppliers = (await supabaseFetch(`/rest/v1/business_suppliers?organization_id=eq.${encodeURIComponent(workspace.id)}&select=*&order=created_at.desc`)) as Supplier[];
  const query = (params.q || "").trim().toLocaleLowerCase("ar");
  const filtered = query ? suppliers.filter((supplier) => [supplier.name, supplier.contact_name, supplier.phone, supplier.email].filter(Boolean).join(" ").toLocaleLowerCase("ar").includes(query)) : suppliers;
  const selected = params.panel && params.panel !== "new" ? suppliers.find((supplier) => supplier.id === params.panel) : null;
  const closeHref = query ? `/workspace/suppliers?q=${encodeURIComponent(params.q || "")}` : "/workspace/suppliers";
  return <WorkspaceModule>
    <WorkspaceModuleHeader eyebrow="سلسلة التوريد" title="الموردون" description="إدارة الموردين والأرصدة المستحقة من قائمة واحدة قابلة للبحث." icon="briefcase" actions={<ButtonLink href="/workspace/suppliers?panel=new" size="sm">إضافة مورد</ButtonLink>} tabs={[
      { label: "الموردون", href: "/workspace/suppliers", active: true }, { label: "المشتريات", href: "/workspace/procurement" }, { label: "المخزون", href: "/workspace/inventory" },
    ]} />
    <ActionFeedback success={params.success} error={params.error} />
    <WorkspaceToolbar action="/workspace/suppliers" query={params.q} placeholder="ابحث باسم المورد أو مسؤول التواصل" count={filtered.length} />
    <section className="md-table-wrap mt-3"><table className="md-entity-table text-right"><thead><tr><th>المورد</th><th>مسؤول التواصل</th><th>الهاتف والبريد</th><th>الرصيد المستحق</th><th>الحالة</th></tr></thead><tbody>
      {filtered.length ? filtered.map((supplier) => <tr key={supplier.id}><td><WorkspaceRecordLink href={`/workspace/suppliers?panel=${supplier.id}${query ? `&q=${encodeURIComponent(params.q || "")}` : ""}`} title={supplier.name} description={supplier.address || "دون عنوان"} /></td><td>{supplier.contact_name || "—"}</td><td><span className="block text-sm">{supplier.phone || "—"}</span><span className="text-xs text-slate-500">{supplier.email || "لا يوجد بريد"}</span></td><td className="font-bold text-amber-200">{businessMoney(supplier.balance_due, workspace.currency)}</td><td><Badge variant={supplier.is_active ? "success" : "default"}>{supplier.is_active ? "نشط" : "متوقف"}</Badge></td></tr>) : <tr><td colSpan={5} className="py-16 text-center text-slate-400">{query ? "لا يوجد مورد مطابق للبحث." : "لا يوجد موردون بعد."}</td></tr>}
    </tbody></table></section>

    {params.panel === "new" && <WorkspaceDrawer title="إضافة مورد" description="سجّل بيانات المورد الأساسية والرصيد الافتتاحي." closeHref={closeHref}>
      <form action={createBusinessSupplier} className="md-drawer-form"><label className="md-field"><span className="md-label">اسم المورد</span><input className="field" name="name" required /></label><label className="md-field"><span className="md-label">مسؤول التواصل</span><input className="field" name="contact_name" /></label><div className="md-detail-grid"><label className="md-field"><span className="md-label">الهاتف</span><input className="field" name="phone" /></label><label className="md-field"><span className="md-label">البريد</span><input className="field" name="email" type="email" /></label></div><label className="md-field"><span className="md-label">العنوان</span><input className="field" name="address" /></label><label className="md-field"><span className="md-label">الرصيد المستحق</span><input className="field" name="balance_due" type="number" min="0" step="0.01" defaultValue="0" required /></label><label className="md-field"><span className="md-label">ملاحظات</span><textarea className="field" name="notes" rows={4} /></label><button className="md-button md-button-primary">حفظ المورد</button></form>
    </WorkspaceDrawer>}

    {selected && <WorkspaceDrawer title={selected.name} description="تفاصيل المورد والالتزامات الحالية." closeHref={closeHref}>
      <div className="md-drawer-section"><div className="flex items-center justify-between gap-3"><Badge variant={selected.is_active ? "success" : "default"}>{selected.is_active ? "نشط" : "متوقف"}</Badge><strong className="text-amber-200">{businessMoney(selected.balance_due, workspace.currency)}</strong></div>{selected.notes && <p className="text-sm leading-7 text-slate-300">{selected.notes}</p>}</div>
      <div className="md-detail-grid mt-4"><div className="md-detail-field"><span>مسؤول التواصل</span><strong>{selected.contact_name || "غير محدد"}</strong></div><div className="md-detail-field"><span>الهاتف</span><strong>{selected.phone || "غير محدد"}</strong></div><div className="md-detail-field"><span>البريد</span><strong>{selected.email || "غير محدد"}</strong></div><div className="md-detail-field"><span>العنوان</span><strong>{selected.address || "غير محدد"}</strong></div></div>
      <div className="mt-5"><ButtonLink href="/workspace/procurement" variant="secondary" size="sm">فتح المشتريات</ButtonLink></div>
    </WorkspaceDrawer>}
  </WorkspaceModule>;
}
