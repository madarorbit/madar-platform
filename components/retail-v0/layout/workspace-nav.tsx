"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icons";

const ITEMS: readonly [string, string, IconName][] = [
  ["/retail/workspace", "الرئيسية", "home"],
  ["/retail/workspace/sales", "المبيعات", "cart"],
  ["/retail/workspace/products", "المنتجات", "layers"],
  ["/retail/workspace/purchases", "المشتريات", "plus"],
  ["/retail/workspace/expenses", "المصروفات", "document"],
  ["/retail/workspace/customers", "العملاء", "community"],
  ["/retail/workspace/suppliers", "الموردون", "briefcase"],
  ["/retail/workspace/inventory", "المخزون", "store"],
  ["/retail/workspace/debts", "الديون", "document"],
  ["/retail/workspace/cash", "الصندوق", "briefcase"],
  ["/retail/workspace/reports", "التقارير", "chart"],
  ["/retail/workspace/orby", "ORBY", "sparkles"],
  ["/retail/workspace/settings", "الإعدادات", "settings"],
];

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:grid" aria-label="أقسام التجارة">
      {ITEMS.map(([href, label, icon]) => {
        const active = href === "/retail/workspace" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`md-retail-workspace-nav-link${active ? " is-active" : ""}`}
          >
            <Icon name={icon} className="h-[17px] w-[17px]" /><span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
