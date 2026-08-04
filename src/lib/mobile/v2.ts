import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { currentUser, profileForUser, supabaseFetch } from '@/src/lib/supabase/server';

export type MobileContext = {
  accessToken: string;
  user: { id: string; email?: string | null };
  workspaceId: string;
  role: string;
};

type MembershipRow = {
  role: string;
  organizations: { id: string; type: string; status: string } | Array<{ id: string; type: string; status: string }> | null;
};

export const scalar = <T,>(value: unknown): T | undefined =>
  Array.isArray(value) ? (value[0] as T | undefined) : (value as T | undefined);
export const rows = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export function accessTokenFrom(request: Request) {
  const [scheme, token] = (request.headers.get('authorization') || '').split(/\s+/, 2);
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

const organizationOf = (row: MembershipRow) =>
  (Array.isArray(row.organizations) ? row.organizations[0] : row.organizations) || null;

export async function mobileContext(request: Request): Promise<MobileContext> {
  const accessToken = accessTokenFrom(request);
  if (!accessToken) throw Object.assign(new Error('يجب تسجيل الدخول أولًا.'), { status: 401 });
  const user = await currentUser(accessToken);
  if (!user) throw Object.assign(new Error('انتهت جلسة تسجيل الدخول.'), { status: 401 });
  const profile = await profileForUser(user.id, accessToken);
  if (profile?.status !== 'active' || profile.account_type !== 'BUSINESS')
    throw Object.assign(new Error('تطبيق لوحة القيادة مخصص لحسابات الأعمال.'), { status: 403 });
  const memberships = rows<MembershipRow>(
    await supabaseFetch(
      `/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,type,status)`,
      {},
      accessToken,
    ),
  );
  const requested = request.headers.get('x-madar-workspace-id') || new URL(request.url).searchParams.get('workspaceId');
  const membership = requested
    ? memberships.find((item) => organizationOf(item)?.id === requested)
    : memberships.find((item) => organizationOf(item)?.id === profile.default_commercial_organization_id) || memberships[0];
  const workspace = membership ? organizationOf(membership) : null;
  if (!membership || !workspace || workspace.type === 'STUDENT' || workspace.status !== 'active')
    throw Object.assign(new Error('مساحة العمل التجارية غير متاحة لهذا الحساب.'), { status: 403 });
  return { accessToken, user, workspaceId: workspace.id, role: membership.role };
}

export function mobileError(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 500;
  const message = error instanceof Error ? error.message : 'تعذر إكمال الطلب الآن.';
  return Response.json({ error: status >= 500 ? 'تعذر إكمال الطلب الآن.' : message }, { status: Number.isFinite(status) ? status : 500 });
}

function commandSecret() {
  const secret = process.env.MADAR_MOBILE_COMMAND_SECRET || process.env.MADAR_INTEGRATION_MASTER_KEY || process.env.CRON_SECRET;
  if (!secret) throw new Error('Mobile command confirmation secret is not configured.');
  return secret;
}

export type CommandInput = {
  organizationId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey: string;
};

export const commandDigest = (input: CommandInput, userId: string) =>
  createHash('sha256').update(JSON.stringify({
    userId,
    organizationId: input.organizationId,
    action: input.action,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    payload: input.payload || {},
    idempotencyKey: input.idempotencyKey,
  })).digest('base64url');

export function createConfirmationToken(input: CommandInput, userId: string) {
  const payload = Buffer.from(JSON.stringify({ digest: commandDigest(input, userId), exp: Date.now() + 5 * 60_000 })).toString('base64url');
  const signature = createHmac('sha256', commandSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyConfirmationToken(token: string, input: CommandInput, userId: string) {
  const [payload, supplied] = token.split('.', 2);
  if (!payload || !supplied) return false;
  const expected = createHmac('sha256', commandSecret()).update(payload).digest('base64url');
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { digest?: string; exp?: number };
    return decoded.digest === commandDigest(input, userId) && Number(decoded.exp) > Date.now();
  } catch { return false; }
}

export function pageOffset(cursor: string | null) {
  if (!cursor) return 0;
  try {
    const parsed = Number(Buffer.from(cursor, 'base64url').toString());
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100000 ? parsed : 0;
  } catch { return 0; }
}
export const nextCursor = (offset: number) => Buffer.from(String(offset)).toString('base64url');

export function mapOperation(row: Record<string, unknown>) {
  return {
    id: String(row.id), action: String(row.action), label: String(row.summary || ''), status: String(row.status),
    targetType: row.target_type ? String(row.target_type) : null, targetId: row.target_id ? String(row.target_id) : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), message: row.message ? String(row.message) : null,
  };
}
