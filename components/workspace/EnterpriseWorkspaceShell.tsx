"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";
import { siteConfig } from "@/src/config/site";
import ThemeToggle from "@/components/theme/ThemeToggle";
import NavigationControls from "@/components/navigation/NavigationControls";
import ShellModuleContext from "@/components/navigation/ShellModuleContext";
import WorkspaceCommandPalette from "@/components/workspace/WorkspaceCommandPalette";
import {
  workspaceMobileNavigation,
  workspaceNavigationGroups,
} from "@/src/lib/v2/navigation";
import type { OperatingMode } from "@/src/lib/v2/account";
import type { VerticalExtension } from "@/src/lib/v2/verticals";
import type {
  ProductNavigationGroup,
  ProductNavigationItem,
} from "@/src/lib/ux/navigation";
import { saveWorkspaceNavigationState } from "@/app/actions/navigation";

const roleNames: Record<string, string> = {
  OWNER: "المالك",
  ADMIN: "مدير",
  EDITOR: "محرر",
  VIEWER: "مشاهد",
  MEMBER: "عضو",
};
const subscriptionNames: Record<string, string> = {
  active: "نشط",
  past_due: "متأخر",
  expired: "منتهي",
  cancelled: "ملغى",
  grace: "مهلة سماح",
};
const NAV_STATE_KEY = "madar:v2:workspace-nav";
const routesWithNativeHeaders = [
  "/workspace",
  "/workspace/products",
  "/workspace/customers",
  "/workspace/suppliers",
  "/workspace/orby",
];

