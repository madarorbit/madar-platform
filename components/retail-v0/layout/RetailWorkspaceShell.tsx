"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icons";
import { IconButton } from "@/components/ui/Enterprise";
import { Sheet } from "@/components/ui/EnterpriseClient";
import GlobalUserActions from "@/components/platform/GlobalUserActions";
import NavigationControls from "@/components/navigation/NavigationControls";
import { siteConfig } from "@/src/config/site";
import { platformRouteMatches, retailMobileNavigation, retailNavigationGroups } from "@/src/lib/ux/platform-navigation";

const roleNames: Record<string, string> = {
  OWNER: "المالك",
  MANAGER: "مدير",
  STAFF: "موظف",
  VIEWER: "مشاهد",
};
const statusNames: Record<string, string> = {
  active: "نشط",
  trialing: "تجريبي",
  grace: "مهلة سماح",
  expired: "منتهي",
  suspended: "موقوف",
  cancelled: "ملغى",
};

export default function RetailWorkspaceShell({
  children,
  workspaceName,
  role,
  currency,
  subscriptionStatus,
  planName,
  platformOrganizationId,
  isAdmin,
  displayName,
  hasAvatar,
  unread,
}: {
  children: ReactNode;
  workspaceName: string;
  role: string;
  currency: string;
  subscriptionStatus: string;
  planName: string;
  platformOrganizationId: string;
  isAdmin: boolean;
  displayName: string;
  hasAvatar: boolean;
  unread: number;
}) {
  const pathname = usePathname() || "/retail/workspace";
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const flatItems = retailNavigationGroups.flatMap((group) => group.items);
  const isActive = (href: string) => platformRouteMatches(pathname, href);
  const current = flatItems.find((item) => isActive(item.href)) || flatItems[0];
  const currentGroup = retailNavigationGroups.find((group) => group.items.some((item) => item.href === current.href));

  const navigation = (mobile = false) => (
    <nav className={mobile ? "md-mobile-drawer-nav" : "md-ux-sidebar-nav"} aria-label="تنقل MADAR Retail">
      {retailNavigationGroups.map((group) => (
        <details key={group.key} open={group.key === "retail-overview" || group.items.some((item) => isActive(item.href))} className="md-nav-group">
          <summary><span>{group.label}</span><Icon name="arrow" className="h-3.5 w-3.5" /></summary>
          <div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`md-ux-nav-link ${isActive(item.href) ? "is-active" : ""} ${item.orby ? "is-orby" : ""}`}
              >
                <span className="md-ux-nav-icon">
                  {item.orby ? <Image src={siteConfig.assets.orby} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-lg object-cover" /> : <Icon name={item.icon} className="h-4 w-4" />}
                </span>
                <span className="md-ux-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
              </Link>
            ))}
          </div>
        </details>
      ))}
    </nav>
  );

  return (
    <div className="md-ux-shell">
      <aside className="md-ux-sidebar md-no-print">
        <div className="md-workspace-switcher">
          <Link href="/account" className="md-brand-mark" aria-label="العودة إلى مَدار">
            <Image src={siteConfig.assets.logo} alt="مَدار | ORBIT" width={150} height={36} className="h-7 w-auto" />
          </Link>
          <details>
            <summary>
              <span className="md-workspace-avatar">{workspaceName.slice(0, 1)}</span>
              <span className="md-workspace-switcher-copy"><strong>{workspaceName}</strong><small>MADAR Retail</small></span>
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </summary>
            <div className="md-workspace-menu">
              <div className="md-workspace-meta"><span>{roleNames[role] || role} · {statusNames[subscriptionStatus] || subscriptionStatus}</span><span>{planName} · {currency}</span></div>
              <Link href="/account"><Icon name="layers" />الحساب والخدمات</Link>
              <Link href="/retail/workspace/settings"><Icon name="settings" />إعدادات Retail</Link>
              {isAdmin ? <Link href="/admin/retail"><Icon name="shield" />إدارة Retail</Link> : null}
            </div>
          </details>
        </div>
        {navigation()}
        <div className="md-ux-sidebar-footer"><span className="md-sidebar-footnote">{currency} · بيانات Retail معزولة</span></div>
      </aside>

      <div className="md-ux-main">
        <header className="md-ux-topbar md-ux-topbar-compact md-no-print">
          <div className="md-topbar-context">
            <IconButton className="md-mobile-menu-button" onClick={() => setMobileOpen(true)} label="فتح التنقل"><Icon name="menu" /></IconButton>
            <NavigationControls showBreadcrumbs={false} />
            <div className="md-current-route"><span>{currentGroup?.label || "MADAR Retail"}</span><strong>{current.label}</strong></div>
          </div>
          <GlobalUserActions displayName={displayName} hasAvatar={hasAvatar} isAdmin={isAdmin} unread={unread} orbyHref={`/orby?conversation=new&organization=${encodeURIComponent(platformOrganizationId)}`} />
        </header>
        {['expired','suspended','cancelled'].includes(subscriptionStatus) ? (
          <div className="border-b border-amber-400/20 bg-amber-300/[.08] px-4 py-3 text-sm text-amber-100">الاشتراك غير نشط. لا يتم حذف بيانات تجارتك، ويمكنك متابعة حالة التجديد من الإعدادات.</div>
        ) : null}
        <div className="md-ux-content">{children}</div>
      </div>

      <nav className="md-mobile-bottom-nav md-no-print" aria-label="التنقل السريع في Retail">
        {retailMobileNavigation.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`${isActive(item.href) ? "is-active" : ""} ${item.orby ? "is-orby" : ""}`}>
            {item.orby ? <Image src={siteConfig.assets.orby} alt="" width={34} height={34} unoptimized /> : <Icon name={item.icon} className="h-5 w-5" />}
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMobileOpen(true)}><Icon name="layers" className="h-5 w-5" /><span>المزيد</span></button>
      </nav>

      <Sheet open={mobileOpen} onClose={closeMobile} title={workspaceName} description={`MADAR Retail · ${currency}`}>{navigation(true)}</Sheet>
    </div>
  );
}
