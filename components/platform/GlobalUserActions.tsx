"use client";

import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import CartStatusLink from "@/components/platform/CartStatusLink";
import { Menu } from "@/components/ui/EnterpriseClient";
import { Avatar } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import type { ShellNotification } from "@/src/lib/ux/shell";

export type GlobalUserActionsProps = {
  displayName: string;
  hasAvatar: boolean;
  isAdmin: boolean;
  unread?: number;
  notifications?: ShellNotification[];
  orbyHref?: string;
  showOrby?: boolean;
};

export function AccountMenu({ displayName, hasAvatar, isAdmin }: Pick<GlobalUserActionsProps, "displayName" | "hasAvatar" | "isAdmin">) {
  return <Menu label="قائمة الحساب" className="md-account-menu" trigger={<span className="md-account-menu-trigger">
    <Avatar src={hasAvatar ? "/account/avatar" : null} size="sm" />
    <span className="md-account-menu-name">{displayName}</span>
    <Icon name="arrow" className="h-3 w-3" />
  </span>}>
    <div className="md-account-menu-panel">
      <div className="md-account-menu-identity"><strong>{displayName}</strong><span>حساب مَدار</span></div>
      <Link href="/account"><Icon name="home" />الرئيسية</Link>
      <Link href="/account/services"><Icon name="layers" />خدماتي</Link>
      <Link href="/account/subscriptions"><Icon name="clock" />الاشتراكات</Link>
      <Link href="/account/purchases"><Icon name="briefcase" />مكتبتي</Link>
      <Link href="/account/appearance"><Icon name="settings" />المظهر واللغة</Link>
      {isAdmin ? <Link href="/admin"><Icon name="shield" />إدارة مَدار</Link> : null}
      <form action={logout}><button><Icon name="back" />تسجيل الخروج</button></form>
    </div>
  </Menu>;
}

function NotificationMenu({ unread, notifications }: { unread: number; notifications: ShellNotification[] }) {
  return <Menu label={unread ? `الإشعارات، ${unread} غير مقروءة` : "الإشعارات"} className="md-notification-menu" trigger={<span className="md-icon-button md-topbar-icon md-notification-trigger">
    <Icon name="bell" className="h-4 w-4" />
    {unread ? <span className="md-icon-badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span> : null}
  </span>}>
    <div className="md-notification-menu-panel">
      <div className="md-notification-menu-heading"><span><strong>الإشعارات</strong><small>{unread ? `${unread} غير مقروءة` : "لا جديد يحتاج انتباهك"}</small></span><Link href="/account/notifications">عرض الكل</Link></div>
      {notifications.length ? <div className="md-notification-preview-list">{notifications.map((item) => <Link key={item.id} href={item.href} className={item.read ? "" : "is-unread"}><span aria-hidden="true"/><span><strong>{item.title}</strong><small>{item.body}</small></span></Link>)}</div> : <p className="md-notification-menu-empty">لا توجد إشعارات حديثة.</p>}
    </div>
  </Menu>;
}

export default function GlobalUserActions({ displayName, hasAvatar, isAdmin, unread = 0, notifications = [], orbyHref = "/orby", showOrby = true }: GlobalUserActionsProps) {
  return (
    <div className="md-global-user-actions">
      {showOrby ? <Link href={orbyHref} className="md-orby-topbar" aria-label="فتح ORBY">
        <Image src="/brand/orby-assistant.svg" alt="" width={28} height={28} unoptimized />
        <span>ORBY</span>
      </Link> : null}
      <CartStatusLink />
      <NotificationMenu unread={unread} notifications={notifications} />
      <AccountMenu displayName={displayName} hasAvatar={hasAvatar} isAdmin={isAdmin} />
    </div>
  );
}
