import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";

export function WorkspaceModule({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={cx("md-workspace-module", className)}>{children}</main>;
}

export function WorkspaceModuleHeader({
  eyebrow,
  title,
  description,
  icon = "layers",
  actions,
  tabs,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: IconName;
  actions?: ReactNode;
  tabs?: Array<{ label: string; href: string; active?: boolean }>;
}) {
  return <header className="md-module-header">
    <div className="md-module-heading-row">
      <div className="flex min-w-0 items-start gap-3">
        <span className="md-module-icon"><Icon name={icon} className="h-5 w-5" /></span>
        <div className="min-w-0">
          {eyebrow && <p className="md-module-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {actions && <div className="md-module-actions">{actions}</div>}
    </div>
    {tabs?.length ? <nav className="md-module-tabs" aria-label={`تبويبات ${title}`}>
      {tabs.map((tab) => <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} className={tab.active ? "is-active" : ""}>{tab.label}</Link>)}
    </nav> : null}
  </header>;
}

export function WorkspaceToolbar({
  action,
  query,
  placeholder = "بحث…",
  count,
  hidden,
  children,
}: {
  action: string;
  query?: string;
  placeholder?: string;
  count?: number;
  hidden?: ReactNode;
  children?: ReactNode;
}) {
  return <div className="md-list-toolbar">
    <form action={action} className="md-list-search" role="search">
      <Icon name="search" className="h-4 w-4" />
      {hidden}
      <input name="q" type="search" defaultValue={query} placeholder={placeholder} aria-label={placeholder} />
    </form>
    <div className="md-list-toolbar-end">
      {typeof count === "number" && <span className="md-list-count">{count.toLocaleString("ar-YE")} سجل</span>}
      {children}
    </div>
  </div>;
}

export function WorkspaceDrawer({
  title,
  description,
  closeHref,
  children,
  width = "md",
}: {
  title: string;
  description?: string;
  closeHref: string;
  children: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  return <div className="md-drawer-layer" role="presentation">
    <Link href={closeHref} className="md-drawer-backdrop" aria-label="إغلاق اللوحة" scroll={false} />
    <aside className={cx("md-drawer", `md-drawer-${width}`)} role="dialog" aria-modal="true" aria-label={title}>
      <header className="md-drawer-header">
        <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
        <Link href={closeHref} className="md-drawer-close" aria-label="إغلاق" scroll={false}><span aria-hidden="true">×</span></Link>
      </header>
      <div className="md-drawer-body">{children}</div>
    </aside>
  </div>;
}

export function WorkspaceRecordLink({ href, title, description }: { href: string; title: string; description?: string }) {
  return <Link href={href} scroll={false} className="md-record-link"><strong>{title}</strong>{description && <span>{description}</span>}</Link>;
}

export function WorkspaceState({
  title,
  description,
  icon = "layers",
  action,
  tone = "default",
}: {
  title: string;
  description: string;
  icon?: IconName;
  action?: ReactNode;
  tone?: "default" | "danger";
}) {
  return <div className={cx("md-workspace-state", tone === "danger" && "is-danger")}>
    <span><Icon name={icon} className="h-6 w-6" /></span><h2>{title}</h2><p>{description}</p>{action}
  </div>;
}
