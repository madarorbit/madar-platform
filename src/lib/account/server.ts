import "server-only";

import { cache } from "react";
import { getAccountServices, type AccountService } from "@/src/lib/services/server";
import { getOptionalShellIdentity, type ShellServerIdentity } from "@/src/lib/shell/server";
import { supabaseFetch } from "@/src/lib/supabase/server";

export type OrbyUsage = {
  tier?: "registered" | "customer" | "plus";
  remaining?: number;
  daily_limit?: number;
};

export type StoreOrderSummary = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number | string;
  currency: string;
  payment_amount?: number | string | null;
  payment_currency?: string | null;
  created_at: string;
};

export type LibraryItemSummary = {
  id: string;
  product_name: string;
  thumbnail_path: string | null;
  original_amount: number | string;
  original_currency: string;
  purchased_at: string;
};

export type OrbyPlusSubscription = {
  status: string;
  starts_at: string;
  ends_at: string;
};

export type OrbyPlusPayment = {
  id: string;
  status: string;
  payment_amount: number | string;
  payment_currency: string;
  payment_reference: string;
  review_note: string | null;
  created_at: string;
};

export type AccountPayment = {
  id: string;
  source: "store" | "service" | "renewal" | "orby" | "retail";
  label: string;
  status: string;
  amount: number | string;
  currency: string;
  reference: string | null;
  createdAt: string;
  href: string;
  note?: string | null;
};

export type AccountSection<T> = { data: T; failed: boolean };

async function section<T>(operation: Promise<T>, fallback: T): Promise<AccountSection<T>> {
  try {
    return { data: await operation, failed: false };
  } catch {
    return { data: fallback, failed: true };
  }
}

function first<T>(value: unknown): T | null {
  return Array.isArray(value) ? (value[0] as T | undefined) || null : null;
}

export type AccountHomeData = {
  identity: ShellServerIdentity;
  services: AccountService[];
  usage: AccountSection<OrbyUsage | null>;
  orders: AccountSection<StoreOrderSummary[]>;
  library: AccountSection<LibraryItemSummary[]>;
  plusSubscription: AccountSection<OrbyPlusSubscription | null>;
  plusPayment: AccountSection<OrbyPlusPayment | null>;
};

export type OrbyAccountData = {
  usage: AccountSection<OrbyUsage | null>;
  subscription: AccountSection<OrbyPlusSubscription | null>;
  payment: AccountSection<OrbyPlusPayment | null>;
};

export const getOrbyAccountData = cache(async (): Promise<OrbyAccountData> => {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const userId = encodeURIComponent(identity.userId);
  const [usage, subscription, payment] = await Promise.all([
    section(
      supabaseFetch("/rest/v1/rpc/orby_usage_status", { method: "POST", body: "{}" }).then((rows) =>
        Array.isArray(rows) ? ((rows[0] as OrbyUsage | undefined) || null) : (rows as OrbyUsage | null),
      ),
      null,
    ),
    section(
      supabaseFetch(`/rest/v1/orby_plus_subscriptions?user_id=eq.${userId}&select=status,starts_at,ends_at&order=created_at.desc&limit=1`).then((rows) => first<OrbyPlusSubscription>(rows)),
      null,
    ),
    section(
      supabaseFetch(`/rest/v1/orby_plus_payment_requests?user_id=eq.${userId}&select=id,status,payment_amount,payment_currency,payment_reference,review_note,created_at&order=created_at.desc&limit=1`).then((rows) => first<OrbyPlusPayment>(rows)),
      null,
    ),
  ]);
  return { usage, subscription, payment };
});

export const getAccountHomeData = cache(async (): Promise<AccountHomeData> => {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const userId = encodeURIComponent(identity.userId);
  const [services, usage, orders, library, plusSubscription, plusPayment] = await Promise.all([
    getAccountServices(),
    section(
      supabaseFetch("/rest/v1/rpc/orby_usage_status", { method: "POST", body: "{}" }).then((rows) =>
        Array.isArray(rows) ? ((rows[0] as OrbyUsage | undefined) || null) : (rows as OrbyUsage | null),
      ),
      null,
    ),
    section(
      supabaseFetch(
        `/rest/v1/orders?user_id=eq.${userId}&select=id,order_number,status,payment_status,total,currency,payment_amount,payment_currency,created_at&order=created_at.desc&limit=3`,
      ) as Promise<StoreOrderSummary[]>,
      [],
    ),
    section(
      supabaseFetch(
        `/rest/v1/product_entitlements?user_id=eq.${userId}&select=id,product_name,thumbnail_path,original_amount,original_currency,purchased_at&order=purchased_at.desc&limit=3`,
      ) as Promise<LibraryItemSummary[]>,
      [],
    ),
    section(
      supabaseFetch(
        `/rest/v1/orby_plus_subscriptions?user_id=eq.${userId}&select=status,starts_at,ends_at&order=created_at.desc&limit=1`,
      ).then((rows) => first<OrbyPlusSubscription>(rows)),
      null,
    ),
    section(
      supabaseFetch(
        `/rest/v1/orby_plus_payment_requests?user_id=eq.${userId}&select=id,status,payment_amount,payment_currency,payment_reference,review_note,created_at&order=created_at.desc&limit=1`,
      ).then((rows) => first<OrbyPlusPayment>(rows)),
      null,
    ),
  ]);
  return { identity, services, usage, orders, library, plusSubscription, plusPayment };
});

