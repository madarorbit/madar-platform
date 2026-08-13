"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icons";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { siteConfig } from "@/src/config/site";

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

type NavItem = { href: string; label: string; description: string; icon: IconName; orby?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "التشغيل اليومي",
    items: [
      { href: "/retail/workspace", label: "الرئيسية", description: "ملخص التجارة اليوم", icon: "home" },
      { href: "/retail/workspace/sales", label: "المبيعات", description: "الفواتير والتحصيل", icon: "store" },
      { href: "/retail/workspace/products", label: "المنتجات", description: "الأسعار والمنتجات", icon: "layers" },
      { href: "/retail/workspace/inventory", label: "المخزون", description: "الأرصدة والحركة", icon: "chart" },
    ],
  },
  {
    label: "العمليات",
    items: [
      { href: "/retail/workspace/purchases", label: "المشتريات", description: "التوريد والفواتير", icon: "document" },
      { href: "/retail/workspace/expenses", label: "المصروفات", description: "مصروفات التشغيل", icon: "note" },
      { href: "/retail/workspace/customers", label: "العملاء", description: "الأرصدة والتعاملات", icon: "user" },
      { href: "/retail/workspace/suppliers", label: "الموردون", description: "الموردون والمستحقات", icon: "briefcase" },
      { href: "/retail/workspace/debts", label: "الديون", description: "الذمم والتحصيل", icon: "document" },
      { href: "/retail/workspace/cash", label: "الصندوق", description: "الحركة النقدية", icon: "store" },
    ],
  },
  {
    label: "الذكاء والتقارير",
    items: [
      { href: "/retail/workspace/reports", label: "التقارير", description: "قراءة الأداء", icon: "chart" },
      { href: "/retail/workspace/orby", label: "ORBY", description: "اسأل عن تجارتك", icon: "sparkles", orby: true },
    ],
  },
  {
    label: "الإعدادات",
    items: [{ href: "/retail/workspace/settings", label: "إعدادات Retail", description: "التجارة والاشتراك", icon: "settings" }],
  },
];

const mobileItems = [
  groups[0].items[0],
  groups[0].items[1],
  groups[0].items[2],
  groups[2].items[1],
];

export default function RetailWorkspaceShell({
  children,
  workspaceName,
  role,
  currency,
  subscriptionStatus,
  planName,
  platformOrganizationId,
  isAdmin,
}: {
  children: ReactNode;
  workspaceName: string;
  role: string;
  currency: string;
  subscriptionStatus: string;
  planName: string;
  platformOrganizationId: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname() || "/retail/workspace";
  const [mobileOpen, setMobileOpen] = useState(false);
  const flatItems = groups.flatMap((group) => group.items);
  const isActive = (href: string) => href === "/retail/workspace" ? pathname === href : pathname.startsWith(href);
  const current = flatItems.find((item) => isActive(item.href)) || flatItems[0];
  const currentGroup = groups.find((group) => group.items.some((item) => item.href === current.href));

  const navigation = (mobile = false) => (
    <nav className={mobile ? "md-mobile-drawer-nav" : "md-ux-sidebar-nav"} aria-label="تنقل MADAR Retail">
      {groups.map((group) => (
        <details key={group.label} open className="md-nav-group">
          <summary><span>{group.label}</span><Icon name="arrow" className="h-3.5 w-3.5" /></summary>
          <div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
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
        <header className="md-ux-topbar md-no-print">
          <div className="md-topbar-context">
            <button type="button" className="md-mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="فتح التنقل"><Icon name="layers" /></button>
            <div className="md-current-route"><span>{currentGroup?.label || "MADAR Retail"}</span><strong>{current.label}</strong></div>
          </div>
          <div className="md-topbar-actions">
            <ThemeToggle />
            <Link href={`/orby?conversation=new&organization=${encodeURIComponent(platformOrganizationId)}`} className="md-orby-topbar">
              <Image src={siteConfig.assets.orby} alt="أوربي" width={28} height={28} unoptimized /><span>اسأل أوربي</span>
            </Link>
            <Link href="/account/notifications" className="md-topbar-icon" aria-label="الإشعارات"><Icon name="bell" /></Link>
            <Link href="/account" className="md-account-button"><Icon name="user" /><span>حسابي</span></Link>
          </div>
        </header>
        {['expired','suspended','cancelled'].includes(subscriptionStatus) ? (
          <div className="border-b border-amber-400/20 bg-amber-300/[.08] px-4 py-3 text-sm text-amber-100">الاشتراك غير نشط. لا يتم حذف بيانات تجارتك، ويمكنك متابعة حالة التجديد من الإعدادات.</div>
        ) : null}
        <div className="md-ux-content">{children}</div>
      </div>

      <nav className="md-mobile-bottom-nav md-no-print" aria-label="التنقل السريع في Retail">
        {mobileItems.map((item) => (
          <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`${isActive(item.href) ? "is-active" : ""} ${item.orby ? "is-orby" : ""}`}>
            {item.orby ? <Image src={siteConfig.assets.orby} alt="" width={34} height={34} unoptimized /> : <Icon name={item.icon} className="h-5 w-5" />}
            <span>{item.label}</span>
          </Link>
        ))}
        <button type="button" onClick={() => setMobileOpen(true)}><Icon name="layers" className="h-5 w-5" /><span>المزيد</span></button>
      </nav>

      {mobileOpen ? (
        <div className="md-mobile-drawer-layer md-no-print" onMouseDown={() => setMobileOpen(false)}>
          <aside onMouseDown={(event) => event.stopPropagation()}>
            <header><div><strong>{workspaceName}</strong><span>MADAR Retail · {currency}</span></div><button type="button" onClick={() => setMobileOpen(false)} aria-label="إغلاق">×</button></header>
            {navigation(true)}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
