"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { siteConfig } from "@/src/config/site";
import { Icon } from "@/components/ui/Icons";
import { IconButton, cx } from "@/components/ui/Enterprise";
import { Sheet } from "@/components/ui/EnterpriseClient";
import ThemeToggle from "@/components/theme/ThemeToggle";
import CartStatusLink from "@/components/platform/CartStatusLink";
import GlobalUserActions, { AccountMenu } from "@/components/platform/GlobalUserActions";
import MadarLayerNavigation from "@/components/shell/MadarLayerNavigation";
import type { ShellNotification } from "@/src/lib/ux/shell";

type Props = { authenticated: boolean; displayName?: string; hasAvatar: boolean; isAdmin: boolean; unread: number; notifications: ShellNotification[] };
const publicGroups = [
  { label: "المنصة", links: [{ label: "الرئيسية", href: "/" }, { label: "عن مَدار", href: "/about" }, { label: "أوربي", href: "/about#orby" }] },
  { label: "الاكتشاف", links: [{ label: "المتجر", href: "/store" }, { label: "المدونة", href: "/blog" }, { label: "المجتمع", href: "/community" }] },
  { label: "الموارد", links: [{ label: "الوثائق", href: "/docs" }, { label: "المساعدة", href: "/help" }, { label: "تواصل معنا", href: "/contact" }] },
];
const secondaryMobileGroups = [
  { label: "اكتشف أكثر", links: [{ label: "عن مَدار", href: "/about" }, { label: "المدونة", href: "/blog" }, { label: "المجتمع", href: "/community" }] },
  publicGroups[2],
];

export default function NavbarClient({ authenticated, displayName, hasAvatar, isAdmin, unread, notifications }: Props) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const active = (href: string) => {
    const route = href.split("#")[0];
    return route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`);
  };
  const close = useCallback(() => setOpen(false), []);

  return <nav className="md-public-nav md-no-print" aria-label="التنقل الرئيسي">
    <div className="md-container md-public-nav-inner">
      <Link href="/" className="md-public-brand" aria-label="مَدار | ORBIT — الرئيسية"><Image src={siteConfig.assets.logo} alt="شعار مَدار | ORBIT" width={164} height={38} priority /></Link>
      <div className="md-public-nav-groups">
        {publicGroups.map((group) => <details key={group.label} className={cx("md-public-nav-group", group.links.some((link) => active(link.href)) && "is-active")}>
          <summary>{group.label}<Icon name="arrow" className="h-3 w-3" /></summary>
          <div>{group.links.map((link) => <Link key={link.href} href={link.href} aria-current={active(link.href) ? "page" : undefined}><span>{link.label}</span>{active(link.href) && <Icon name="check" className="h-3.5 w-3.5" />}</Link>)}</div>
        </details>)}
      </div>
      <div className="md-public-nav-actions">
        <IconButton onClick={() => setOpen(true)} className="md-public-layer-button" aria-expanded={open} aria-controls="public-mobile-nav" label="فتح طبقات مَدار"><Icon name="layers" /></IconButton>
        <Link href="/search" className="md-public-search" aria-label="البحث في متجر مَدار"><Icon name="search" className="h-4 w-4" /><span>بحث في المتجر</span><kbd>/</kbd></Link>
        <ThemeToggle/>
        {authenticated ? <GlobalUserActions displayName={displayName || "حسابي"} hasAvatar={hasAvatar} isAdmin={isAdmin} unread={unread} notifications={notifications} /> : <><CartStatusLink /><Link href="/login" className="md-public-login">تسجيل الدخول</Link><Link href="/register" className="md-button md-button-primary md-button-sm">ابدأ مع مَدار</Link></>}
      </div>
      <div className="md-public-mobile-actions">
        <CartStatusLink />
        {authenticated ? <AccountMenu displayName={displayName || "حسابي"} hasAvatar={hasAvatar} isAdmin={isAdmin} /> : null}
        <IconButton onClick={() => setOpen(true)} className="md-public-menu-button" aria-expanded={open} aria-controls="public-mobile-nav" label="فتح طبقات مَدار"><Icon name="layers" /></IconButton>
      </div>
    </div>
    <Sheet open={open} onClose={close} title="طبقات مَدار" description="المنصة والحساب والخدمات"><div id="public-mobile-nav" className="md-public-mobile-nav md-public-mobile-nav-sheet"><div>
      <div className="md-mobile-theme-row"><span>المظهر</span><ThemeToggle/></div>
      <Link href="/search" onClick={close} className="md-public-mobile-search"><Icon name="search" />البحث في المتجر</Link>
      <MadarLayerNavigation authenticated={authenticated} onNavigate={close} />
      {secondaryMobileGroups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.links.map((link) => <Link key={link.href} href={link.href} onClick={close} aria-current={active(link.href) ? "page" : undefined}>{link.label}</Link>)}</section>)}
    </div></div></Sheet>
  </nav>;
}
