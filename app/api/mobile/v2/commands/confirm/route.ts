import { mobileContext, mobileError, scalar, verifyConfirmationToken, type CommandInput } from '@/src/lib/mobile/v2';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
type ConfirmInput = CommandInput & { confirmationToken: string };

export async function POST(request: Request) {
  try {
    const context = await mobileContext(request);
    const input = await request.json() as ConfirmInput;
    if (!input || input.organizationId !== context.workspaceId || !input.confirmationToken)
      return Response.json({ error: 'بيانات التأكيد غير مكتملة.' }, { status: 400 });
    if (!verifyConfirmationToken(input.confirmationToken, input, context.user.id))
      return Response.json({ error: 'انتهت صلاحية المعاينة أو تغيّرت بيانات الأمر. أعد المعاينة.' }, { status: 409 });
    const preview = scalar<Record<string, unknown>>(await supabaseFetch('/rest/v1/rpc/mobile_v2_preview_command', {
      method: 'POST',
      body: JSON.stringify({
        target_organization: context.workspaceId,
        submitted_action: input.action,
        target_type: input.targetType || null,
        target_id: input.targetId || null,
        submitted_payload: input.payload || {},
      }),
    }, context.accessToken)) || {};
    if (!preview.allowed)
      return Response.json({ error: String(preview.blockedReason || 'لم يعد الأمر مسموحًا.') }, { status: 409 });
    const result = scalar<Record<string, unknown>>(await supabaseFetch('/rest/v1/rpc/mobile_v2_apply_command', {
      method: 'POST',
      body: JSON.stringify({
        target_organization: context.workspaceId,
        submitted_action: input.action,
        target_type: input.targetType || null,
        target_id: input.targetId || null,
        submitted_payload: input.payload || {},
        submitted_idempotency_key: input.idempotencyKey,
        preview_summary: String(preview.summary || ''),
      }),
    }, context.accessToken));
    return Response.json(result || { error: 'لم تُعد العملية نتيجة.' }, {
      status: result ? 200 : 503,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) { return mobileError(error); }
}
