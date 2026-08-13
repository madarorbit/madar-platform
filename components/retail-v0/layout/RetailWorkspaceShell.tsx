import type { ReactNode } from "react";
import MadarGlobalShell from "@/components/shell/MadarGlobalShell";
import {
  retailMobileNavigation,
  retailNavigationGroups,
} from "@/src/lib/ux/platform-navigation";
import type { ShellIdentity, ShellServiceOption } from "@/src/lib/ux/shell";

const roleNames: Record<string, string> = {
  OWNER: "المالك",
  MANAGER: "مدير",
  STAFF: "موظف",
  VIEWER: "مشاهد",
};

const statusNames: Record<string, string> = {
  active: "نشط",
  trialing: "تجريبي",
  grace: "مهلة سماح",
  expired: "منتهي",
  suspended: "موقوف",
  cancelled: "ملغى",
};

export default function RetailWorkspaceShell({
  children,
  workspaceName,
  role,
  currency,
  subscriptionStatus,
  planName,
  platformOrganizationId,
  identity,
  serviceOptions,
}: {
  children: ReactNode;
  workspaceName: string;
  role: string;
  currency: string;
  subscriptionStatus: string;
  planName: string;
  platformOrganizationId: string;
  identity: ShellIdentity;
  serviceOptions: ShellServiceOption[];
}) {
  const inactive = ["expired", "suspended", "cancelled"].includes(subscriptionStatus);
  return (
    <MadarGlobalShell
      identity={identity}
      context={{
        kind: "retail",
        name: workspaceName,
        detail: "MADAR Retail",
        meta: `${roleNames[role] || role} · ${statusNames[subscriptionStatus] || subscriptionStatus} · ${planName}`,
        homeHref: "/retail/workspace",
        currentOrganizationId: platformOrganizationId,
        options: serviceOptions,
      }}
      navigationGroups={retailNavigationGroups}
      mobileItems={retailMobileNavigation}
      orbyHref={`/orby?conversation=new&organization=${encodeURIComponent(platformOrganizationId)}&service=MADAR_RETAIL`}
      footerNote={`${currency} · بيانات Retail معزولة`}
      alert={inactive ? (
        <div className="md-shell-status-alert" role="status">
          الاشتراك غير نشط. بيانات تجارتك محفوظة، ويمكنك متابعة التجديد من الاشتراكات.
        </div>
      ) : null}
    >
      {children}
    </MadarGlobalShell>
  );
}
