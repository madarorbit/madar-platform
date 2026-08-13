import type { ReactNode } from "react";
import RetailWorkspaceShell from "@/components/retail-v0/layout/RetailWorkspaceShell";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";
import { currentProfile, supabaseFetch } from "@/src/lib/supabase/server";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, workspace, role, subscription } = await requireWorkspace();
  const [profile, unreadRows] = await Promise.all([
    currentProfile(),
    supabaseFetch("/rest/v1/notifications?read_at=is.null&select=id").catch(() => []),
  ]);
  return (
    <RetailWorkspaceShell
      workspaceName={workspace.name}
      role={role}
      currency={workspace.currency}
      subscriptionStatus={subscription.status}
      planName={subscription.plan?.name_ar ?? "MADAR Retail"}
      platformOrganizationId={user.platformOrganizationId}
      isAdmin={user.platformRole === "ADMIN" || user.platformRole === "SUPER_ADMIN"}
      displayName={profile?.full_name || user.fullName || "حسابي"}
      hasAvatar={Boolean(profile?.avatar_url)}
      unread={unreadRows?.length || 0}
    >
      {children}
    </RetailWorkspaceShell>
  );
}
