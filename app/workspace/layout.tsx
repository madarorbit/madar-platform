import type { ReactNode } from "react";
import { requireBusinessWorkspace } from "@/src/lib/business";
import EnterpriseWorkspaceShell from "@/components/workspace/EnterpriseWorkspaceShell";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { workspace, membership, subscriptionStatus, sector } =
    await requireBusinessWorkspace();
  return (
    <EnterpriseWorkspaceShell
      workspaceName={workspace.name}
      role={membership.role}
      currency={workspace.currency}
      subscriptionStatus={subscriptionStatus}
      extension={sector.extension}
      specializationName={sector.specializationName}
      enabledModules={sector.enabledModules}
      operatingMode={workspace.operating_mode}
      initialCompact={Boolean(workspace.navigation_state.compact)}
    >
      {children}
    </EnterpriseWorkspaceShell>
  );
}
