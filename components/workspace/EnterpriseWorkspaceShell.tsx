import type { ReactNode } from "react";
import Link from "next/link";
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
  "/workspace/connect",
  "/workspace/data",
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
  setupStatus,
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
  setupStatus: "not_started" | "in_progress" | "ready" | "blocked";
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
      alert={setupStatus !== "ready" ? (
        <div className={`md-shell-status-alert ${setupStatus === "blocked" ? "is-danger" : ""}`} role="status">
          <span>{setupStatus === "blocked"
            ? "إعداد مساحة العمل متوقف ويحتاج مراجعة. افتح إعدادات النشاط لمعرفة الخطوة التالية."
            : operatingMode === "CONNECTED_EXTERNAL"
              ? "ربط النظام لم يكتمل بعد. ابدأ من مركز الربط ثم نفّذ أول مزامنة."
              : "إعداد النشاط غير مكتمل. أكمل البيانات الأساسية قبل الاعتماد على التقارير."}</span>
          <Link href={operatingMode === "CONNECTED_EXTERNAL" ? "/workspace/connect" : "/workspace/setup"} className="md-button md-button-ghost md-button-sm">
            {operatingMode === "CONNECTED_EXTERNAL" ? "فتح مركز الربط" : "استكمال الإعداد"}
          </Link>
        </div>
      ) : null}
    >
      <div className={`md-service-experience ${operatingMode === "CONNECTED_EXTERNAL" ? "md-service-connected" : "md-service-native"}`}>
        {children}
      </div>
    </MadarGlobalShell>
  );
}
