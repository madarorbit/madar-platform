import ActionFeedback from "@/components/business/ActionFeedback";
import { createBusinessCustomer } from "@/app/actions/business";
import { businessMoney, requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { Badge, ButtonLink } from "@/components/ui/Enterprise";
import { WorkspaceDrawer, WorkspaceModule, WorkspaceModuleHeader, WorkspaceRecordLink, WorkspaceToolbar } from "@/components/workspace/WorkspaceModule";

export const dynamic = "force-dynamic";
export const metadata = { title: "العملاء | مَدار" };
const labels: Record<string, string> = { new: "جديد", active: "نشط", vip: "مميز", inactive: "متوقف" };
type Customer = { id: string; name: string; phone: string | null; email: string | null; address: string | null; status: string; total_spent: number; last_order_at: string | null; notes: string | null };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string; q?: string; panel?: string }> }) {
  const { workspace } = await requireBusinessWorkspace();
  const params = await searchParams;
  const customers = (await supabaseFetch(`/rest/v1/business_customers?organization_id=eq.${encodeURIComponent(workspace.id)}&select=*&order=created_at.desc`)) as Customer[];
  const query = (params.q || "").trim().toLocaleLowerCase("ar");
  const filtered = query ? customers.filter((customer) => [customer.name, customer.phone, customer.email, customer.address].filter(Boolean).join(" ").toLocaleLowerCase("ar").includes(query)) : customers;
  const selected = params.panel && params.panel !== "new" ? customers.find((customer) => customer.id === params.panel) : null;
  const closeHref = query ? `/workspace/customers?q=${encodeURIComponent(params.q || "")}` : "/workspace/customers";

  return <WorkspaceModule>
    <WorkspaceModuleHeader eyebrow="إدارة العلاقات" title="العملاء" description="قائمة موحدة للعلاقات والقيمة والنشاط، مع تفاصيل جانبية تحفظ سياق العمل." icon="community" actions={<ButtonLink href="/workspace/customers?panel=new" size="sm">إضافة عميل</ButtonLink>} tabs={[
      { label: "العملاء", href: "/workspace/customers", active: true },
      { label: "المبيعات", href: "/workspace/sales" },
      { label: "التحليلات", href: "/workspace/analytics" },
    ]} />
    <ActionFeedback success={params.success} error={params.error} />
    <WorkspaceToolbar action="/workspace/customers" query={params.q} placeholder="ابحث بالاسم أو الهاتف أو البريد" count={filtered.length} />
    <section className="md-table-wrap mt-3"><table className="md-entity-table text-right"><thead><tr><th>العميل</th><th>التواصل</th><th>الحالة</th><th>إجمالي الإنفاق</th><th>آخر شراء</th></tr></thead><tbody>
      {filtered.length ? filtered.map((customer) => <tr key={customer.id}><td><WorkspaceRecordLink href={`/workspace/customers?panel=${customer.id}${query ? `&q=${encodeURIComponent(params.q || "")}` : ""}`} title={customer.name} description={customer.address || "دون عنوان"} /></td><td><span className="block text-sm">{customer.phone || "—"}</span><span className="text-xs text-slate-500">{customer.email || "لا يوجد بريد"}</span></td><td><Badge variant={customer.status === "vip" ? "brand" : customer.status === "inactive" ? "default" : "success"}>{labels[customer.status] || customer.status}</Badge></td><td className="font-bold">{businessMoney(customer.total_spent, workspace.currency)}</td><td className="text-slate-400">{customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString("ar-YE") : "—"}</td></tr>) : <tr><td colSpan={5} className="py-16 text-center text-slate-400">{query ? "لا يوجد عميل مطابق للبحث." : "لا يوجد عملاء بعد."}</td></tr>}
    </tbody></table></section>

    {params.panel === "new" && <WorkspaceDrawer title="إضافة عميل" description="أنشئ ملف العميل دون مغادرة القائمة." closeHref={closeHref}>
      <form action={createBusinessCustomer} className="md-drawer-form"><label className="md-field"><span className="md-label">اسم العميل</span><input className="field" name="name" required /></label><div className="md-detail-grid"><label className="md-field"><span className="md-label">الهاتف</span><input className="field" name="phone" /></label><label className="md-field"><span className="md-label">البريد</span><input className="field" name="email" type="email" /></label></div><label className="md-field"><span className="md-label">العنوان</span><input className="field" name="address" /></label><label className="md-field"><span className="md-label">الحالة</span><select className="field" name="status" defaultValue="active"><option value="new">جديد</option><option value="active">نشط</option><option value="vip">مميز</option><option value="inactive">متوقف</option></select></label><label className="md-field"><span className="md-label">ملاحظات داخلية</span><textarea className="field" name="notes" rows={4} /></label><button className="md-button md-button-primary">حفظ العميل</button></form>
    </WorkspaceDrawer>}

    {selected && <WorkspaceDrawer title={selected.name} description="ملف العميل ونشاطه داخل المساحة الحالية." closeHref={closeHref}>
      <div className="md-drawer-section"><div className="flex items-center justify-between gap-3"><Badge variant={selected.status === "vip" ? "brand" : "success"}>{labels[selected.status] || selected.status}</Badge><strong>{businessMoney(selected.total_spent, workspace.currency)}</strong></div>{selected.notes && <p className="text-sm leading-7 text-slate-300">{selected.notes}</p>}</div>
      <div className="md-detail-grid mt-4"><div className="md-detail-field"><span>الهاتف</span><strong>{selected.phone || "غير محدد"}</strong></div><div className="md-detail-field"><span>البريد</span><strong>{selected.email || "غير محدد"}</strong></div><div className="md-detail-field"><span>العنوان</span><strong>{selected.address || "غير محدد"}</strong></div><div className="md-detail-field"><span>آخر شراء</span><strong>{selected.last_order_at ? new Date(selected.last_order_at).toLocaleString("ar-YE") : "لا يوجد"}</strong></div></div>
      <div className="mt-5"><ButtonLink href="/workspace/sales" variant="secondary" size="sm">فتح سجل المبيعات</ButtonLink></div>
    </WorkspaceDrawer>}
  </WorkspaceModule>;
}
