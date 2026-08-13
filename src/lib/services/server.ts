import "server-only";

import { cache } from "react";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { getOptionalShellIdentity } from "@/src/lib/shell/server";
import {
  serviceDefinition,
  services,
  type ServiceCode,
  type ServiceState,
} from "@/src/lib/services/catalog";

type PlanRow = {
  id: string;
  service_code: ServiceCode;
  name: string;
  description: string | null;
  price: number | string;
  currency: string;
  billing_months: number;
  grace_days: number;
  is_active: boolean;
  is_available: boolean;
};

type RequestRow = {
  id: string;
  service_code: ServiceCode;
  request_kind: "ACTIVATION" | "RENEWAL";
  status: "pending_payment" | "pending_review" | "approved" | "rejected";
  onboarding_state: string;
  rejection_reason: string | null;
  organization_id: string | null;
  created_at: string;
};

export type ServiceSubscriptionRow = {
  id: string;
  user_id: string;
  service_code: ServiceCode;
  organization_id: string;
  status: string;
  activation_state: string;
  starts_at: string;
  ends_at: string;
  grace_ends_at: string | null;
  external_workspace_id: string | null;
  suspension_reason: string | null;
};

export type AccountService = {
  definition: ReturnType<typeof serviceDefinition>;
  state: ServiceState;
  href: string | null;
  plan: PlanRow | null;
  request: RequestRow | null;
  subscription: ServiceSubscriptionRow | null;
};

const latestByService = <T extends { service_code: ServiceCode; created_at?: string }>(rows: T[]) => {
  const values = new Map<ServiceCode, T>();
  for (const row of rows) if (!values.has(row.service_code)) values.set(row.service_code, row);
  return values;
};

function resolveState(subscription: ServiceSubscriptionRow | null, request: RequestRow | null): ServiceState {
  if (subscription) {
    if (subscription.activation_state === "SUSPENDED" || subscription.status === "suspended") return "SUSPENDED";
    if (
      subscription.activation_state === "EXPIRED" ||
      subscription.status === "expired" ||
      new Date(subscription.ends_at).getTime() <= Date.now()
    ) return "EXPIRED";
    if (subscription.activation_state === "ACTIVE" && subscription.status === "active") return "ACTIVE";
    if (subscription.activation_state === "PROVISIONING" || subscription.status === "provisioning") return "PENDING_APPROVAL";
  }
  if (request?.status === "pending_payment") return "SETUP_REQUIRED";
  if (request?.status === "pending_review" || request?.onboarding_state === "PROVISIONING") return "PENDING_APPROVAL";
  if (request?.status === "rejected") return "REJECTED";
  return "NOT_SUBSCRIBED";
}

function serviceHref(code: ServiceCode, state: ServiceState, request: RequestRow | null) {
  if (state === "ACTIVE") return serviceDefinition(code).openHref;
  if (state === "SETUP_REQUIRED" && request?.status === "pending_payment") return `/workspace-payment/${request.id}`;
  if (state === "PENDING_APPROVAL") return `/account/services/${code}/setup`;
  return `/account/services/${code}/setup`;
}

export const getAccountServices = cache(async (): Promise<AccountService[]> => {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const user = identity.user;
  const [planRows, requestRows, subscriptionRows] = await Promise.all([
    supabaseFetch(
      "/rest/v1/subscription_plans?select=id,service_code,name,description,price,currency,billing_months,grace_days,is_active,is_available&order=created_at",
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/workspace_requests?user_id=eq.${encodeURIComponent(user.id)}&select=id,service_code,request_kind,status,onboarding_state,rejection_reason,organization_id,created_at&order=created_at.desc`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,service_code,organization_id,status,activation_state,starts_at,ends_at,grace_ends_at,external_workspace_id,suspension_reason&order=created_at.desc`,
    ).catch(() => []),
  ]);
  const plans = latestByService((planRows || []) as PlanRow[]);
  const requests = latestByService((requestRows || []) as RequestRow[]);
  const subscriptions = latestByService((subscriptionRows || []) as (ServiceSubscriptionRow & { created_at?: string })[]);
  return services.map((definition) => {
    const subscription = subscriptions.get(definition.code) || null;
    const request = requests.get(definition.code) || null;
    const state = resolveState(subscription, request);
    return {
      definition,
      state,
      href: serviceHref(definition.code, state, request),
      plan: plans.get(definition.code) || null,
      request,
      subscription,
    };
  });
});

export async function getServiceSetupContext(code: ServiceCode) {
  const [identity, accountServices] = await Promise.all([getOptionalShellIdentity(), getAccountServices()]);
  const service = accountServices.find((item) => item.definition.code === code);
  if (!service) throw new Error("SERVICE_NOT_FOUND");
  return { profile: identity?.profile || null, service };
}

export async function activeServiceSubscription(code: ServiceCode) {
  const identity = await getOptionalShellIdentity();
  if (!identity) return null;
  const user = identity.user;
  const rows = (await supabaseFetch(
    `/rest/v1/workspace_subscriptions?user_id=eq.${encodeURIComponent(user.id)}&service_code=eq.${code}&status=eq.active&activation_state=eq.ACTIVE&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,service_code,organization_id,status,activation_state,starts_at,ends_at,grace_ends_at,external_workspace_id,suspension_reason&order=created_at.desc&limit=1`,
  ).catch(() => [])) as ServiceSubscriptionRow[];
  return rows?.[0] || null;
}
