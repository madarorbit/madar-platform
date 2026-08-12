import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import {
  currentProfile,
  currentUser,
  profileForUser,
  supabaseFetch,
  type Profile,
} from "@/src/lib/supabase/server";
import {
  authorizeOrganizationAction,
  type MadarOrganizationRelation,
} from "@/src/lib/platform-integrations/openfga";
import { createClient } from "@/src/lib/retail/supabase/server";
import type { RetailWorkspace, WorkspaceRole } from "@/src/lib/retail/types";

export interface UserContext {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  platformRole: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
}

export interface RetailPrincipal extends UserContext {
  platformOrganizationId: string;
  platformOrganizationName: string;
  platformMembershipRole: "OWNER" | "ADMIN" | "MEMBER";
  retailRole: WorkspaceRole;
}

type Organization = {
  id: string;
  name: string;
  type: "INDIVIDUAL" | "MERCHANT" | "COMPANY";
  status: string;
};

type ServiceSubscription = {
  organization_id: string;
  ends_at: string;
  organizations: Organization | Organization[] | null;
};

function scalar<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function retailRoleFor(role: RetailPrincipal["platformMembershipRole"]): WorkspaceRole {
  if (role === "OWNER") return "OWNER";
  if (role === "ADMIN") return "MANAGER";
  return "STAFF";
}

function userContext(id: string, email: string | null, profile: Profile): UserContext {
  return {
    id,
    email,
    fullName: profile.full_name,
    phone: profile.phone,
    platformRole:
      profile.role === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : profile.role === "ADMIN"
          ? "ADMIN"
          : "CUSTOMER",
  };
}

async function resolveUserContext(accessToken?: string): Promise<UserContext | null> {
  const user = await currentUser(accessToken);
  if (!user) return null;
  const profile = accessToken
    ? await profileForUser(user.id, accessToken)
    : await currentProfile();
  if (!profile || profile.status !== "active") return null;
  return userContext(user.id, user.email ?? profile.email, profile);
}

async function resolveRetailPrincipal(accessToken?: string): Promise<RetailPrincipal | null> {
  const user = await currentUser(accessToken);
  if (!user) return null;
  const profile = accessToken
    ? await profileForUser(user.id, accessToken)
    : await currentProfile();
  if (!profile || profile.status !== "active") return null;

  const rows = (await supabaseFetch(
    `/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&service_code=eq.MADAR_RETAIL&status=eq.active&activation_state=eq.ACTIVE&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=organization_id,ends_at,organizations(id,name,type,status)&order=created_at.desc&limit=1`,
    {},
    accessToken,
  ).catch(() => [])) as ServiceSubscription[];
  const subscription = rows[0];
  const organization = scalar(subscription?.organizations ?? null);
  if (!subscription || !organization || organization.status !== "active") {
    return null;
  }

  const authorization = await authorizeOrganizationAction({
    internalAllowed: true,
    userId: user.id,
    organizationId: organization.id,
    relation: "can_view",
  });
  if (!authorization.allowed) return null;

  return {
    ...userContext(user.id, user.email ?? profile.email, profile),
    platformOrganizationId: organization.id,
    platformOrganizationName: organization.name,
    platformMembershipRole: "OWNER",
    retailRole: retailRoleFor("OWNER"),
  };
}

export const getUserContext = cache(() => resolveUserContext());
export const getRetailPrincipal = cache(() => resolveRetailPrincipal());

export function getRetailPrincipalForAccessToken(accessToken: string) {
  return resolveRetailPrincipal(accessToken);
}

export async function authorizeRetailCapability(
  principal: RetailPrincipal,
  relation: MadarOrganizationRelation,
  internalAllowed = true,
) {
  const authorization = await authorizeOrganizationAction({
    internalAllowed,
    userId: principal.id,
    organizationId: principal.platformOrganizationId,
    relation,
  });
  return authorization.allowed;
}

