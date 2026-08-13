import type { IconName } from "@/components/ui/Icons";

export type PlatformNavigationItem = {
  key: string;
  href: string;
  label: string;
  description: string;
  icon: IconName;
  orby?: boolean;
};

export type PlatformNavigationGroup = {
  key: string;
  label: string;
  items: PlatformNavigationItem[];
};

export const accountNavigationGroups: PlatformNavigationGroup[] = [
  {
    key: "account-home",
    label: "مَدار",
    items: [
      { key: "home", href: "/account", label: "الرئيسية", description: "الخدمات والإجراءات والتحديثات المهمة", icon: "home" },
      { key: "services", href: "/account/services", label: "خدماتي", description: "الخدمات وحالة التفعيل والدخول", icon: "layers" },
      { key: "orby", href: "/orby", label: "ORBY", description: "مساعد واحد للحساب وسياقات الخدمات", icon: "sparkles", orby: true },
    ],
  },
  {
    key: "commerce",
    label: "المتجر والمشتريات",
    items: [
      { key: "store", href: "/store", label: "المتجر", description: "اكتشاف المنتجات والخدمات", icon: "store" },
      { key: "orders", href: "/account/orders", label: "طلباتي", description: "الدفع والمراجعة والتنفيذ", icon: "document" },
      { key: "payments", href: "/account/payments", label: "مدفوعاتي", description: "دفعات الخدمات والاشتراكات والمتجر", icon: "document" },
      { key: "library", href: "/account/purchases", label: "مكتبتي", description: "المشتريات والملفات المتاحة", icon: "briefcase" },
    ],
  },
  {
    key: "account-settings",
    label: "الحساب والإعدادات",
    items: [
      { key: "profile", href: "/account/profile", label: "الملف الشخصي", description: "الاسم والصورة وبيانات التواصل", icon: "user" },
      { key: "security", href: "/account/security", label: "الحساب والأمان", description: "البريد وكلمة المرور والجلسة", icon: "shield" },
      { key: "subscriptions", href: "/account/subscriptions", label: "الاشتراكات", description: "الخطط والتواريخ والتجديد", icon: "clock" },
      { key: "account-orby", href: "/account/orby", label: "ORBY والخطة", description: "الخطة والاستخدام وPlus", icon: "sparkles", orby: true },
      { key: "notifications", href: "/account/notifications", label: "الإشعارات", description: "الأحداث التي تستحق المتابعة", icon: "bell" },
      { key: "appearance", href: "/account/appearance", label: "المظهر واللغة", description: "فاتح أو داكن أو حسب النظام", icon: "settings" },
      { key: "privacy", href: "/account/privacy", label: "الخصوصية والبيانات", description: "التصدير وطلبات البيانات", icon: "shield" },
      { key: "support", href: "/account/support", label: "الدعم", description: "البلاغات والملاحظات", icon: "help" },
    ],
  },
];

export const accountMobileNavigation = ["home", "services", "orby", "store"]
  .map((key) => accountNavigationGroups.flatMap((group) => group.items).find((item) => item.key === key))
  .filter(Boolean) as PlatformNavigationItem[];

export const platformLayerNavigation: PlatformNavigationGroup[] = [
  {
    key: "platform-layer",
    label: "منصة مَدار",
    items: accountNavigationGroups[0].items,
  },
  {
    key: "commerce-layer",
    label: "التجارة والملكية",
    items: [
      accountNavigationGroups[1].items[0],
      accountNavigationGroups[1].items[1],
      accountNavigationGroups[1].items[2],
      accountNavigationGroups[1].items[3],
    ],
  },
  {
    key: "account-layer",
    label: "الحساب",
    items: [
      accountNavigationGroups[2].items[0],
      accountNavigationGroups[2].items[2],
      accountNavigationGroups[2].items[3],
      accountNavigationGroups[2].items[4],
      accountNavigationGroups[2].items[5],
    ],
  },
];

