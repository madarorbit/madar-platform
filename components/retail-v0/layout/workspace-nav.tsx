"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Boxes, Building2, CircleDollarSign, HandCoins,
  LayoutDashboard, PackagePlus, ReceiptText, Settings, ShoppingCart,
  Sparkles, Truck, Users,
} from "lucide-react";

const ITEMS = [
  ["/retail/workspace", "الرئيسية", LayoutDashboard], ["/retail/workspace/sales", "المبيعات", ShoppingCart],
  ["/retail/workspace/products", "المنتجات", Boxes], ["/retail/workspace/purchases", "المشتريات", PackagePlus],
  ["/retail/workspace/expenses", "المصروفات", ReceiptText], ["/retail/workspace/customers", "العملاء", Users],
  ["/retail/workspace/suppliers", "الموردون", Truck], ["/retail/workspace/inventory", "المخزون", Building2],
  ["/retail/workspace/debts", "الديون", HandCoins], ["/retail/workspace/cash", "الصندوق", CircleDollarSign],
  ["/retail/workspace/reports", "التقارير", BarChart3], ["/retail/workspace/orby", "ORBY", Sparkles],
  ["/retail/workspace/settings", "الإعدادات", Settings],
] as const;

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:grid" aria-label="أقسام التجارة">
      {ITEMS.map(([href, label, Icon]) => {
        const active = href === "/retail/workspace" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
          >
            <Icon size={17} /><span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
