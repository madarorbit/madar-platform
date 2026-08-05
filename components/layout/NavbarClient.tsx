"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { siteConfig } from "@/src/config/site";
import { Icon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";
import ThemeToggle from "@/components/theme/ThemeToggle";

type Props = { authenticated: boolean; displayName?: string; hasAvatar: boolean; isAdmin: boolean };
const publicGroups = [
  { label: "المنصة", links: [{ label: "الرئيسية", href: "/" }, { label: "عن مَدار", href: "/about" }, { label: "أوربي", href: "/about#orby" }] },
  { label: "الاكتشاف", links: [{ label: "المتجر", href: "/store" }, { label: "المدونة", href: "/blog" }, { label: "المجتمع", href: "/community" }] },
  { label: "الموارد", links: [{ label: "الوثائق", href: "/docs" }, { label: "المساعدة", href: "/help" }, { label: "تواصل معنا", href: "/contact" }] },
];

function AccountLink({ hasAvatar, displayName, onClick }: { hasAvatar: boolean; displayName?: string; onClick?: () => void }) {
  return <Link href="/account" onClick={onClick} className="md-public-account-link">
    {hasAvatar ? <Image src="/account/avatar" alt="صورة الحساب" width={30} height={30} unoptimized /> : <span><Icon name="user" className="h-4 w-4" /></span>}
    <strong>{displayName || "حسابي"}</strong>
  </Link>;
}

export default function NavbarClient({ authenticated, displayName, hasAvatar, isAdmin }: Props) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const active = (href: string) => {
    const route = href.split("#")[0];
    return route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`);
  };
  const close = () => setOpen(false);

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
        <Link href="/search" className="md-public-search" aria-label="البحث في مَدار"><Icon name="search" className="h-4 w-4" /><span>بحث</span><kbd>/</kbd></Link>
        <ThemeToggle/>
        {authenticated ? <>{isAdmin && <Link href="/admin" className="md-button md-button-secondary md-button-sm">الإدارة</Link>}<AccountLink hasAvatar={hasAvatar} displayName={displayName} /></> : <><Link href="/login" className="md-public-login">تسجيل الدخول</Link><Link href="/register" className="md-button md-button-primary md-button-sm">ابدأ مع مَدار</Link></>}
      </div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="md-public-menu-button" aria-expanded={open} aria-controls="public-mobile-nav" aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}><Icon name={open ? "check" : "layers"} /></button>
    </div>
    {open && <div id="public-mobile-nav" className="md-public-mobile-nav"><div className="md-container">
      <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2"><span className="text-xs font-bold text-slate-400">المظهر</span><ThemeToggle/></div>
      <Link href="/search" onClick={close} className="md-public-mobile-search"><Icon name="search" />البحث في مَدار</Link>
      {publicGroups.map((group) => <section key={group.label}><h2>{group.label}</h2>{group.links.map((link) => <Link key={link.href} href={link.href} onClick={close} aria-current={active(link.href) ? "page" : undefined}>{link.label}</Link>)}</section>)}
      <Link href={siteConfig.links.orby} onClick={close} className="md-public-orby-link"><Image src={siteConfig.assets.orby} alt="أوربي" width={42} height={42} unoptimized /><span><strong>أوربي</strong><small>مساعد الأعمال الذكي</small></span></Link>
      {authenticated ? <div className="md-public-mobile-account">{isAdmin && <Link href="/admin" onClick={close}>لوحة الإدارة</Link>}<AccountLink hasAvatar={hasAvatar} displayName={displayName} onClick={close} /></div> : <div className="md-public-mobile-auth"><Link href="/login" onClick={close}>تسجيل الدخول</Link><Link href="/register" onClick={close}>ابدأ مع مَدار</Link></div>}
    </div></div>}
  </nav>;
}
