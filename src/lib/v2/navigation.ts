import type { IconName } from "@/components/ui/Icons";
import type { VerticalExtension } from "./verticals";

export type WorkspaceNavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  orby?: boolean;
};
const core: WorkspaceNavigationItem[] = [
  {
    key: "dashboard",
    href: "/workspace",
    label: "لوحة المعلومات",
    icon: "home",
  },
  {
    key: "orby",
    href: "/workspace/orby",
    label: "أوربي",
    icon: "sparkles",
    orby: true,
  },
  {
    key: "analytics",
    href: "/workspace/analytics",
    label: "التقارير والتحليلات",
    icon: "chart",
  },
  {
    key: "connect",
    href: "/workspace/connect",
    label: "مركز الربط",
    icon: "layers",
  },
  {
    key: "permissions",
    href: "/workspace/permissions",
    label: "الصلاحيات والكتابة",
    icon: "shield",
  },
];
const byExtension: Record<VerticalExtension, WorkspaceNavigationItem[]> = {
  commerce: [
    {
      key: "products",
      href: "/workspace/products",
      label: "الأصناف والمنتجات",
      icon: "store",
    },
    {
      key: "procurement",
      href: "/workspace/procurement",
      label: "المشتريات والاستلام",
      icon: "briefcase",
    },
    {
      key: "inventory",
      href: "/workspace/inventory",
      label: "المخزون",
      icon: "layers",
    },
    {
      key: "sales",
      href: "/workspace/sales",
      label: "المبيعات والمرتجعات",
      icon: "chart",
    },
    {
      key: "customers",
      href: "/workspace/customers",
      label: "العملاء",
      icon: "community",
    },
    {
      key: "suppliers",
      href: "/workspace/suppliers",
      label: "الموردون",
      icon: "briefcase",
    },
    {
      key: "expenses",
      href: "/workspace/expenses",
      label: "المصروفات",
      icon: "document",
    },
  ],
  food_service: [
    {
      key: "restaurant",
      href: "/workspace/restaurant",
      label: "تشغيل المطعم",
      icon: "store",
    },
    {
      key: "inventory",
      href: "/workspace/inventory",
      label: "المكونات والمخزون",
      icon: "layers",
    },
    {
      key: "suppliers",
      href: "/workspace/suppliers",
      label: "الموردون",
      icon: "briefcase",
    },
    {
      key: "expenses",
      href: "/workspace/expenses",
      label: "المصروفات",
      icon: "document",
    },
  ],
  hospitality: [
    {
      key: "hotel",
      href: "/workspace/hotel",
      label: "تشغيل الفندق",
      icon: "home",
    },
    {
      key: "customers",
      href: "/workspace/customers",
      label: "النزلاء والعملاء",
      icon: "community",
    },
    {
      key: "expenses",
      href: "/workspace/expenses",
      label: "المصروفات",
      icon: "document",
    },
  ],
};
const tail: WorkspaceNavigationItem[] = [
  { key: "tasks", href: "/workspace/tasks", label: "المهام", icon: "check" },
  {
    key: "settings",
    href: "/workspace/setup",
    label: "إعدادات النشاط",
    icon: "settings",
  },
  {
    key: "activity",
    href: "/workspace/activity",
    label: "سجل النشاط",
    icon: "shield",
  },
  {
    key: "subscription",
    href: "/account/subscription",
    label: "الاشتراك والفوترة",
    icon: "layers",
  },
  {
    key: "support",
    href: "/account/support",
    label: "الدعم والملاحظات",
    icon: "help",
  },
];
export function workspaceNavigation(
  extension: VerticalExtension,
  enabledKeys?: readonly string[],
) {
  const items = [...core, ...byExtension[extension], ...tail];
  if (!enabledKeys?.length) return items;
  const enabled = new Set(enabledKeys);
  return items.filter(
    (item) =>
      enabled.has(item.key) ||
      ["subscription", "support", "activity", "tasks"].includes(item.key),
  );
}
