"use client";

import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import CartStatusLink from "@/components/platform/CartStatusLink";
import { Icon } from "@/components/ui/Icons";

export type GlobalUserActionsProps = {
  displayName: string;
  hasAvatar: boolean;
  isAdmin: boolean;
  unread?: number;
  orbyHref?: string;
};

export default function GlobalUserActions({ displayName, hasAvatar, isAdmin, unread = 0, orbyHref = "/orby" }: GlobalUserActionsProps) {
  return (
    <div className="md-global-user-actions">
      <Link href={orbyHref} className="md-orby-topbar" aria-label="فتح ORBY">
        <Image src="/brand/orby-assistant.svg" alt="" width={28} height={28} unoptimized />
        <span>ORBY</span>
      </Link>
      <CartStatusLink />
      <Link href="/account/notifications" className="md-topbar-icon md-notification-link" aria-label={unread ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"}>
        <Icon name="bell" className="h-4 w-4" />
        {unread ? <span className="md-notification-dot" aria-hidden="true" /> : null}
      </Link>
      <details className="md-account-menu">
        <summary aria-label="فتح قائمة الحساب">
          {hasAvatar ? <Image src="/account/avatar" alt="صورة الحساب" width={32} height={32} unoptimized /> : <span className="md-default-avatar"><Icon name="user" className="h-4 w-4" /></span>}
          <span className="md-account-menu-name">{displayName}</span>
          <Icon name="arrow" className="h-3 w-3" />
        </summary>
        <div className="md-account-menu-panel">
          <div className="md-account-menu-identity"><strong>{displayName}</strong><span>حساب مَدار</span></div>
          <Link href="/account"><Icon name="home" />الرئيسية</Link>
          <Link href="/account/services"><Icon name="layers" />الخدمات والاشتراكات</Link>
          <Link href="/account/profile"><Icon name="user" />الملف الشخصي</Link>
          <Link href="/account/appearance"><Icon name="settings" />المظهر واللغة</Link>
          {isAdmin ? <Link href="/admin"><Icon name="shield" />إدارة مَدار</Link> : null}
          <form action={logout}><button><Icon name="back" />تسجيل الخروج</button></form>
        </div>
      </details>
    </div>
  );
}
