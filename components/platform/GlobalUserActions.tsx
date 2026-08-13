"use client";

import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import CartStatusLink from "@/components/platform/CartStatusLink";
import { Menu } from "@/components/ui/EnterpriseClient";
import { Avatar, IconLink } from "@/components/ui/Enterprise";
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
      <IconLink href="/account/notifications" className="md-topbar-icon md-notification-link" label={unread ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"} badge={unread || undefined}>
        <Icon name="bell" className="h-4 w-4" />
      </IconLink>
      <Menu label="قائمة الحساب" className="md-account-menu" trigger={<span className="md-account-menu-trigger">
          <Avatar src={hasAvatar ? "/account/avatar" : null} size="sm" />
          <span className="md-account-menu-name">{displayName}</span>
          <Icon name="arrow" className="h-3 w-3" />
        </span>}>
        <div className="md-account-menu-panel">
          <div className="md-account-menu-identity"><strong>{displayName}</strong><span>حساب مَدار</span></div>
          <Link href="/account"><Icon name="home" />الرئيسية</Link>
          <Link href="/account/services"><Icon name="layers" />الخدمات والاشتراكات</Link>
          <Link href="/account/profile"><Icon name="user" />الملف الشخصي</Link>
          <Link href="/account/appearance"><Icon name="settings" />المظهر واللغة</Link>
          {isAdmin ? <Link href="/admin"><Icon name="shield" />إدارة مَدار</Link> : null}
          <form action={logout}><button><Icon name="back" />تسجيل الخروج</button></form>
        </div>
      </Menu>
    </div>
  );
}
