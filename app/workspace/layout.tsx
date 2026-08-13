import type { ReactNode } from "react";
import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import EnterpriseWorkspaceShell from "@/components/workspace/EnterpriseWorkspaceShell";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { workspace, membership, subscriptionStatus, sector, profile } =
    await requireBusinessWorkspace();
  const unreadRows = await supabaseFetch("/rest/v1/notifications?read_at=is.null&select=id").catch(() => []);
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
      displayName={profile?.full_name || "حسابي"}
      hasAvatar={Boolean(profile?.avatar_url)}
      isAdmin={profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN"}
      unread={unreadRows?.length || 0}
    >
      {children}
    </EnterpriseWorkspaceShell>
  );
}
