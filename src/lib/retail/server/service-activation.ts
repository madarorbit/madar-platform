import "server-only";

import { createClient } from "@/src/lib/retail/supabase/server";

type PlatformRetailIdentity = {
  id: string;
  email: string | null;
  fullName: string | null;
  phone: string | null;
  platformRole: "CUSTOMER" | "ADMIN" | "SUPER_ADMIN";
};

export async function activateApprovedRetailService(input: {
  identity: PlatformRetailIdentity;
  platformOrganizationId: string;
  platformRequestId: string;
  setup: Record<string, unknown>;
  endsAt: string;
  graceEndsAt: string | null;
}) {
  const client = createClient();
  const { error: identityError } = await client.from("profiles").upsert(
    {
      id: input.identity.id,
      email: input.identity.email,
      full_name: input.identity.fullName,
      phone: input.identity.phone,
      platform_role: input.identity.platformRole,
      status: "active",
      identity_source: "MADAR_PLATFORM",
    },
    { onConflict: "id" },
  );
  if (identityError) throw identityError;

  const { data, error } = await client.rpc("activate_retail_service", {
    actor_user: input.identity.id,
    platform_organization: input.platformOrganizationId,
    platform_request: input.platformRequestId,
    service_setup: input.setup,
    subscription_ends_at: input.endsAt,
    subscription_grace_ends_at: input.graceEndsAt,
  });
  if (error) {
    console.error("Retail service activation failed", {
      requestId: input.platformRequestId,
      code: error.code,
    });
    throw new Error("RETAIL_SERVICE_PROVISION_FAILED");
  }
  const workspaceId =
    data && typeof data === "object" && "workspace_id" in data
      ? String(data.workspace_id || "")
      : "";
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) {
    throw new Error("RETAIL_SERVICE_WORKSPACE_MISSING");
  }
  return workspaceId;
}
