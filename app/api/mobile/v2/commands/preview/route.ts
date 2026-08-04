import { createConfirmationToken, mobileContext, mobileError, scalar, type CommandInput } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const context = await mobileContext(request);
    const input = await request.json() as CommandInput;
    if (!input || input.organizationId !== context.workspaceId || !input.action || !input.idempotencyKey)
      return Response.json({ error: 'بيانات الأمر غير مكتملة.' }, { status: 400 });
    const result = scalar<Record<string, unknown>>(await supabaseFetch('/rest/v1/rpc/mobile_v2_preview_command', {
      method: 'POST',
      body: JSON.stringify({
        target_organization: context.workspaceId,
        submitted_action: input.action,
        target_type: input.targetType || null,
        target_id: input.targetId || null,
        submitted_payload: input.payload || {},
      }),
    }, context.accessToken)) || {};
    const allowed = Boolean(result.allowed);
    return Response.json({
      allowed,
      blockedReason: result.blockedReason ? String(result.blockedReason) : null,
      confirmationToken: allowed ? createConfirmationToken(input, context.user.id) : null,
      executionPath: String(result.executionPath || 'BLOCKED'),
      summary: String(result.summary || ''),
      warnings: Array.isArray(result.warnings) ? result.warnings.map(String) : [],
      requiresOnline: true,
      expiresAt: allowed ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return mobileError(error); }
}