type BasicPaymentRow = {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  payment_reference: string | null;
  review_note?: string | null;
  created_at: string;
  workspace_request_id?: string;
};

export const getAccountPayments = cache(async (): Promise<AccountSection<AccountPayment[]>> => {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const userId = encodeURIComponent(identity.userId);
  const result = await Promise.all([
    section(
      supabaseFetch(
        `/rest/v1/orders?user_id=eq.${userId}&select=id,order_number,status,payment_status,total,currency,payment_amount,payment_currency,payment_reference,created_at&order=created_at.desc`,
      ) as Promise<Array<StoreOrderSummary & { payment_reference: string | null }>>,
      [],
    ),
    section(
      supabaseFetch(
        `/rest/v1/workspace_payment_submissions?user_id=eq.${userId}&select=id,workspace_request_id,status,amount,currency,payment_reference,review_note,created_at&order=created_at.desc`,
      ) as Promise<BasicPaymentRow[]>,
      [],
    ),
    section(
      supabaseFetch(
        `/rest/v1/subscription_renewal_requests?user_id=eq.${userId}&select=id,status,amount,currency,payment_reference,review_note,created_at&order=created_at.desc`,
      ) as Promise<BasicPaymentRow[]>,
      [],
    ),
    section(
      supabaseFetch(
        `/rest/v1/orby_plus_payment_requests?user_id=eq.${userId}&select=id,status,payment_amount,payment_currency,payment_reference,review_note,created_at&order=created_at.desc`,
      ) as Promise<OrbyPlusPayment[]>,
      [],
    ),
    section(
      supabaseFetch(
        `/rest/v1/retail_payment_requests?requested_by=eq.${userId}&select=id,status,amount,currency,payment_reference,review_note,created_at&order=created_at.desc`,
      ) as Promise<BasicPaymentRow[]>,
      [],
    ),
  ]);

  const [orders, services, renewals, orby, retail] = result;
  const payments: AccountPayment[] = [
    ...orders.data.map((item) => ({
      id: item.id,
      source: "store" as const,
      label: `طلب المتجر ${item.order_number}`,
      status: item.payment_status,
      amount: item.payment_amount ?? item.total,
      currency: item.payment_currency || item.currency,
      reference: item.payment_reference,
      createdAt: item.created_at,
      href: `/account/orders/${item.id}`,
    })),
    ...services.data.map((item) => ({
      id: item.id,
      source: "service" as const,
      label: "تفعيل خدمة مَدار",
      status: item.status,
      amount: item.amount,
      currency: item.currency,
      reference: item.payment_reference,
      createdAt: item.created_at,
      href: item.workspace_request_id ? `/workspace-payment/${item.workspace_request_id}` : "/account/services",
      note: item.review_note,
    })),
    ...renewals.data.map((item) => ({
      id: item.id,
      source: "renewal" as const,
      label: "تجديد اشتراك خدمة",
      status: item.status,
      amount: item.amount,
      currency: item.currency,
      reference: item.payment_reference,
      createdAt: item.created_at,
      href: "/account/subscriptions",
      note: item.review_note,
    })),
    ...orby.data.map((item) => ({
      id: item.id,
      source: "orby" as const,
      label: "اشتراك ORBY Plus",
      status: item.status,
      amount: item.payment_amount,
      currency: item.payment_currency,
      reference: item.payment_reference,
      createdAt: item.created_at,
      href: "/orby/plus",
      note: item.review_note,
    })),
    ...retail.data.map((item) => ({
      id: item.id,
      source: "retail" as const,
      label: "اشتراك MADAR Retail",
      status: item.status,
      amount: item.amount,
      currency: item.currency,
      reference: item.payment_reference,
      createdAt: item.created_at,
      href: "/retail/workspace/settings",
      note: item.review_note,
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return { data: payments, failed: result.some((entry) => entry.failed) };
});