export default function EnterpriseWorkspaceShell({
  children,
  workspaceName,
  role,
  currency,
  subscriptionStatus,
  extension,
  specializationName,
  enabledModules,
  operatingMode,
  initialCompact,
}: {
  children: ReactNode;
  workspaceName: string;
  role: string;
  currency: string;
  subscriptionStatus: string;
  extension: VerticalExtension;
  specializationName: string;
  enabledModules: string[];
  operatingMode: OperatingMode;
  initialCompact: boolean;
}) {
  const pathname = usePathname() || "/workspace";
  const [compact, setCompact] = useState(initialCompact);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [, startTransition] = useTransition();
  const groups = useMemo(
    () => workspaceNavigationGroups(extension, enabledModules),
    [extension, enabledModules],
  );
  const paletteGroups = groups as ProductNavigationGroup[];
  const mobileItems = useMemo(
    () => workspaceMobileNavigation(extension, enabledModules),
    [extension, enabledModules],
  );
  const flatItems = groups.flatMap((group) => group.items);
  const current = flatItems.find((item) =>
    item.href === "/workspace"
      ? pathname === item.href
      : pathname.startsWith(item.href),
  );
  const currentGroup = groups.find((group) =>
    group.items.some((item) => item.href === current?.href),
  );
  const hasNativeHeader = routesWithNativeHeaders.some((route) =>
    route === "/workspace" ? pathname === route : pathname.startsWith(route),
  );
  const changeCompact = () =>
    setCompact((value) => {
      const next = !value;
      localStorage.setItem(
        NAV_STATE_KEY,
        JSON.stringify({ version: 1, compact: next }),
      );
      startTransition(() => {
        void saveWorkspaceNavigationState(next);
      });
      return next;
    });
  const isActive = (href: string) =>
    href === "/workspace" ? pathname === href : pathname.startsWith(href);

  const navigation = (mobile = false) => (
    <nav
      className={mobile ? "md-mobile-drawer-nav" : "md-ux-sidebar-nav"}
      aria-label="تنقل مساحة العمل"
    >
      {groups.map((group) => (
        <details
          key={group.key}
          open={group.key !== "account"}
          className="md-nav-group"
        >
          <summary>
            <span>{group.label}</span>
            <Icon name="arrow" className="h-3.5 w-3.5" />
          </summary>
          <div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cx(
                  "md-ux-nav-link",
                  isActive(item.href) && "is-active",
                  item.orby && "is-orby",
                )}
              >
                <span className="md-ux-nav-icon">
                  {item.orby ? (
                    <Image
                      src={siteConfig.assets.orby}
                      alt=""
                      width={28}
                      height={28}
                      unoptimized
                      className="h-7 w-7 rounded-lg object-cover"
                    />
                  ) : (
                    <Icon name={item.icon} className="h-4 w-4" />
                  )}
                </span>
                <span className="md-ux-nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            ))}
          </div>
        </details>
      ))}
    </nav>
  );

  return (
    <div className={cx("md-ux-shell", compact && "is-compact")}>
      <aside className="md-ux-sidebar md-no-print">
        <div className="md-workspace-switcher">
          <Link
            href="/account"
            className="md-brand-mark"
            aria-label="العودة إلى مَدار"
          >
            <Image
              src={siteConfig.assets.logo}
              alt="مَدار | ORBIT"
              width={150}
              height={36}
              className="h-7 w-auto"
            />
          </Link>
          <details>
            <summary>
              <span className="md-workspace-avatar">
                {workspaceName.slice(0, 1)}
              </span>
              <span className="md-workspace-switcher-copy">
                <strong>{workspaceName}</strong>
                <small>{specializationName}</small>
              </span>
              <Icon name="arrow" className="h-3.5 w-3.5" />
            </summary>
            <div className="md-workspace-menu">
              <div className="md-workspace-meta">
                <span>
                  {operatingMode === "MADAR_NATIVE"
                    ? "مَدار هو النظام الأساسي"
                    : "مرتبط بنظام خارجي"}
                </span>
                <span>
                  {roleNames[role] || "عضو"} ·{" "}
                  {subscriptionNames[subscriptionStatus] || subscriptionStatus}
                </span>
              </div>
              <Link href="/account">
                <Icon name="layers" />
                الحساب والخدمات
              </Link>
              <Link href="/workspace/setup">
                <Icon name="settings" />
                إعدادات المساحة
              </Link>
              <Link href="/dashboard-app">
                <Icon name="automation" />
                تطبيق لوحة القيادة
              </Link>
            </div>
          </details>
        </div>
        {navigation()}
        <div className="md-ux-sidebar-footer">
          <button
            type="button"
            onClick={changeCompact}
            className="md-sidebar-control"
          >
            <Icon name="layers" />
            <span>{compact ? "توسيع التنقل" : "تنقل مدمج"}</span>
          </button>
          <span className="md-sidebar-footnote">
            {currency} · بيانات المساحة معزولة
          </span>
        </div>
      </aside>

      <div className="md-ux-main">
        <header className="md-ux-topbar md-no-print">
          <div className="md-topbar-context">
            <button
              type="button"
              className="md-mobile-menu-button"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح التنقل"
            >
              <Icon name="layers" />
            </button>
            <NavigationControls showBreadcrumbs={false} />
            <div className="md-current-route">
              <span>{currentGroup?.label || "مساحة العمل"}</span>
              <strong>{current?.label || "مساحة العمل"}</strong>
            </div>
          </div>
          <button
            type="button"
            className="md-global-search"
            onClick={() => setPaletteOpen(true)}
          >
            <Icon name="search" className="h-4 w-4" />
            <span>بحث شامل</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="md-topbar-actions">
            <ThemeToggle />
            <Link href="/workspace/orby" className="md-orby-topbar">
              <Image
                src={siteConfig.assets.orby}
                alt="أوربي"
                width={28}
                height={28}
                unoptimized
              />
              <span>اسأل أوربي</span>
            </Link>
            <Link
              href="/account/notifications"
              className="md-topbar-icon"
              aria-label="الإشعارات"
            >
              <Icon name="bell" />
            </Link>
            <Link href="/account" className="md-account-button">
              <Icon name="user" />
              <span>حسابي</span>
            </Link>
          </div>
        </header>
        <div
          className={cx(
            "md-ux-content",
            !hasNativeHeader && "md-adaptive-module-surface",
          )}
        >
          {!hasNativeHeader && current && currentGroup && (
            <ShellModuleContext
              groupLabel={currentGroup.label}
              current={current as ProductNavigationItem}
              siblings={currentGroup.items as ProductNavigationItem[]}
              currentHref={current.href}
            />
          )}
          {children}
        </div>
      </div>

      <nav
        className="md-mobile-bottom-nav md-no-print"
        aria-label="التنقل السريع"
      >
        {mobileItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cx(
              isActive(item.href) && "is-active",
              item.orby && "is-orby",
            )}
          >
            {item.orby ? (
              <Image
                src={siteConfig.assets.orby}
                alt=""
                width={34}
                height={34}
                unoptimized
              />
            ) : (
              <Icon name={item.icon} className="h-5 w-5" />
            )}
            <span>{item.label.replace(" والتقارير", "")}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMobileOpen(true)}>
          <Icon name="layers" className="h-5 w-5" />
          <span>المزيد</span>
        </button>
      </nav>

      {mobileOpen && (
        <div
          className="md-mobile-drawer-layer md-no-print"
          onMouseDown={() => setMobileOpen(false)}
        >
          <aside onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>{workspaceName}</strong>
                <span>{specializationName}</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="إغلاق"
              >
                ×
              </button>
            </header>
            {navigation(true)}
          </aside>
        </div>
      )}
      <WorkspaceCommandPalette
        groups={paletteGroups}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
    </div>
  );
}
