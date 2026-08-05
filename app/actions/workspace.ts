'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { requireAdmin, requireUser } from '@/src/lib/auth';
import { currentProfile, supabaseFetch } from '@/src/lib/supabase/server';
import { authorizeOrganizationAction, publishOrganizationWebhook, syncOpenFgaMembership } from '@/src/lib/platform-integrations';
import { required } from '@/src/lib/validation';
import { organizationTypes } from '@/src/lib/workspace';

export type WorkspaceActionState = { success?: string; error?: string; destination?: string };

export async function createWorkspace(_previous: WorkspaceActionState, form: FormData): Promise<WorkspaceActionState> {
  try {
    await requireUser();
    const profile = await currentProfile();
    if (profile?.account_type === 'BUSINESS') throw new Error('حساب الأعمال يحصل على مساحة واحدة تلقائيًا؛ لا يمكن إنشاء مسار مكرر.');
    const type = String(form.get('type'));
    if (type !== 'STUDENT') throw new Error('الحساب الشخصي لا يمكنه إنشاء مساحة تجارية. أنشئ حساب أعمال مستقلًا.');
    await supabaseFetch('/rest/v1/rpc/ensure_student_workspace', { method: 'POST', body: '{}' });
    revalidatePath('/dashboard');
    revalidatePath('/student');
    return { success: 'تم تأكيد مساحة الطالب.', destination: '/student' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'تعذر بدء المساحة. حاول مرة أخرى.' };
  }
}

export async function submitWorkspacePayment(_previous: WorkspaceActionState, form: FormData): Promise<WorkspaceActionState> {
  try {
    await requireUser();
    const id = required(form.get('request_id'), 'الطلب');
    const reference = required(form.get('payment_reference'), 'مرجع التحويل');
    await supabaseFetch('/rest/v1/rpc/submit_workspace_payment', {
      method: 'POST',
      body: JSON.stringify({ target_request: id, reference }),
    });
    revalidatePath('/dashboard');
    return { success: 'تم إرسال إثبات التحويل للمراجعة. ستفتح المساحة تلقائياً بعد موافقة الإدارة.', destination: '/dashboard' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'تعذر إرسال بيانات الدفع.' };
  }
}

export async function reviewWorkspaceRequest(_previous: WorkspaceActionState, form: FormData): Promise<WorkspaceActionState> {
  try {
    await requireAdmin();
    const id = required(form.get('request_id'), 'الطلب');
    const decision = String(form.get('decision'));
    if (!['approve', 'reject'].includes(decision)) throw new Error('القرار غير صالح.');
    await supabaseFetch('/rest/v1/rpc/review_workspace_request', {
      method: 'POST',
      body: JSON.stringify({ target_request: id, decision, reason: String(form.get('reason') || '').trim() || null }),
    });
    revalidatePath('/admin/workspace-requests');
    revalidatePath('/admin');
    return { success: decision === 'approve' ? 'تم قبول الطلب وفتح المساحة تلقائياً.' : 'تم رفض الطلب.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'تعذر مراجعة الطلب.' };
  }
}

export async function updateWorkspace(_previous: unknown, form: FormData) {
  try {
    const user = await requireUser();
    const id = required(form.get('id'), 'المساحة');
    const name = required(form.get('name'), 'اسم المساحة');
    const type = String(form.get('type'));
    if (!organizationTypes.includes(type as never)) throw new Error('نوع الحساب غير صالح.');
    const rows = await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}&select=role`);
    if (rows?.[0]?.role !== 'OWNER') throw new Error('مالك المساحة فقط يستطيع تعديل إعداداتها.');
    await supabaseFetch(`/rest/v1/organizations?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name,
        type,
        description: String(form.get('description') || '').trim() || null,
        whatsapp: String(form.get('whatsapp') || '').trim() || null,
        website: String(form.get('website') || '').trim() || null,
        country: String(form.get('country') || '').trim() || null,
        city: String(form.get('city') || '').trim() || null,
      }),
    });
    revalidatePath('/dashboard');
    revalidatePath('/account/business');
    return { success: 'تم حفظ إعدادات المساحة.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'تعذر حفظ الإعدادات.' };
  }
}

export async function manageWorkspaceMember(_previous: unknown, form: FormData) {
  try {
    const actor = await requireUser();
    const organizationId = required(form.get('organization_id'), 'المساحة');
    const memberEmail = required(form.get('email'), 'البريد الإلكتروني');
    const requestedRole = String(form.get('role') || 'MEMBER') as 'MEMBER' | 'ADMIN';
    const operation = String(form.get('operation') || 'add') as 'add' | 'remove';
    if (!['MEMBER', 'ADMIN'].includes(requestedRole) || !['add', 'remove'].includes(operation)) throw new Error('طلب إدارة العضوية غير صالح.');

    const [actorMembershipRows, targetProfiles] = await Promise.all([
      supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(actor.id)}&select=role,organizations(name)&limit=1`),
      supabaseFetch(`/rest/v1/profiles?email=eq.${encodeURIComponent(memberEmail)}&select=id,email&limit=1`),
    ]);
    const actorMembership = actorMembershipRows?.[0] as { role?: string; organizations?: { name?: string } | Array<{ name?: string }> } | undefined;
    const organization = Array.isArray(actorMembership?.organizations) ? actorMembership?.organizations[0] : actorMembership?.organizations;
    const authorization = await authorizeOrganizationAction({
      internalAllowed: ['OWNER', 'ADMIN'].includes(String(actorMembership?.role)),
      userId: actor.id,
      organizationId,
      relation: 'can_manage_members',
    });
    if (!authorization.allowed) throw new Error('ليست لديك صلاحية إدارة أعضاء مساحة العمل.');

    const target = targetProfiles?.[0] as { id?: string; email?: string } | undefined;
    let existingRole: 'OWNER' | 'ADMIN' | 'MEMBER' | undefined;
    if (target?.id) {
      const targetMemberships = await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(target.id)}&select=role&limit=1`);
      const value = String(targetMemberships?.[0]?.role || '');
      if (['OWNER', 'ADMIN', 'MEMBER'].includes(value)) existingRole = value as typeof existingRole;
    }

    await supabaseFetch('/rest/v1/rpc/manage_organization_member', {
      method: 'POST',
      body: JSON.stringify({ target_organization: organizationId, target_email: memberEmail, requested_role: requestedRole, operation }),
    });

    if (target?.id) {
      const synchronizedRole = operation === 'remove' ? (existingRole || requestedRole) : requestedRole;
      after(async () => {
        await Promise.allSettled([
          syncOpenFgaMembership({ operation, userId: target.id as string, organizationId, role: synchronizedRole }),
          publishOrganizationWebhook({
            organizationId,
            organizationName: organization?.name,
            eventType: operation === 'add' ? 'organization.member.added' : 'organization.member.removed',
            eventId: `member-${operation}-${organizationId}-${target.id}-${Date.now()}`,
            payload: {
              member_user_id: target.id as string,
              role: synchronizedRole,
              actor_user_id: actor.id,
              operation,
            },
            channels: ['organization'],
          }),
        ]);
      });
    }

    revalidatePath('/account/business/members');
    return { success: operation === 'add' ? 'تمت إضافة العضو.' : 'تمت إزالة العضو.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'تعذر تحديث العضوية.' };
  }
}
