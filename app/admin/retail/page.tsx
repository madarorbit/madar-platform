import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/retail-v0/layout/brand";
import { formatDateTime } from "@/src/lib/retail/format";
import { createClient } from "@/src/lib/retail/supabase/server";
import { requirePlatformAdmin } from "@/src/lib/retail/server/auth/context";

export const metadata: Metadata = { title: "تشغيل MADAR Retail | إدارة مَدار" };

export default async function RetailOperationsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [profiles, workspaces, subscriptions, audits, devices] = await Promise.all([
    supabase.from("profiles").select("id,email,full_name,platform_role,status,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("retail_workspaces").select("id,name,status,currency,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("subscriptions").select("id,workspace_id,status,ends_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_logs").select("id,action,entity_type,workspace_id,created_at").order("created_at", { ascending: false }).limit(40),
    supabase.from("sync_devices").select("id,status,last_seen_at").limit(1000),
  ]);
  const results = [profiles, workspaces, subscriptions, audits, devices];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  // This is a dynamic Server Component; capture one request-stable instant for all expiry checks.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  const activeSubscriptions = (subscriptions.data || []).filter((item) => item.status === "active" && (!item.ends_at || new Date(item.ends_at).getTime() > renderedAt)).length;
  const activeDevices = (devices.data || []).filter((item) => item.status === "active").length;

  return <main className="container-shell py-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><Brand /><div className="flex flex-wrap gap-2"><Link className="button-secondary" href="/admin/local-payments">إدارة السعر والدفع</Link><Link className="button-primary" href="/admin/workspace-requests">طلبات التفعيل</Link></div></header>
    <div className="mt-7 content-grid">
      <div><p className="eyebrow">RETAIL OPERATIONS</p><h1 className="mt-1 text-3xl font-black">تشغيل MADAR Retail</h1><p className="muted mt-2 max-w-3xl leading-7">مؤشرات قاعدة Retail المستقلة للمتابعة فقط. التفعيل والإيقاف والأسعار وطرق الدفع تُدار مركزيًا من لوحة مَدار.</p></div>
      <section className="metric-grid">{[["مستخدمو Retail", profiles.data?.length || 0], ["المساحات", workspaces.data?.length || 0], ["اشتراكات فعالة", activeSubscriptions], ["أجهزة مزامنة نشطة", activeDevices]].map(([label, value]) => <article className="surface metric-card" key={String(label)}><p className="muted text-xs">{label}</p><p className="value">{value}</p></article>)}</section>
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="surface p-5"><h2 className="text-lg font-black">المساحات المفعلة مركزيًا</h2><div className="mt-3 grid gap-2">{(workspaces.data || []).map((workspace) => { const subscription = subscriptions.data?.find((item) => item.workspace_id === workspace.id); return <div className="surface-soft flex items-start justify-between gap-3 p-3" key={workspace.id}><div><strong>{workspace.name}</strong><p className="muted mt-1 text-xs">{workspace.currency} · {subscription?.ends_at ? `حتى ${new Date(subscription.ends_at).toLocaleDateString("ar-YE")}` : "لا يوجد تاريخ صلاحية"}</p></div><span className={`status-pill ${workspace.status === "suspended" ? "status-danger" : ""}`}>{workspace.status}</span></div>; })}{!workspaces.data?.length ? <p className="muted py-8 text-center">لا توجد مساحة Retail مفعلة بعد.</p> : null}</div></article>
        <article className="surface p-5"><h2 className="text-lg font-black">المستخدمون</h2><div className="table-wrap mt-3"><table className="data-table"><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th></tr></thead><tbody>{(profiles.data || []).map((profile) => <tr key={profile.id}><td>{profile.full_name || "—"}</td><td dir="ltr">{profile.email}</td><td>{profile.platform_role}</td><td>{profile.status}</td></tr>)}</tbody></table></div></article>
      </section>
      <section className="surface p-5"><h2 className="text-lg font-black">آخر سجلات Retail</h2><div className="table-wrap mt-3"><table className="data-table"><thead><tr><th>الوقت</th><th>الإجراء</th><th>الكيان</th><th>المساحة</th></tr></thead><tbody>{(audits.data || []).map((audit) => <tr key={audit.id}><td>{formatDateTime(audit.created_at)}</td><td>{audit.action}</td><td>{audit.entity_type}</td><td dir="ltr">{audit.workspace_id || "GLOBAL"}</td></tr>)}</tbody></table></div></section>
    </div>
  </main>;
}
