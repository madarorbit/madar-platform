import { NextResponse } from "next/server";
import { authorizeOrganizationAction } from "@/src/lib/platform-integrations";
import { getOptionalShellIdentity } from "@/src/lib/shell/server";
import { supabaseFetch } from "@/src/lib/supabase/server";
import {
  commercialWorkspaceCookie,
  commercialWorkspaceCookieOptions,
} from "@/src/lib/workspace-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const identity = await getOptionalShellIdentity();
  const { organizationId } = await params;
  const destination = `/account/workspaces/${encodeURIComponent(organizationId)}/open`;
  if (!identity) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", destination);
    return NextResponse.redirect(login);
  }
  if (!uuidPattern.test(organizationId)) {
    return NextResponse.redirect(new URL("/account/services?error=workspace", request.url));
  }

  const organization = encodeURIComponent(organizationId);
  const user = encodeURIComponent(identity.userId);
  const [memberships, subscriptions] = await Promise.all([
    supabaseFetch(
      `/rest/v1/organization_members?organization_id=eq.${organization}&user_id=eq.${user}&select=role,organizations(id,status)&limit=1`,
    ).catch(() => []),
    supabaseFetch(
      `/rest/v1/workspace_subscriptions?organization_id=eq.${organization}&user_id=eq.${user}&service_code=in.(CONNECT_EXISTING,BUILD_ON_MADAR)&status=eq.active&activation_state=eq.ACTIVE&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=organization_id&limit=1`,
    ).catch(() => []),
  ]);
  const membership = memberships?.[0] as
    | { role?: string; organizations?: { status?: string } | Array<{ status?: string }> }
    | undefined;
  const relatedOrganization = Array.isArray(membership?.organizations)
    ? membership?.organizations[0]
    : membership?.organizations;
  const internallyAllowed = Boolean(
    membership && relatedOrganization?.status === "active" && subscriptions?.[0],
  );
  const authorization = await authorizeOrganizationAction({
    internalAllowed: internallyAllowed,
    userId: identity.userId,
    organizationId,
    relation: "can_view",
  });
  if (!authorization.allowed) {
    return NextResponse.redirect(new URL("/account/services?error=forbidden", request.url));
  }

  const response = NextResponse.redirect(new URL("/workspace", request.url));
  response.cookies.set(
    commercialWorkspaceCookie,
    organizationId,
    commercialWorkspaceCookieOptions,
  );
  return response;
}
