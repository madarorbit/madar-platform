import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/src/lib/auth";
import { currentProfile, supabaseFetch } from "@/src/lib/supabase/server";
import type { OperatingMode } from "@/src/lib/v2/account";
import type { VerticalExtension } from "@/src/lib/v2/verticals";

export type WorkspaceType = "INDIVIDUAL" | "MERCHANT" | "COMPANY" | "STUDENT";
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
  type: Exclude<WorkspaceType, "STUDENT">;
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
  | "trialing"
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
  "trialing",
  "active",
  "past_due",
  "expired",
  "cancelled",
  "missing",
];

export async function requireBusinessWorkspace({
  allowExpired = false,
  allowMissing = false,
  allowCancelled = false,
}: RequireBusinessWorkspaceOptions = {}) {
  const user = await requireUser(),
    profile = await currentProfile();
  if (profile?.account_type === "PERSONAL") redirect("/student");
  const rows = await supabaseFetch(
    `/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,slug,type,status,currency,operating_mode,source_of_truth,setup_status,navigation_state)`,
  );
  const memberships = (rows || []) as WorkspaceMembership[],
    preferred = profile?.default_commercial_organization_id;
  const candidate =
    memberships.find(
      (row) => organizationOf(row.organizations)?.id === preferred,
    ) ||
    memberships.find(
      (row) => organizationOf(row.organizations)?.type !== "STUDENT",
    );
  const rawWorkspace = organizationOf(candidate?.organizations || null);
  if (!candidate || !rawWorkspace || rawWorkspace.type === "STUDENT")
    redirect(profile?.account_type === "BUSINESS" ? "/onboarding" : "/student");
  if (rawWorkspace.status !== "active") redirect("/dashboard");
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
  const [resolvedSubscriptionStatus, activityRows, moduleRows] =
    await Promise.all([
      supabaseFetch("/rest/v1/rpc/resolve_pricing_subscription_status", {
        method: "POST",
        body: JSON.stringify({ target_organization: workspace.id }),
      }),
      supabaseFetch(
        `/rest/v1/activity_profiles?organization_id=eq.${id}&status=eq.active&select=id,activity_specializations(code,name_ar,terminology)&limit=1`,
      ).catch(() => []),
      supabaseFetch(
        `/rest/v1/organization_modules?organization_id=eq.${id}&status=eq.active&select=module_key`,
      ).catch(() => []),
    ]);
  const subscriptionStatus = scalar<WorkspaceSubscriptionStatus>(
    resolvedSubscriptionStatus,
  );
  if (!subscriptionStatuses.includes(subscriptionStatus))
    throw new Error("تعذر التحقق من حالة اشتراك مَدار V2.0.");
  if (subscriptionStatus === "missing" && !allowMissing)
    redirect("/account/subscription?missing=1");
  if (subscriptionStatus === "expired" && !allowExpired)
    redirect("/account/subscription?expired=1");
  if (subscriptionStatus === "cancelled" && !allowCancelled)
    redirect("/account/subscription?cancelled=1");
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
  };
}

export async function requirePersonalAccount() {
  const user = await requireUser(),
    profile = await currentProfile();
  if (profile?.account_type === "BUSINESS") redirect("/workspace");
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
