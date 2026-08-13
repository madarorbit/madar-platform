import type { ReactNode } from "react";

export function AccountPage({ children, size = "wide" }: { children: ReactNode; size?: "narrow" | "wide" }) {
  return <main className={`md-account-page ${size === "narrow" ? "md-account-page-narrow" : ""}`}>{children}</main>;
}

export function AccountPageHeader({ eyebrow = "حساب مَدار", title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="md-account-page-header">
      <div><span className="md-eyebrow">{eyebrow}</span><h1 className="md-type-h1">{title}</h1><p className="md-type-body-sm md-muted">{description}</p></div>
      {actions ? <div className="md-account-page-actions">{actions}</div> : null}
    </header>
  );
}
