import type { OrbyDomainPlugin } from "../contracts";

export const ORBY_BUSINESS_DOMAIN: OrbyDomainPlugin = {
  key: "business",
  name: "ORBY Business",
  description:
    "المبيعات والعملاء والأداء والعمليات والفرص والمخاطر والتقارير الإدارية.",
  permissions: ["data.read", "intelligence.analyze", "business.action.draft"],
  tools: [
    "madar.data.search",
    "orby.intelligence.analyze",
    "madar.business.action.draft",
  ],
  workflows: ["business.sales-drop-analysis"],
  knowledgeNamespaces: ["business", "customers", "operations"],
  policyKeys: ["business-draft-approval"],
};
export const ORBY_STORE_DOMAIN: OrbyDomainPlugin = {
  key: "store",
  name: "ORBY Store",
  description:
    "المنتجات والطلبات والمخزون والمبيعات الإلكترونية وسلوك العملاء.",
  permissions: ["data.read", "intelligence.analyze"],
  tools: ["madar.data.search", "orby.intelligence.analyze"],
  workflows: ["store.inventory-review"],
  knowledgeNamespaces: ["store", "products", "orders", "inventory"],
  policyKeys: ["store-read-analysis"],
};
export const ORBY_FINANCE_DOMAIN: OrbyDomainPlugin = {
  key: "finance",
  name: "ORBY Finance",
  description:
    "الإيرادات والمصروفات والأرباح والتدفقات والفواتير والمدفوعات المتأخرة.",
  permissions: ["data.read", "intelligence.analyze", "business.action.draft"],
  tools: [
    "madar.data.search",
    "orby.intelligence.analyze",
    "madar.business.action.draft",
  ],
  workflows: ["finance.overdue-payments-review"],
  knowledgeNamespaces: ["finance", "payments", "expenses"],
  policyKeys: ["finance-draft-approval"],
};
export const COMPILED_ORBY_DOMAIN_PLUGINS = {
  "@madar/orby-business": ORBY_BUSINESS_DOMAIN,
  "@madar/orby-store": ORBY_STORE_DOMAIN,
  "@madar/orby-finance": ORBY_FINANCE_DOMAIN,
} as const;
export type CompiledOrbyDomainEntrypoint =
  keyof typeof COMPILED_ORBY_DOMAIN_PLUGINS;
