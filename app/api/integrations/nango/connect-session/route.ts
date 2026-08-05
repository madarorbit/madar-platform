import { currentProfile, currentUser, supabaseFetch } from '@/src/lib/supabase/server';
import { authorizeOrganizationAction, createNangoConnectSession } from '@/src/lib/platform-integrations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const organizationOf = (value: unknown) => Array.isArray(value) ? value[0] : value;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return Response.json({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'يجب تسجيل الدخول أولًا.' } }, { status: 401 });
    const profile = await currentProfile();
    const body = await request.json() as { organizationId?: unknown; allowedIntegrations?: unknown };
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    if (!uuid.test(organizationId)) return Response.json({ ok: false, error: { code: 'ORGANIZATION_INVALID', message: 'مساحة العمل غير صالحة.' } }, { status: 400 });
    const requestedIntegrations = Array.isArray(body.allowedIntegrations)
      ? body.allowedIntegrations.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 20)
      : undefined;

    const membershipRows = await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,status,type)&limit=1`) as Array<{ role?: string; organizations?: unknown }>;
    const membership = membershipRows?.[0];
    const organization = organizationOf(membership?.organizations) as { id?: string; name?: string; status?: string; type?: string } | null;
    const internallyAllowed = Boolean(membership && organization?.id === organizationId && organization.status === 'active' && organization.type !== 'STUDENT' && ['OWNER', 'ADMIN'].includes(String(membership.role)));
    const authorization = await authorizeOrganizationAction({
      internalAllowed: internallyAllowed,
      userId: user.id,
      organizationId,
      relation: 'can_manage_integrations',
    });
    if (!authorization.allowed) return Response.json({ ok: false, error: { code: 'FORBIDDEN', message: 'لا تملك صلاحية إدارة اتصالات هذه المساحة.' } }, { status: 403 });

    const resolved = await supabaseFetch('/rest/v1/rpc/resolve_pricing_subscription_status', {
      method: 'POST',
      body: JSON.stringify({ target_organization: organizationId }),
    });
    const subscriptionStatus = Array.isArray(resolved) ? resolved[0] : resolved;
    if (!['trialing', 'active', 'past_due'].includes(String(subscriptionStatus))) {
      return Response.json({ ok: false, error: { code: 'SUBSCRIPTION_LOCKED', message: 'يجب تفعيل اشتراك المساحة قبل ربط نظام خارجي.' } }, { status: 403 });
    }

    const result = await createNangoConnectSession({
      organizationId,
      organizationName: organization?.name || 'مساحة مَدار',
      userId: user.id,
      userEmail: profile?.email || user.email,
      userDisplayName: profile?.full_name,
      requestedIntegrations,
    });
    if (result.status === 'created') {
      return Response.json({
        ok: true,
        token: result.session.token,
        connectLink: result.session.connectLink,
        expiresAt: result.session.expiresAt,
        allowedIntegrations: result.session.allowedIntegrations,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (result.status === 'rejected') {
      const invalidIntegration = result.reason === 'NANGO_INTEGRATION_NOT_ALLOWED' || result.reason === 'NANGO_ALLOWLIST_EMPTY';
      return Response.json({ ok: false, error: { code: result.reason, message: invalidIntegration ? 'الموصل المطلوب غير معتمد في مَدار.' : 'تعذر بدء جلسة ربط النظام الخارجي.' } }, { status: invalidIntegration ? 400 : 503 });
    }
    return Response.json({ ok: false, error: { code: 'NANGO_NOT_AVAILABLE', message: 'خدمة الاتصال الخارجي غير مفعلة حاليًا.' } }, { status: 503 });
  } catch (error) {
    console.error('Nango connect session failed', { error: error instanceof Error ? error.name : 'unknown' });
    return Response.json({ ok: false, error: { code: 'NANGO_SESSION_FAILED', message: 'تعذر بدء جلسة الربط الآن.' } }, { status: 503 });
  }
}
