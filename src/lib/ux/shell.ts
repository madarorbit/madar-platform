import type { ServiceCode } from "@/src/lib/services/catalog";
import type { IconName } from "@/components/ui/Icons";

export type ShellNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type ShellIdentity = {
  /** Stable authenticated MADAR account identity; optional for compatibility adapters only. */
  accountId?: string;
  displayName: string;
  email: string;
  hasAvatar: boolean;
  isAdmin: boolean;
  unread: number;
  notifications: ShellNotification[];
};

export type ShellServiceOption = {
  organizationId: string;
  workspaceName: string;
  serviceCode: ServiceCode;
  serviceName: string;
  href: string;
  kind: "retail" | "connected" | "native";
};

export type ShellContextDefinition = {
  kind: "account" | "workspace" | "retail";
  name: string;
  detail: string;
  meta?: string;
  homeHref: string;
  currentOrganizationId?: string;
  options?: ShellServiceOption[];
  links?: Array<{ href: string; label: string; icon: IconName }>;
};
