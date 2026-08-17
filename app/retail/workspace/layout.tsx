import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import GuidedLearningBoundary from "@/components/guided-learning/GuidedLearningBoundary";
import RetailWorkspaceShell from "@/components/retail-v0/layout/RetailWorkspaceShell";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import {
  getOptionalShellIdentity,
  getShellServiceOptions,
} from "@/src/lib/shell/server";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [{ user, workspace, role, subscription }, identity, serviceOptions] =
    await Promise.all([
      requireWorkspace(),
      getOptionalShellIdentity(),
      getShellServiceOptions(),
    ]);
  if (!identity) redirect("/login?next=/retail/workspace");
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
