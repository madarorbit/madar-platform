import type { ReactNode } from "react";
import RetailWorkspaceShell from "@/components/retail-v0/layout/RetailWorkspaceShell";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, workspace, role, subscription } = await requireWorkspace();
  return (
    <RetailWorkspaceShell
      workspaceName={workspace.name}
      role={role}
      currency={workspace.currency}
      subscriptionStatus={subscription.status}
      planName={subscription.plan?.name_ar ?? "MADAR Retail"}
      platformOrganizationId={user.platformOrganizationId}
      isAdmin={user.platformRole === "ADMIN" || user.platformRole === "SUPER_ADMIN"}
    >
      {children}
    </RetailWorkspaceShell>
  );
}
