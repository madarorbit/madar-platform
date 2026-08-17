import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { authorizeOrganizationAction } from "@/src/lib/platform-integrations";
import type { OperatingMode } from "@/src/lib/v2/account";
import type { VerticalExtension } from "@/src/lib/v2/verticals";
import { commercialWorkspaceCookie } from "@/src/lib/workspace-selection";
import {
  getShellServiceOptions,
  getShellSubscriptionRows,
  requireShellIdentity,
} from "@/src/lib/shell/server";

export type WorkspaceType = "INDIVIDUAL" | "MERCHANT" | "COMPANY";
export type WorkspaceRecord = {
  id: string;
  name: string;
  slug: string;
  type: WorkspaceType;
  status: string;
  currency: "YER" | "SAR" | "USD";
  operating_mode?: OperatingMode;
  source_of_truth?: "MADAR" | "EXTERNAL";
  setup_status?: "not_started" | "in_progress" | "ready" | "blocked";
  navigation_state?: { version?: number; compact?: boolean };
};
export type BusinessWorkspace = WorkspaceRecord & {
  type: WorkspaceType;
  operating_mode: OperatingMode;
  source_of_truth: "MADAR" | "EXTERNAL";
  setup_status: "not_started" | "in_progress" | "ready" | "blocked";
  navigation_state: { version?: number; compact?: boolean };
};
export type WorkspaceMembership = {
  role: "OWNER" | "ADMIN" | "MEMBER";
  organizations: WorkspaceRecord | WorkspaceRecord[] | null;
};
export type BusinessMembership = Omit<WorkspaceMembership, "organizations"> & {
  organizations: BusinessWorkspace;
};
export type WorkspaceSubscriptionStatus =
  | "active"
  | "past_due"
  | "expired"
  | "cancelled"
  | "missing";
export type WorkspaceSector = {
  profileId: string | null;
  specializationCode: string;
  specializationName: string;
  extension: VerticalExtension;
  terminology: Record<string, string>;
  enabledModules: string[];
};

type RequireBusinessWorkspaceOptions = {
  allowExpired?: boolean;
  allowMissing?: boolean;
  allowCancelled?: boolean;
};
const scalar = <T>(value: unknown) =>
  Array.isArray(value) ? (value[0] as T) : (value as T);
const organizationOf = (value: WorkspaceMembership["organizations"]) =>
  Array.isArray(value) ? value[0] : value;
const extensionFor = (code: string): VerticalExtension =>
  code === "RESTAURANT"
    ? "food_service"
    : code === "HOTEL"
      ? "hospitality"
      : "commerce";
const subscriptionStatuses: WorkspaceSubscriptionStatus[] = [
  "active",
  "past_due",
  "expired",
  "cancelled",
  "missing",
];