function bearerToken(request: Request) {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function authorizeRetailRequest(request: Request, workspaceId: string) {
  const token = bearerToken(request);
  const principal = token
    ? await getRetailPrincipalForAccessToken(token)
    : await getRetailPrincipal();
  if (!principal) return null;
  const client = createClient();
  const { data: workspace, error } = await client
    .from("retail_workspaces")
    .select("id,name,currency,timezone,status")
    .eq("id", workspaceId)
    .eq("platform_organization_id", principal.platformOrganizationId)
    .maybeSingle();
  if (error) throw error;
  return workspace ? { principal, workspace, accessToken: token } : null;
}

export async function requireUser() {
  const principal = await getRetailPrincipal();
  if (!principal) {
    const platformUser = await getUserContext();
    if (!platformUser) redirect("/login?next=/account");
    redirect("/account");
  }
  return principal;
}

/** Synchronizes the trusted Platform identity only from an authenticated server mutation. */
export async function syncRetailIdentity(
  user: UserContext,
  principal?: RetailPrincipal,
) {
  const client = createClient();
  const { error: profileError } = await client.from("retail_profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
      platform_role: user.platformRole,
      status: "active",
      identity_source: "MADAR_PLATFORM",
    },
    { onConflict: "id" },
  );
  if (profileError) throw profileError;
  if (!principal) return null;

  const { data: workspace, error: workspaceError } = await client
    .from("retail_workspaces")
    .select("id")
    .eq("platform_organization_id", principal.platformOrganizationId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) return null;

  const [{ error: memberError }, { error: activeError }] = await Promise.all([
    client.from("retail_workspace_members").upsert(
      {
        workspace_id: workspace.id,
        user_id: principal.id,
        role: principal.retailRole,
        status: "active",
      },
      { onConflict: "workspace_id,user_id" },
    ),
    client.from("retail_profiles").update({ active_workspace_id: workspace.id }).eq("id", principal.id),
  ]);
  if (memberError) throw memberError;
  if (activeError) throw activeError;
  return workspace.id as string;
}

export interface WorkspaceContext {
  user: RetailPrincipal;
  workspace: RetailWorkspace;
  role: WorkspaceRole;
  subscription: {
    status: string;
    trial_ends_at: string | null;
    ends_at: string | null;
    grace_ends_at: string | null;
    plan: { name_ar: string; limits: Record<string, unknown> } | null;
  };
}

export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const principal = await getRetailPrincipal();
  if (!principal) return null;
  const client = createClient();
  const { data: workspace, error: workspaceError } = await client
    .from("retail_workspaces")
    .select("id,name,currency,timezone,subtype,allow_credit_sales,invoice_prefix,status")
    .eq("platform_organization_id", principal.platformOrganizationId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) return null;

  // Federation is idempotent and keeps Retail's internal actor/membership rows
  // aligned with the authoritative MADAR organization role on first access.
  await syncRetailIdentity(principal, principal);

  const { data: subscription, error: subscriptionError } = await client
    .from("retail_subscriptions")
    .select("status,trial_ends_at,ends_at,grace_ends_at,plans:retail_plans(name_ar,limits)")
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription) return null;
  const planValue = scalar(subscription.plans);

  return {
    user: principal,
    workspace: workspace as RetailWorkspace,
    role: principal.retailRole,
    subscription: {
      status: subscription.status,
      trial_ends_at: subscription.trial_ends_at,
      ends_at: subscription.ends_at,
      grace_ends_at: subscription.grace_ends_at,
      plan: planValue
        ? {
            name_ar: planValue.name_ar,
            limits: (planValue.limits ?? {}) as Record<string, unknown>,
          }
        : null,
    },
  };
});

export async function requireWorkspace() {
  const user = await requireUser();
  const context = await getWorkspaceContext();
  if (!context) redirect("/account");
  return { ...context, user };
}

export async function assertRetailWorkspaceAccess(workspaceId: string) {
  const context = await getWorkspaceContext();
  if (!context || context.workspace.id !== workspaceId) {
    throw new Error("RETAIL_WORKSPACE_FORBIDDEN");
  }
  return context;
}

export async function requirePlatformAdmin() {
  const user = await getUserContext();
  if (!user) redirect("/login?next=/admin/retail");
  if (user.platformRole !== "ADMIN" && user.platformRole !== "SUPER_ADMIN") {
    redirect("/retail/workspace");
  }
  return user;
}
