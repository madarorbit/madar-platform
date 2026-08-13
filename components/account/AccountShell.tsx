"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import GlobalUserActions from "@/components/platform/GlobalUserActions";
import NavigationControls from "@/components/navigation/NavigationControls";
import { Avatar, IconButton } from "@/components/ui/Enterprise";
import { Sheet } from "@/components/ui/EnterpriseClient";
import { Icon } from "@/components/ui/Icons";
import { siteConfig } from "@/src/config/site";
import {
  accountMobileNavigation,
  accountNavigationGroups,
  platformRouteMatches,
} from "@/src/lib/ux/platform-navigation";

export default function AccountShell({
  children,
  displayName,
  email,
  hasAvatar,
  isAdmin,
  unread,
}: {
  children: ReactNode;
  displayName: string;
  email: string;
  hasAvatar: boolean;
  isAdmin: boolean;
  unread: number;
}) {
  const pathname = usePathname() || "/account";
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const items = accountNavigationGroups.flatMap((group) => group.items);
  const current = [...items].sort((a, b) => b.href.length - a.href.length).find((item) => platformRouteMatches(pathname, item.href)) || items[0];
  const currentGroup = accountNavigationGroups.find((group) => group.items.some((item) => item.key === current.key));
  const isActive = (href: string) => platformRouteMatches(pathname, href);

  const navigation = (mobile = false) => (
    <nav className={mobile ? "md-mobile-drawer-nav" : "md-ux-sidebar-nav"} aria-label="أقسام حساب مَدار">
      {accountNavigationGroups.map((group) => (
        <details key={group.key} open={group.key !== "commerce" || pathname.startsWith("/store") || pathname.startsWith("/account/orders") || pathname.startsWith("/account/purchases")} className="md-nav-group">
          <summary><span>{group.label}</span><Icon name="arrow" className="h-3.5 w-3.5" /></summary>
          <div>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} onClick={closeMobile} aria-current={isActive(item.href) ? "page" : undefined} className={`md-ux-nav-link ${isActive(item.href) ? "is-active" : ""} ${item.orby ? "is-orby" : ""}`}>
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
    <div className="md-ux-shell md-account-ux-shell">
      <aside className="md-ux-sidebar md-no-print">
        <div className="md-workspace-switcher">
          <Link href="/account" className="md-brand-mark" aria-label="مَدار | ORBIT — الرئيسية">
            <Image src={siteConfig.assets.logo} alt="مَدار | ORBIT" width={150} height={36} className="h-7 w-auto" priority />
          </Link>
          <div className="md-account-sidebar-identity">
            <Avatar src={hasAvatar ? "/account/avatar" : null} />
            <span><strong>{displayName}</strong><small dir="ltr">{email}</small></span>
          </div>
        </div>
        {navigation()}
        <div className="md-ux-sidebar-footer"><span className="md-sidebar-footnote">حساب واحد · خدمات مستقلة · ORBY موحّد</span></div>
      </aside>

      <div className="md-ux-main">
        <header className="md-ux-topbar md-no-print">
          <div className="md-topbar-context">
            <IconButton className="md-mobile-menu-button" onClick={() => setMobileOpen(true)} label="فتح أقسام الحساب"><Icon name="menu" /></IconButton>
            <NavigationControls showBreadcrumbs={false} />
            <div className="md-current-route"><span>{currentGroup?.label || "حساب مَدار"}</span><strong>{current.label}</strong></div>
          </div>
          <Link href="/search" className="md-global-search" aria-label="البحث في متجر مَدار"><Icon name="search" className="h-4 w-4" /><span>بحث في المتجر</span></Link>
          <GlobalUserActions displayName={displayName} hasAvatar={hasAvatar} isAdmin={isAdmin} unread={unread} />
        </header>
        <div className="md-ux-content md-account-shell-content">{children}</div>
      </div>

      <nav className="md-mobile-bottom-nav md-no-print" aria-label="التنقل الرئيسي للحساب">
        {accountMobileNavigation.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`${isActive(item.href) ? "is-active" : ""} ${item.orby ? "is-orby" : ""}`}>
            {item.orby ? <Image src={siteConfig.assets.orby} alt="" width={34} height={34} unoptimized /> : <Icon name={item.icon} className="h-5 w-5" />}
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMobileOpen(true)}><Icon name="layers" className="h-5 w-5" /><span>المزيد</span></button>
      </nav>

      <Sheet open={mobileOpen} onClose={closeMobile} title={displayName} description="أقسام حساب مَدار">{navigation(true)}</Sheet>
    </div>
  );
}