async function resolveBusinessWorkspace({
  allowExpired = false,
  allowMissing = false,
  allowCancelled = false,
}: RequireBusinessWorkspaceOptions = {}) {
  const shellIdentity = await requireShellIdentity("/workspace");
  const { user, profile } = shellIdentity;
  const selectedOrganization = (await cookies()).get(commercialWorkspaceCookie)?.value;
  const [rows, allServiceRows, serviceOptions] = await Promise.all([
    supabaseFetch(
      `/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,slug,type,status,currency,operating_mode,source_of_truth,setup_status,navigation_state)`,
    ),
    getShellSubscriptionRows(),
    getShellServiceOptions(),
  ]);
  const memberships = (rows || []) as WorkspaceMembership[];
  const subscriptions = allServiceRows.filter((row) =>
    ["CONNECT_EXISTING", "BUILD_ON_MADAR"].includes(row.service_code),
  ) as Array<{
    organization_id: string;
    service_code: "CONNECT_EXISTING" | "BUILD_ON_MADAR";
    status: string;
    activation_state: string;
    ends_at: string;
  }>;
  const eligible = subscriptions.filter((subscription) => {
    if (subscription.activation_state === "ACTIVE" && subscription.status === "active" && new Date(subscription.ends_at).getTime() > Date.now()) return true;
    if (allowExpired && (subscription.activation_state === "EXPIRED" || subscription.status === "expired" || new Date(subscription.ends_at).getTime() <= Date.now())) return true;
    if (allowCancelled && subscription.status === "cancelled") return true;
    return allowMissing;
  });
  const preferred = selectedOrganization || profile?.default_commercial_organization_id;
  const candidate =
    memberships.find(
      (row) => organizationOf(row.organizations)?.id === preferred && eligible.some((subscription) => subscription.organization_id === preferred),
    ) ||
    memberships.find(
      (row) => eligible.some((subscription) => subscription.organization_id === organizationOf(row.organizations)?.id),
    );
  const rawWorkspace = organizationOf(candidate?.organizations || null);
  if (!candidate || !rawWorkspace) redirect("/account");
  if (rawWorkspace.status !== "active") redirect("/account");
  const selectedSubscription = subscriptions.find((subscription) => subscription.organization_id === rawWorkspace.id);
  const workspace = {
      ...rawWorkspace,
      operating_mode: rawWorkspace.operating_mode || "MADAR_NATIVE",
      source_of_truth: rawWorkspace.source_of_truth || "MADAR",
      setup_status: rawWorkspace.setup_status || "ready",
      navigation_state: rawWorkspace.navigation_state || {
        version: 1,
        compact: false,
      },
    } as BusinessWorkspace,
    id = encodeURIComponent(rawWorkspace.id);
  const authorization = await authorizeOrganizationAction({
    internalAllowed: true,
    userId: user.id,
    organizationId: workspace.id,
    relation: "can_view",
  });
  if (!authorization.allowed) redirect("/account?error=forbidden");
  const [activityRows, moduleRows] =
    await Promise.all([
      supabaseFetch(
        `/rest/v1/activity_profiles?organization_id=eq.${id}&status=eq.active&select=id,activity_specializations(code,name_ar,terminology)&limit=1`,
      ).catch(() => []),
      supabaseFetch(
        `/rest/v1/organization_modules?organization_id=eq.${id}&status=eq.active&select=module_key`,
      ).catch(() => []),
    ]);
  const subscriptionStatus: WorkspaceSubscriptionStatus = !selectedSubscription
    ? "missing"
    : selectedSubscription.status === "cancelled"
      ? "cancelled"
      : selectedSubscription.status === "past_due"
        ? "past_due"
        : selectedSubscription.status === "expired" || new Date(selectedSubscription.ends_at).getTime() <= Date.now()
          ? "expired"
          : "active";
  if (!subscriptionStatuses.includes(subscriptionStatus))
    throw new Error("تعذر التحقق من حالة اشتراك خدمة مَدار.");
  if (subscriptionStatus === "missing" && !allowMissing)
    redirect("/account?service=missing");
  if (subscriptionStatus === "expired" && !allowExpired)
    redirect("/account?service=expired");
  if (subscriptionStatus === "cancelled" && !allowCancelled)
    redirect("/account?service=cancelled");
  const activity = activityRows?.[0] as
    | {
        id: string;
        activity_specializations:
          | {
              code: string;
              name_ar: string;
              terminology: Record<string, string>;
            }
          | Array<{
              code: string;
              name_ar: string;
              terminology: Record<string, string>;
            }>;
      }
    | undefined;
  const specialization = scalar<{
    code: string;
    name_ar: string;
    terminology: Record<string, string>;
  }>(activity?.activity_specializations) || {
    code: "GENERAL_COMMERCE",
    name_ar: "تجارة عامة",
    terminology: {},
  };
  const sector: WorkspaceSector = {
    profileId: activity?.id || null,
    specializationCode: specialization.code,
    specializationName: specialization.name_ar,
    extension: extensionFor(specialization.code),
    terminology: specialization.terminology || {},
    enabledModules: (moduleRows || []).map(
      (row: { module_key: string }) => row.module_key,
    ),
  };
  return {
    user,
    profile,
    membership: {
      ...candidate,
      organizations: workspace,
    } as BusinessMembership,
    workspace,
    subscriptionStatus,
    sector,
    shellIdentity: shellIdentity.shell,
    serviceOptions,
  };
}

const getDefaultBusinessWorkspace = cache(() => resolveBusinessWorkspace());

export function requireBusinessWorkspace(
  options?: RequireBusinessWorkspaceOptions,
) {
  return options &&
    (options.allowExpired || options.allowMissing || options.allowCancelled)
    ? resolveBusinessWorkspace(options)
    : getDefaultBusinessWorkspace();
}

export async function requireNativeBusinessWorkspace(requiredModule?: string) {
  const context = await requireBusinessWorkspace();
  if (context.workspace.operating_mode === "CONNECTED_EXTERNAL") redirect("/workspace/data");
  if (requiredModule && !context.sector.enabledModules.includes(requiredModule)) redirect("/workspace?module=unavailable");
  return context;
}

export async function requirePersonalAccount() {
  const shellIdentity = await requireShellIdentity("/account");
  const { user, profile } = shellIdentity;
  return { user, profile };
}
export function businessMoney(
  value: number | string | null | undefined,
  currency = "YER",
) {
  return new Intl.NumberFormat("ar-YE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
export function numberValue(
  value: FormDataEntryValue | null,
  label: string,
  { min = 0, allowZero = true }: { min?: number; allowZero?: boolean } = {},
) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (!allowZero && number === 0))
    throw new Error(`${label} غير صالح.`);
  return number;
}
