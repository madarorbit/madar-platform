import type { AccountService } from "@/src/lib/services/server";

const servicePriority: Record<AccountService["state"], number> = {
  ACTIVE: 0,
  SETUP_REQUIRED: 1,
  EXPIRED: 2,
  SUSPENDED: 3,
  REJECTED: 4,
  PENDING_APPROVAL: 5,
  NOT_SUBSCRIBED: 6,
};

export function sortAccountServices(services: AccountService[]) {
  return [...services].sort((a, b) => servicePriority[a.state] - servicePriority[b.state]);
}

export type AttentionItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  tone: "warning" | "danger" | "info";
};

export function attentionForService(service: AccountService): AttentionItem | null {
  const href = service.href || "/account/services";
  switch (service.state) {
    case "SETUP_REQUIRED":
      return {
        key: `service-${service.definition.code}`,
        title: `أكمل دفع ${service.definition.shortName}`,
        description: "الطلب محفوظ وينتظر إتمام خطوة الدفع.",
        href,
        tone: "warning",
      };
    case "EXPIRED":
      return {
        key: `service-${service.definition.code}`,
        title: `جدّد ${service.definition.shortName}`,
        description: "انتهى الاشتراك، وبيانات المساحة ما زالت محفوظة.",
        href,
        tone: "warning",
      };
    case "SUSPENDED":
      return {
        key: `service-${service.definition.code}`,
        title: `راجع إيقاف ${service.definition.shortName}`,
        description: service.subscription?.suspension_reason || "الخدمة متوقفة وتحتاج مراجعة التفاصيل.",
        href,
        tone: "danger",
      };
    case "REJECTED":
      return {
        key: `service-${service.definition.code}`,
        title: `راجع طلب ${service.definition.shortName}`,
        description: service.request?.rejection_reason || "تعذر اعتماد الطلب الحالي ويمكنك مراجعة السبب.",
        href,
        tone: "danger",
      };
    case "PENDING_APPROVAL":
      return {
        key: `service-${service.definition.code}`,
        title: `${service.definition.shortName} قيد المراجعة`,
        description: "لا يلزم إجراء جديد الآن؛ يمكنك متابعة حالة الطلب.",
        href,
        tone: "info",
      };
    default:
      return null;
  }
}

export function daysUntil(value: string, now = Date.now()) {
  return Math.ceil((Date.parse(value) - now) / 86_400_000);
}
