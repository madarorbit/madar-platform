import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import {
  currentUserState,
  profileForUser,
  supabaseFetch,
  type AuthUser,
  type Profile,
} from "@/src/lib/supabase/server";
import { isServiceCode, serviceDefinition, type ServiceCode } from "@/src/lib/services/catalog";
import type { ShellIdentity, ShellNotification, ShellServiceOption } from "@/src/lib/ux/shell";

type NotificationRow = { id: string; title: string; body: string; link: string | null; created_at: string; read_at: string | null };
type OrganizationRow = { id: string; name: string; status: string; operating_mode?: "MADAR_NATIVE" | "CONNECTED_EXTERNAL" | null };

export type ShellSubscriptionRow = {
  organization_id: string;
  service_code: ServiceCode;
  status: string;
  activation_state: string;
  ends_at: string;
  organizations: OrganizationRow | OrganizationRow[] | null;
};

export type ShellServerIdentity = { userId: string; role: string; user: AuthUser; profile: Profile | null; shell: ShellIdentity };
export type ShellIdentityState =
  | { status: "authenticated"; identity: ShellServerIdentity }
  | { status: "unauthenticated" }
  | { status: "recovering" };
const nested = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value;
const safeNotificationHref = (value: string | null) => value?.startsWith("/") && !value.startsWith("//") ? value : "/account/notifications";
const safeReturnPath = (value: string) => value.startsWith("/") && !value.startsWith("//") ? value : "/account";
export const sessionRecoveryHref = (nextPath: string) => `/auth/recover?next=${encodeURIComponent(safeReturnPath(nextPath))}`;
const loginHref = (nextPath: string) => `/login?next=${encodeURIComponent(safeReturnPath(nextPath))}`;

export const getShellIdentityState = cache(async (): Promise<ShellIdentityState> => {
  const auth = await currentUserState();
  if (auth.status !== "authenticated") return { status: auth.status };
  const user = auth.user;
  const [profileValue, unreadRows, notificationRows] = await Promise.all([
    profileForUser(user.id).catch(() => null),
    supabaseFetch("/rest/v1/notifications?read_at=is.null&select=id").catch(() => []),
    supabaseFetch("/rest/v1/notifications?select=id,title,body,link,created_at,read_at&order=created_at.desc&limit=5").catch(() => []),
  ]);
  const profile = profileValue ?? null;
  const notifications = (notificationRows as NotificationRow[]).map((item): ShellNotification => ({
    id: item.id,
    title: item.title,
    body: item.body,
    href: safeNotificationHref(item.link),
    createdAt: item.created_at,
    read: Boolean(item.read_at),
  }));
  const identity: ShellServerIdentity = {
    user,
    profile,
    userId: user.id,
    role: profile?.role || "CUSTOMER",
    shell: {
      accountId: user.id,
      displayName: profile?.full_name || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user.email?.split("@")[0] || "حسابي",
      email: user.email || profile?.email || "",
      hasAvatar: Boolean(profile?.avatar_url),
      isAdmin: profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN",
      unread: unreadRows?.length || 0,
      notifications,
    },
  };
  return { status: "authenticated", identity };
});

/** Optional presentation identity. A recovering session is not a guest session; it is simply unavailable for this public render. */
export const getOptionalShellIdentity = cache(async (): Promise<ShellServerIdentity | null> => {
  const state = await getShellIdentityState();
  return state.status === "authenticated" ? state.identity : null;
});

/** Protected rendering boundary: invalid sessions go to login; transient verification goes to bounded recovery. */
export async function requireShellIdentity(nextPath: string): Promise<ShellServerIdentity> {
  const state = await getShellIdentityState();
  if (state.status === "recovering") redirect(sessionRecoveryHref(nextPath));
  if (state.status === "unauthenticated") redirect(loginHref(nextPath));
  return state.identity;
}

export const getShellSubscriptionRows = cache(async (): Promise<ShellSubscriptionRow[]> => {
  const identity = await getOptionalShellIdentity();
  if (!identity) return [];
  const rows = await supabaseFetch(`/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(identity.userId)}&select=organization_id,service_code,status,activation_state,ends_at,organizations(id,name,status,operating_mode)&order=created_at.desc`).catch(() => []);
  return (rows || []).filter((row: ShellSubscriptionRow) => isServiceCode(row.service_code)) as ShellSubscriptionRow[];
});

export const getShellServiceOptions = cache(async (): Promise<ShellServiceOption[]> => {
  const now = Date.now();
  const rows = await getShellSubscriptionRows();
  return rows.flatMap((row) => {
    const organization = nested(row.organizations);
    if (!organization || organization.status !== "active" || row.status !== "active" || row.activation_state !== "ACTIVE" || new Date(row.ends_at).getTime() <= now) return [];
    const definition = serviceDefinition(row.service_code);
    const kind = row.service_code === "MADAR_RETAIL" ? "retail" : row.service_code === "CONNECT_EXISTING" ? "connected" : "native";
    return [{
      organizationId: row.organization_id,
      workspaceName: organization.name || definition.shortName,
      serviceCode: row.service_code,
      serviceName: definition.shortName,
      href: row.service_code === "MADAR_RETAIL" ? definition.openHref : `/account/workspaces/${encodeURIComponent(row.organization_id)}/open`,
      kind,
    } satisfies ShellServiceOption];
  });
});
