import type { ReactNode } from "react";
import AccountShell from "@/components/account/AccountShell";
import { requireUser } from "@/src/lib/auth";
import { currentProfile, supabaseFetch } from "@/src/lib/supabase/server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [user, profile, unreadRows] = await Promise.all([
    requireUser(),
    currentProfile(),
    supabaseFetch("/rest/v1/notifications?read_at=is.null&select=id").catch(() => []),
  ]);
  const displayName = profile?.full_name || user.email?.split("@")[0] || "حسابي";
  return (
    <AccountShell
      displayName={displayName}
      email={user.email || profile?.email || ""}
      hasAvatar={Boolean(profile?.avatar_url)}
      isAdmin={profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN"}
      unread={unreadRows?.length || 0}
    >
      {children}
    </AccountShell>
  );
}
