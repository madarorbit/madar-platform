import type { IconName } from "@/components/ui/Icons";

export const serviceCodes = [
  "CONNECT_EXISTING",
  "BUILD_ON_MADAR",
  "MADAR_RETAIL",
] as const;

export type ServiceCode = (typeof serviceCodes)[number];
export type ServiceState =
  | "NOT_SUBSCRIBED"
  | "SETUP_REQUIRED"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "REJECTED";

export type ServiceDefinition = {
  code: ServiceCode;
  name: string;
  shortName: string;
  description: string;
  detail: string;
  icon: IconName;
  openHref: string;
  accent: "mint" | "violet" | "mixed";
};

export const services: readonly ServiceDefinition[] = [
  {
    code: "CONNECT_EXISTING",
    name: "ربط تجارة قائمة بمَدار",
    shortName: "ربط تجارة قائمة",
    description: "اربط نظامك الحالي بمحرك الموصلات والتحليلات في مَدار.",
    detail: "يبقى نظامك القائم مصدر الحقيقة، وتعمل طبقات الربط وفق الصلاحيات التي تعتمدها.",
    icon: "automation",
    openHref: "/workspace/connect",
    accent: "mint",
  },
  {
    code: "BUILD_ON_MADAR",
    name: "بناء تجارة جديدة على مَدار",
    shortName: "بناء تجارة جديدة",
    description: "ابدأ تجارة جديدة باستخدام المساحات والقطاعات الموجودة في مَدار.",
    detail: "يبدأ إعداد القطاع والمساحة بعد اعتماد الخدمة، وليس أثناء إنشاء الحساب.",
    icon: "layers",
    openHref: "/workspace",
    accent: "violet",
  },
  {
    code: "MADAR_RETAIL",
    name: "MADAR Retail",
    shortName: "مَدار للتجزئة",
    description: "تشغيل خفيف وآمن للمبيعات والمخزون والصندوق والديون.",
    detail: "قاعدة Retail مستقلة، ودخول موحّد، وتحليلات وORBY ضمن صلاحيات حساب مَدار.",
    icon: "store",
    openHref: "/retail/workspace",
    accent: "mixed",
  },
] as const;

export const serviceStateLabels: Record<ServiceState, string> = {
  NOT_SUBSCRIBED: "غير مشترك",
  SETUP_REQUIRED: "الإعداد أو الدفع مطلوب",
  PENDING_APPROVAL: "بانتظار موافقة الإدارة",
  ACTIVE: "فعّالة",
  EXPIRED: "منتهية",
  SUSPENDED: "موقوفة",
  REJECTED: "مرفوضة",
};

export const serviceStateCtas: Record<ServiceState, string> = {
  NOT_SUBSCRIBED: "ابدأ",
  SETUP_REQUIRED: "أكمل الإعداد",
  PENDING_APPROVAL: "بانتظار الموافقة",
  ACTIVE: "فتح الخدمة",
  EXPIRED: "تجديد الاشتراك",
  SUSPENDED: "تجديد أو مراجعة الحالة",
  REJECTED: "إعادة تقديم الطلب",
};

export function isServiceCode(value: string): value is ServiceCode {
  return serviceCodes.includes(value as ServiceCode);
}

export function serviceDefinition(code: ServiceCode) {
  return services.find((service) => service.code === code) as ServiceDefinition;
}
