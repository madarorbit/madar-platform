import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const foundation = fs.readFileSync(
  "supabase/migrations/20260724060000_phase_four_local_payments_foundation.sql",
  "utf8",
);
const beta = fs.readFileSync(
  "supabase/migrations/20260724060100_phase_four_beta_workspace_payments.sql",
  "utf8",
);
const subscriptions = fs.readFileSync(
  "supabase/migrations/20260724060200_phase_four_subscription_renewals_limits.sql",
  "utf8",
);
const v2Access = fs.readFileSync(
  "supabase/migrations/20260805070100_madar_v2_subscription_access_hardening.sql",
  "utf8",
);
const v2Entitlements = fs.readFileSync(
  "supabase/migrations/20260805070300_madar_v2_entitlement_enforcement.sql",
  "utf8",
);
const currency = fs.readFileSync(
  "supabase/migrations/20260724060300_local_payment_currency_alignment.sql",
  "utf8",
);
const storage = fs.readFileSync("src/lib/local-payments.ts", "utf8");
const actions = fs.readFileSync("app/actions/local-payments.ts", "utf8");
const workspacePage = fs.readFileSync(
  "app/workspace-payment/[id]/page.tsx",
  "utf8",
);
const subscriptionPage = fs.readFileSync(
  "app/account/subscription/page.tsx",
  "utf8",
);
const business = fs.readFileSync("src/lib/business.ts", "utf8");

test("local payment methods are disabled until valid account details exist", () => {
  assert.match(foundation, /create table public\.payment_methods/);
  assert.match(
    foundation,
    /check\(not is_active or \(account_name is not null and account_identifier is not null\)\)/,
  );
  assert.match(foundation, /\('SHILAN','محفظة شلن','wallet',null,null/);
  assert.match(foundation, /\('OM_FLOOS','محفظة أم فلوس','wallet',null,null/);
  assert.match(foundation, /\('ONE_CASH','ون كاش','wallet',null,null/);
  assert.match(currency, /set currency='SAR' where code='QUTAIBI'/);
  assert.match(
    workspacePage,
    /currency=eq\.\$\{encodeURIComponent\(plan\.currency\)\}/,
  );
});

test("first ten Beta workspaces are reserved atomically and expire when abandoned", () => {
  assert.match(foundation, /ordinal between 1 and 10/);
  assert.match(foundation, /select generate_series\(1,10\)/);
  assert.match(beta, /for update skip locked limit 1/);
  assert.match(beta, /reserved_until=now\(\)\+interval '72 hours'/);
  assert.match(beta, /status='pending_review'/);
  assert.match(beta, /interval '90 days'/);
  assert.match(
    subscriptions,
    /Backfill existing business organizations|with existing as/,
  );
});

test("paid workspace approval requires a private proof while Beta skips payment", () => {
  assert.match(beta, /request\.beta_slot_ordinal is null and not exists/);
  assert.match(beta, /PAYMENT_PROOF_REQUIRED/);
  assert.match(beta, /workspace_payment_submissions/);
  assert.match(beta, /status='approved'/);
  assert.match(actions, /uploadLocalPaymentProof/);
  assert.match(actions, /rpc\/submit_workspace_payment_v2/);
});

test("payment proofs are validated and stored in a private bucket", () => {
  assert.match(storage, /validateMagicBytes/);
  assert.match(storage, /10\*1024\*1024/);
  assert.match(storage, /payment-proofs/);
  assert.match(storage, /crypto\.randomUUID/);
  assert.match(storage, /signedLocalPaymentProof/);
  assert.match(actions, /removeLocalPaymentProof/);
});

test("legacy renewal history remains auditable but executable RPCs are revoked", () => {
  assert.match(subscriptions, /private\.submit_subscription_renewal_impl/);
  assert.match(subscriptions, /RENEWAL_ALREADY_PENDING/);
  assert.match(subscriptionPage, /V2PaymentForm/);
  assert.match(subscriptionPage, /pricing_current_subscriptions/);
  assert.match(actions, /submitV2LocalPayment/);
  assert.doesNotMatch(actions, /submitSubscriptionRenewal|reviewSubscriptionRenewal/);
  assert.match(v2Entitlements, /revoke execute on function public\.submit_subscription_renewal/);
  assert.match(v2Entitlements, /revoke execute on function public\.review_subscription_renewal/);
  assert.match(v2Entitlements, /revoke execute on function public\.refresh_workspace_subscription/);
});

test("subscription limits and ORBY quota use V2 locked entitlements", () => {
  assert.match(v2Entitlements, /v2_active_subscription_entitlement/);
  assert.match(v2Entitlements, /locked_entitlements/);
  assert.match(v2Entitlements, /'products'/);
  assert.match(v2Entitlements, /PRODUCT_LIMIT_REACHED/);
  assert.match(v2Entitlements, /'team_members'/);
  assert.match(v2Entitlements, /MEMBER_LIMIT_REACHED/);
  assert.match(v2Entitlements, /'orby_daily_messages'/);
  assert.match(v2Entitlements, /MADAR_V2_LOCKED_ENTITLEMENTS/);
  assert.doesNotMatch(v2Entitlements, /workspace_subscriptions|subscription_plans/);
});

test("terminal V2 subscriptions block workspace tools but preserve billing recovery", () => {
  assert.match(v2Access, /resolve_pricing_subscription_status/);
  assert.match(v2Access, /trial_ends_at is null/);
  assert.match(v2Access, /trial_ends_at <= now\(\)/);
  assert.match(v2Access, /ends_at <= now\(\)/);
  assert.match(v2Access, /set status = 'expired'/);
  assert.match(business, /allowExpired\s*=\s*false/);
  assert.match(business, /allowMissing\s*=\s*false/);
  assert.match(business, /allowCancelled\s*=\s*false/);
  assert.match(
    business,
    /redirect\(["']\/account\/subscription\?expired=1["']\)/,
  );
  assert.match(
    actions,
    /requireBusinessWorkspace\(\{allowExpired:true,allowMissing:true,allowCancelled:true\}\)/,
  );
  assert.match(subscriptionPage, /allowExpired:\s*true/);
  assert.match(subscriptionPage, /allowMissing:\s*true/);
  assert.match(subscriptionPage, /allowCancelled:\s*true/);
  assert.match(subscriptionPage, /V2PaymentForm/);
});
