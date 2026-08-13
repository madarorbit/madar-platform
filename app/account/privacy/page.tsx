import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import { cancelPrivacyRequest, createPrivacyRequest } from "@/app/actions/support";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Badge, Button, ButtonLink, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { formatDateTime } from "@/src/lib/format";
import { getOptionalShellIdentity } from "@/src/lib/shell/server";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الخصوصية والبيانات | مَدار" };
const requestLabels: Record<string, string> = { export_account: "تصدير بيانات الحساب", export_workspace: "تصدير بيانات مساحة العمل", delete_account: "حذف الحساب", delete_workspace: "حذف مساحة العمل" };
const statusLabels: Record<string, string> = { requested: "تم الاستلام", processing: "قيد المعالجة", completed: "مكتمل", rejected: "مرفوض", cancelled: "ملغى" };
type PrivacyRequest = { id: string; request_type: string; status: string; reason: string | null; admin_note: string | null; requested_at: string; processed_at: string | null; organizations: { name: string } | null };

export default async function PrivacyPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const params = await searchParams;
  const userId = encodeURIComponent(identity.userId);
  const [memberships, requests] = await Promise.all([
    supabaseFetch(`/rest/v1/organization_members?user_id=eq.${userId}&role=eq.OWNER&select=organization_id,organizations(name,type,status)`).catch(() => []),
    supabaseFetch(`/rest/v1/data_privacy_requests?user_id=eq.${userId}&select=id,request_type,status,reason,admin_note,requested_at,processed_at,organizations(name)&order=requested_at.desc&limit=100`).catch(() => []),
  ]);
  const business = memberships?.find((membership: { organizations?: { type?: string } }) => membership.organizations?.type !== "STUDENT");
  const rows = requests as PrivacyRequest[];
  return <AccountPage>
    <AccountPageHeader title="الخصوصية والبيانات" description="نزّل نسخة فورية أو سجّل طلبًا موثقًا. الحذف لا ينفذ تلقائيًا لحمايتك من فقد البيانات غير المقصود." actions={<ButtonLink href="/account/privacy/export/account" variant="secondary"><Icon name="document" />تنزيل بيانات الحساب</ButtonLink>} />
    <ActionFeedback success={params.success} error={params.error} />

    <section className="md-account-section">
      <div className="md-home-section-heading"><div><span className="md-eyebrow">تنزيل فوري</span><h2>نسخ بياناتك الحالية</h2></div></div>
      <div className="md-account-action-grid">
        <Link href="/account/privacy/export/account" className="md-account-action-link"><span className="md-home-summary-icon"><Icon name="user" /></span><span><strong>بيانات الحساب</strong><small>الملف الشخصي والطلبات والإشعارات والعضويات والبلاغات بصيغة JSON.</small></span><Icon name="arrow" className="md-icon-directional" /></Link>
        {business ? <Link href="/account/privacy/export/workspace" className="md-account-action-link"><span className="md-home-summary-icon"><Icon name="briefcase" /></span><span><strong>بيانات مساحة العمل</strong><small>بيانات التجارة التي تملكها حسب النطاق الحالي.</small></span><Icon name="arrow" className="md-icon-directional" /></Link> : <div className="md-account-action-link is-disabled"><span className="md-home-summary-icon"><Icon name="briefcase" /></span><span><strong>بيانات مساحة العمل</strong><small>لا تملك مساحة أعمال قابلة للتصدير الآن.</small></span></div>}
      </div>
    </section>

    <div className="md-account-two-column">
      <section className="md-account-section"><span className="md-eyebrow">طلب موثق</span><h2>طلب تصدير ومراجعة إدارية</h2><form action={createPrivacyRequest} className="md-account-form-stack">
        <Field label="نطاق التصدير"><Select name="request_kind"><option value="export_account">الحساب</option>{business ? <option value="export_workspace">مساحة العمل</option> : null}</Select></Field>
        <Field label="السبب أو الملاحظات" help="اختياري، بحد أقصى 2000 حرف."><Textarea name="reason" maxLength={2000} rows={4} /></Field>
        <Button type="submit">تسجيل طلب التصدير</Button>
      </form></section>

      <section className="md-account-section md-danger-zone"><span className="md-eyebrow">إجراءات خطرة</span><h2>طلب حذف</h2><p className="md-type-body-sm md-muted mt-2">يُراجع الطلب إداريًا ولا يُنفذ فورًا. اقرأ الآثار بعناية واكتب عبارة التأكيد حرفيًا.</p><form action={createPrivacyRequest} className="md-account-form-stack">
        <Field label="ما الذي تريد طلب حذفه؟"><Select name="request_kind"><option value="delete_account">حسابي</option>{business ? <option value="delete_workspace">مساحة العمل</option> : null}</Select></Field>
        <Field label="السبب أو الملاحظات"><Textarea name="reason" maxLength={2000} rows={3} /></Field>
        <Field label="عبارة التأكيد" help="اكتب: حذف حسابي، أو حذف مساحتي حسب الطلب."><Input name="confirmation" required placeholder="حذف حسابي" /></Field>
        <Button type="submit" variant="danger">تسجيل طلب الحذف</Button>
      </form></section>
    </div>

    <section className="md-account-section mt-5"><div className="md-home-section-heading"><div><span className="md-eyebrow">السجل</span><h2>طلبات الخصوصية</h2></div></div>
      {rows.length ? <div className="md-account-record-list">{rows.map((request) => <article key={request.id} className="md-account-record"><div className="md-account-record-heading"><div><strong>{requestLabels[request.request_type] || request.request_type}</strong>{request.organizations?.name ? <small>{request.organizations.name}</small> : null}</div><Badge variant={request.status === "completed" ? "success" : request.status === "rejected" ? "danger" : request.status === "processing" || request.status === "requested" ? "warning" : "default"}>{statusLabels[request.status] || request.status}</Badge></div>{request.reason ? <p>{request.reason}</p> : null}{request.admin_note ? <p className="md-account-admin-note">رد الإدارة: {request.admin_note}</p> : null}<footer><time dateTime={request.requested_at}>{formatDateTime(request.requested_at)}</time>{request.status === "requested" ? <form action={cancelPrivacyRequest}><input type="hidden" name="request_id" value={request.id} /><Button type="submit" variant="ghost" size="sm">إلغاء الطلب</Button></form> : null}</footer></article>)}</div> : <EmptyState title="لا توجد طلبات سابقة" description="طلبات التصدير أو الحذف الموثقة ستظهر هنا مع حالتها." icon="shield" compact />}
    </section>
  </AccountPage>;
}
