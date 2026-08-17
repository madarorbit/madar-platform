import type { ReactNode } from "react";
import GuidedLearningBoundary from "@/components/guided-learning/GuidedLearningBoundary";
import RetailWorkspaceShell from "@/components/retail-v0/layout/RetailWorkspaceShell";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import {
  getShellServiceOptions,
  requireShellIdentity,
} from "@/src/lib/shell/server";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  // Resolve the account session once before Retail constructs its protected context.
  // React's cached shell state is then reused by Retail instead of racing a second /auth/v1/user call.
  const identity = await requireShellIdentity("/retail/workspace");
  const [{ user, workspace, role, subscription }, serviceOptions] = await Promise.all([
    requireWorkspace(),
    getShellServiceOptions(),
  ]);
  return (
    <GuidedLearningBoundary accountId={identity.userId}>
      <RetailWorkspaceShell
        workspaceName={workspace.name}
        role={role}
        currency={workspace.currency}
        subscriptionStatus={subscription.status}
        planName={subscription.plan?.name_ar ?? "MADAR Retail"}
        platformOrganizationId={user.platformOrganizationId}
        identity={identity.shell}
        serviceOptions={serviceOptions}
      >
        {children}
      </RetailWorkspaceShell>
    </GuidedLearningBoundary>
  );
}
