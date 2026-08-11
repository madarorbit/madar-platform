import Link from "next/link";
import { Brand } from "@/components/retail-v0/layout/brand";
import { WorkspaceNav } from "@/components/retail-v0/layout/workspace-nav";
import { logout } from "@/app/actions/auth";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, role, subscription } = await requireWorkspace();
  const inactive = ["expired", "suspended", "cancelled"].includes(subscription.status);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-b border-slate-800 bg-[#090e14]/95 lg:sticky lg:top-0 lg:h-screen lg:border-l lg:border-b-0">
        <div className="p-4 lg:p-5">
          <div className="flex items-center justify-between gap-4 lg:block">
            <Brand compact />
            <div className="lg:mt-5">
              <p className="max-w-44 truncate font-black">{workspace.name}</p>
              <p className="muted mt-1 text-xs">{role} · {workspace.currency}</p>
            </div>
          </div>
          <div className="mt-4 lg:mt-6"><WorkspaceNav /></div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-800 px-4 sm:px-6">
          <div><p className="text-sm font-bold">{user.fullName ?? user.email}</p><p className="muted text-xs">{subscription.plan?.name_ar ?? subscription.status}</p></div>
          <div className="flex items-center gap-2">
            <Link className="button-secondary !min-h-9 !py-1 text-xs" href="/workspace">منصة مَدار</Link>
            {user.platformRole !== "CUSTOMER" ? <Link className="button-secondary !min-h-9 !py-1 text-xs" href="/admin/retail">إدارة Retail</Link> : null}
            <form action={logout}><button className="button-secondary !min-h-9 !py-1 text-xs" type="submit">خروج</button></form>
          </div>
        </header>
        {inactive ? <div className="border-b border-amber-400/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-200">الاشتراك غير نشط. البيانات متاحة للقراءة، وتبقى طلبات التجديد في الإعدادات.</div> : null}
        <main className="mx-auto w-full max-w-[1480px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
