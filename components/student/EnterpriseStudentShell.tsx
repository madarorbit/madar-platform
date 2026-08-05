"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";
import { siteConfig } from "@/src/config/site";
import ThemeToggle from "@/components/theme/ThemeToggle";
import NavigationControls from "@/components/navigation/NavigationControls";
import ShellModuleContext from "@/components/navigation/ShellModuleContext";
import WorkspaceCommandPalette from "@/components/workspace/WorkspaceCommandPalette";
import { studentNavigationGroups } from "@/src/lib/ux/navigation";

const mobileKeys = new Set(["dashboard", "tasks", "ai", "library"]);

export default function EnterpriseStudentShell({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const activeView = searchParams.get("view") || "dashboard";
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const groups = studentNavigationGroups;
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const current = flatItems.find((item) => item.key === activeView) || flatItems[0];
  const currentGroup = groups.find((group) => group.items.some((item) => item.key === current.key)) || groups[0];
  const mobileItems = flatItems.filter((item) => mobileKeys.has(item.key));
  const isActive = (key: string) => key === activeView;

  const navigation = (mobile = false) => <nav className={mobile ? "md-mobile-drawer-nav" : "md-ux-sidebar-nav"} aria-label="تنقل مساحة الطالب">
    {groups.map((group) => <details key={group.key} open={group.key !== "account"} className="md-nav-group">
      <summary><span>{group.label}</span><Icon name="arrow" className="h-3.5 w-3.5" /></summary>
      <div>{group.items.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={isActive(item.key) ? "page" : undefined} className={cx("md-ux-nav-link", isActive(item.key) && "is-active", item.orby && "is-orby")}>
        <span className="md-ux-nav-icon">{item.orby ? <Image src={siteConfig.assets.orby} alt="" width={28} height={28} unoptimized className="h-7 w-7 rounded-lg object-cover" /> : <Icon name={item.icon} className="h-4 w-4" />}</span>
        <span className="md-ux-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
      </Link>)}</div>
    </details>)}
  </nav>;

  return <div className={cx("md-ux-shell", "md-student-ux-shell", compact && "is-compact")}>
    <aside className="md-ux-sidebar md-no-print">
      <div className="md-workspace-switcher">
        <Link href="/" className="md-brand-mark" aria-label="مَدار | ORBIT"><Image src={siteConfig.assets.logo} alt="مَدار | ORBIT" width={150} height={36} className="h-7 w-auto" /></Link>
        <details>
          <summary><span className="md-workspace-avatar">ط</span><span className="md-workspace-switcher-copy"><strong>مساحة الطالب</strong><small>التعلّم والتخطيط الشخصي</small></span><Icon name="arrow" className="h-3.5 w-3.5" /></summary>
          <div className="md-workspace-menu">
            <div className="md-workspace-meta"><span>مساحة شخصية معزولة</span><span>الأدوات الدراسية وملفاتك الخاصة</span></div>
            <Link href="/dashboard"><Icon name="layers" />مساحات الأعمال</Link>
            <Link href="/account"><Icon name="settings" />إعدادات الحساب</Link>
          </div>
        </details>
      </div>
      {navigation()}
      <div className="md-ux-sidebar-footer">
        <button type="button" onClick={() => setCompact((value) => !value)} className="md-sidebar-control"><Icon name="layers" /><span>{compact ? "توسيع التنقل" : "تنقل مدمج"}</span></button>
        <span className="md-sidebar-footnote">بيانات الطالب خاصة ومعزولة</span>
      </div>
    </aside>

    <div className="md-ux-main">
      <header className="md-ux-topbar md-no-print">
        <div className="md-topbar-context">
          <button type="button" className="md-mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="فتح التنقل"><Icon name="layers" /></button>
          <NavigationControls showBreadcrumbs={false} />
          <div className="md-current-route"><span>{currentGroup.label}</span><strong>{current.label}</strong></div>
        </div>
        <button type="button" className="md-global-search" onClick={() => setPaletteOpen(true)}><Icon name="search" className="h-4 w-4" /><span>بحث في أدوات الطالب</span><kbd>⌘ K</kbd></button>
        <div className="md-topbar-actions">
          <ThemeToggle />
          <Link href="/student?view=ai" className="md-orby-topbar"><Image src={siteConfig.assets.orby} alt="أوربي" width={28} height={28} unoptimized /><span>اسأل أوربي</span></Link>
          <Link href="/account" className="md-account-button"><Icon name="user" /><span>حسابي</span></Link>
        </div>
      </header>
      <div className="md-ux-content md-adaptive-module-surface">
        <ShellModuleContext groupLabel={currentGroup.label} current={current} siblings={currentGroup.items} currentHref={current.href} />
        {children}
      </div>
    </div>

    <nav className="md-mobile-bottom-nav md-no-print" aria-label="التنقل السريع للطالب">
      {mobileItems.map((item) => <Link key={item.href} href={item.href} aria-current={isActive(item.key) ? "page" : undefined} className={cx(isActive(item.key) && "is-active", item.orby && "is-orby")}>
        {item.orby ? <Image src={siteConfig.assets.orby} alt="" width={34} height={34} unoptimized /> : <Icon name={item.icon} className="h-5 w-5" />}<span>{item.label.replace(" والتذكيرات", "")}</span>
      </Link>)}
      <button type="button" onClick={() => setMobileOpen(true)}><Icon name="layers" className="h-5 w-5" /><span>المزيد</span></button>
    </nav>

    {mobileOpen && <div className="md-mobile-drawer-layer md-no-print" onMouseDown={() => setMobileOpen(false)}><aside onMouseDown={(event) => event.stopPropagation()}><header><div><strong>مساحة الطالب</strong><span>{current.label}</span></div><button type="button" onClick={() => setMobileOpen(false)} aria-label="إغلاق">×</button></header>{navigation(true)}</aside></div>}
    <WorkspaceCommandPalette groups={groups} open={paletteOpen} onOpenChange={setPaletteOpen} />
  </div>;
}
