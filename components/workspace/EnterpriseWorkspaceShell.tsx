import type { ReactNode } from "react";
import MadarGlobalShell from "@/components/shell/MadarGlobalShell";
import {
  workspaceMobileNavigation,
  workspaceNavigationGroups,
} from "@/src/lib/v2/navigation";
import type { OperatingMode } from "@/src/lib/v2/account";
import type { VerticalExtension } from "@/src/lib/v2/verticals";
import type { ShellIdentity, ShellServiceOption } from "@/src/lib/ux/shell";

const roleNames: Record<string, string> = {
  OWNER: "المالك",
  ADMIN: "مدير",
  EDITOR: "محرر",
  VIEWER: "مشاهد",
  MEMBER: "عضو",
};

const subscriptionNames: Record<string, string> = {
  active: "نشط",
  past_due: "متأخر",
  expired: "منتهي",
  cancelled: "ملغى",
  grace: "مهلة سماح",
};

const routesWithNativeHeaders = [
  "/workspace",
  "/workspace/products",
  "/workspace/customers",
  "/workspace/suppliers",
  "/workspace/orby",
];

export default function EnterpriseWorkspaceShell({
  children,
  workspaceId,
  workspaceName,
  role,
  currency,
  subscriptionStatus,
  extension,
  specializationName,
  enabledModules,
  operatingMode,
  initialCompact,
  identity,
  serviceOptions,
}: {
  children: ReactNode;
  workspaceId: string;
  workspaceName: string;
  role: string;
  currency: string;
  subscriptionStatus: string;
  extension: VerticalExtension;
  specializationName: string;
  enabledModules: string[];
  operatingMode: OperatingMode;
  initialCompact: boolean;
  identity: ShellIdentity;
  serviceOptions: ShellServiceOption[];
}) {
  const groups = workspaceNavigationGroups(extension, enabledModules, operatingMode);
  const mobileItems = workspaceMobileNavigation(extension, enabledModules, operatingMode);
  const modeLabel = operatingMode === "MADAR_NATIVE"
    ? "تجارة منشأة على مَدار"
    : "تجارة مرتبطة بمَدار";

  return (
    <MadarGlobalShell
      identity={identity}
      context={{
        kind: "workspace",
        name: workspaceName,
        detail: modeLabel,
        meta: `${specializationName} · ${roleNames[role] || "عضو"} · ${subscriptionNames[subscriptionStatus] || subscriptionStatus}`,
        homeHref: "/workspace",
        currentOrganizationId: workspaceId,
        options: serviceOptions,
        links: [{ href: "/dashboard-app", label: "تطبيق لوحة القيادة", icon: "automation" }],
      }}
      navigationGroups={groups}
      mobileItems={mobileItems}
      orbyHref="/workspace/orby"
      initialCompact={initialCompact}
      persistCompact
      commandPalette
      nativeHeaderRoutes={routesWithNativeHeaders}
      moduleContext
      footerNote={`${currency} · بيانات المساحة معزولة`}
    >
      {children}
    </MadarGlobalShell>
  );
}
