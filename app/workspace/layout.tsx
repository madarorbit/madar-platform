import type { ReactNode } from "react";
import { requireBusinessWorkspace } from "@/src/lib/business";
import EnterpriseWorkspaceShell from "@/components/workspace/EnterpriseWorkspaceShell";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const {
    workspace,
    membership,
    subscriptionStatus,
    sector,
    shellIdentity,
    serviceOptions,
  } = await requireBusinessWorkspace();
  return (
    <EnterpriseWorkspaceShell
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      role={membership.role}
      currency={workspace.currency}
      subscriptionStatus={subscriptionStatus}
      extension={sector.extension}
      specializationName={sector.specializationName}
      enabledModules={sector.enabledModules}
      operatingMode={workspace.operating_mode}
      setupStatus={workspace.setup_status}
      initialCompact={Boolean(workspace.navigation_state.compact)}
      identity={shellIdentity}
      serviceOptions={serviceOptions}
    >
      {children}
    </EnterpriseWorkspaceShell>
  );
}