export const guestLayerNavigation: PlatformNavigationGroup[] = [
  {
    key: "guest-platform",
    label: "مَدار",
    items: [
      { key: "public-home", href: "/", label: "الرئيسية", description: "العودة إلى مَدار", icon: "home" },
      { key: "public-services", href: "/services", label: "الخدمات", description: "استكشف خدمات مَدار", icon: "layers" },
      { key: "public-orby", href: "/orby", label: "ORBY", description: "محادثة عامة مع ORBY", icon: "sparkles", orby: true },
      { key: "public-store", href: "/store", label: "المتجر", description: "المنتجات والخدمات الرقمية", icon: "store" },
    ],
  },
  {
    key: "guest-account",
    label: "الحساب",
    items: [
      { key: "login", href: "/login", label: "تسجيل الدخول", description: "متابعة إلى حسابك", icon: "user" },
      { key: "register", href: "/register", label: "إنشاء حساب", description: "حساب واحد لكل خدمات مَدار", icon: "plus" },
    ],
  },
];

export const retailNavigationGroups: PlatformNavigationGroup[] = [
  {
    key: "retail-overview",
    label: "نظرة عامة",
    items: [
      { key: "retail-home", href: "/retail/workspace", label: "الرئيسية", description: "ملخص التجارة والإجراءات اليومية", icon: "home" },
    ],
  },
  {
    key: "retail-daily",
    label: "البيع والمخزون",
    items: [
      { key: "retail-sales", href: "/retail/workspace/sales", label: "المبيعات", description: "الفواتير والتحصيل", icon: "store" },
      { key: "retail-products", href: "/retail/workspace/products", label: "المنتجات", description: "الأسعار والكتالوج", icon: "layers" },
      { key: "retail-inventory", href: "/retail/workspace/inventory", label: "المخزون", description: "الأرصدة والحركات والتنبيهات", icon: "chart" },
    ],
  },
  {
    key: "retail-supply",
    label: "التوريد والعلاقات",
    items: [
      { key: "retail-purchases", href: "/retail/workspace/purchases", label: "المشتريات", description: "التوريد وفواتير الشراء", icon: "document" },
      { key: "retail-suppliers", href: "/retail/workspace/suppliers", label: "الموردون", description: "الموردون والمستحقات", icon: "briefcase" },
      { key: "retail-customers", href: "/retail/workspace/customers", label: "العملاء", description: "الأرصدة والتعاملات", icon: "user" },
    ],
  },
  {
    key: "retail-finance",
    label: "المال والذمم",
    items: [
      { key: "retail-expenses", href: "/retail/workspace/expenses", label: "المصروفات", description: "مصروفات التشغيل", icon: "note" },
      { key: "retail-debts", href: "/retail/workspace/debts", label: "الديون", description: "الذمم والتحصيل والسداد", icon: "document" },
      { key: "retail-cash", href: "/retail/workspace/cash", label: "الصندوق", description: "الحركة النقدية", icon: "store" },
    ],
  },
  {
    key: "retail-intelligence",
    label: "الذكاء والتقارير",
    items: [
      { key: "retail-reports", href: "/retail/workspace/reports", label: "التقارير", description: "الأداء والاتجاهات", icon: "chart" },
      { key: "retail-orby", href: "/retail/workspace/orby", label: "ORBY", description: "اسأل ضمن سياق هذه التجارة", icon: "sparkles", orby: true },
    ],
  },
  {
    key: "retail-management",
    label: "الإدارة",
    items: [
      { key: "retail-settings", href: "/retail/workspace/settings", label: "إعدادات Retail", description: "التجارة والاشتراك", icon: "settings" },
    ],
  },
];

export const retailMobileNavigation = ["retail-home", "retail-sales", "retail-products", "retail-orby"]
  .map((key) => retailNavigationGroups.flatMap((group) => group.items).find((item) => item.key === key))
  .filter(Boolean) as PlatformNavigationItem[];

export function platformRouteMatches(pathname: string, href: string) {
  const route = href.split("?")[0];
  if (["/account", "/store", "/orby", "/workspace", "/retail/workspace"].includes(route)) return pathname === route;
  return pathname === route || pathname.startsWith(`${route}/`);
}
