import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import type { ProductNavigationItem } from "@/src/lib/ux/navigation";

export default function ShellModuleContext({
  groupLabel,
  current,
  siblings,
  currentHref,
}: {
  groupLabel: string;
  current: ProductNavigationItem;
  siblings: ProductNavigationItem[];
  currentHref: string;
}) {
  return <header className="md-shell-module-context">
    <div className="md-shell-module-heading">
      <span className="md-module-icon"><Icon name={current.icon} className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="md-module-eyebrow">{groupLabel}</p>
        <h1>{current.label}</h1>
        {current.description && <p>{current.description}</p>}
      </div>
    </div>
    {siblings.length > 1 && <nav className="md-module-tabs" aria-label={`التنقل داخل ${groupLabel}`}>
      {siblings.map((item) => <Link key={item.href} href={item.href} aria-current={item.href === currentHref ? "page" : undefined} className={item.href === currentHref ? "is-active" : ""}>{item.label}</Link>)}
    </nav>}
  </header>;
}
