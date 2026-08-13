import ActionFeedback from "@/components/business/ActionFeedback";
import { submitSupportFeedback } from "@/app/actions/support";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Badge, Button, EmptyState, Field, Input, Select, Textarea } from "@/components/ui/Enterprise";
import { formatDateTime } from "@/src/lib/format";
import { getOptionalShellIdentity } from "@/src/lib/shell/server";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الدعم والملاحظات | مَدار" };
const typeLabels: Record<string, string> = { bug: "مشكلة", suggestion: "اقتراح", question: "سؤال", rating: "تقييم" };
const statusLabels: Record<string, string> = { new: "جديد", reviewing: "قيد المراجعة", planned: "مخطط له", resolved: "تم الحل", closed: "مغلق" };
type Feedback = { id: string; feedback_type: string; severity: string; title: string; message: string; page_path: string | null; rating: number | null; status: string; admin_note: string | null; attachment_name: string | null; created_at: string };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const feedback = await searchParams;
  const userId = encodeURIComponent(identity.userId);
  const [memberships, items] = await Promise.all([
    supabaseFetch(`/rest/v1/organization_members?user_id=eq.${userId}&select=organizations(id,name,type,status)`).catch(() => []),
    supabaseFetch(`/rest/v1/platform_feedback?user_id=eq.${userId}&select=id,feedback_type,severity,title,message,page_path,rating,status,admin_note,attachment_name,created_at,resolved_at&order=created_at.desc&limit=100`).catch(() => []),
  ]);
  const business = memberships?.find((item: { organizations?: { type?: string; status?: string } }) => item.organizations?.type !== "STUDENT" && item.organizations?.status === "active")?.organizations;
  const rows = items as Feedback[];
  return <AccountPage>
    <AccountPageHeader title="الدعم والملاحظات" description="أرسل مشكلة أو اقتراحًا أو سؤالًا، ثم تابع حالته ورد فريق مَدار من المكان نفسه." />
    <ActionFeedback {...feedback} />
    <div className="md-account-support-layout">
      <section className="md-account-section"><span className="md-eyebrow">تواصل مع الفريق</span><h2>بلاغ جديد</h2><form action={submitSupportFeedback} encType="multipart/form-data" className="md-account-form-stack">
        <input type="hidden" name="organization_id" value={business?.id || ""} />
        <div className="md-profile-fields"><Field label="النوع"><Select name="feedback_type"><option value="bug">مشكلة</option><option value="suggestion">اقتراح</option><option value="question">سؤال</option><option value="rating">تقييم</option></Select></Field><Field label="الأهمية"><Select name="severity" defaultValue="normal"><option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">عالية</option><option value="critical">تمنع الاستخدام</option></Select></Field></div>
        <Field label="العنوان"><Input name="title" required minLength={3} maxLength={180} placeholder="وصف مختصر وواضح" /></Field>
        <Field label="التفاصيل" help="اذكر ما حدث وما كنت تتوقعه والخطوات إن كانت مشكلة."><Textarea name="message" required minLength={10} maxLength={5000} rows={7} /></Field>
        <div className="md-profile-fields"><Field label="مسار الصفحة" help="اختياري"><Input name="page_path" maxLength={500} placeholder="/workspace/inventory" dir="ltr" /></Field><Field label="التقييم" help="اختياري"><Select name="rating" defaultValue=""><option value="">بدون تقييم</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</Select></Field></div>
        <Field label="لقطة شاشة أو PDF" help="اختياري، حتى 10MB. لا ترفق كلمات مرور أو بيانات حساسة."><Input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></Field>
        <Button type="submit">إرسال البلاغ</Button>
      </form></section>
      <section className="md-account-section"><div className="md-home-section-heading"><div><span className="md-eyebrow">المتابعة</span><h2>بلاغاتي</h2></div></div>
        {rows.length ? <div className="md-account-record-list">{rows.map((item) => <article key={item.id} className="md-account-record"><div className="md-account-record-heading"><div><div className="flex flex-wrap gap-2"><Badge variant="brand">{typeLabels[item.feedback_type] || item.feedback_type}</Badge><Badge variant={item.status === "resolved" ? "success" : item.status === "closed" ? "default" : "warning"}>{statusLabels[item.status] || item.status}</Badge><Badge>{item.severity}</Badge></div><h3>{item.title}</h3></div><time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time></div><p className="whitespace-pre-wrap">{item.message}</p><div className="md-account-record-meta">{item.page_path ? <span dir="ltr">{item.page_path}</span> : null}{item.rating ? <span>التقييم: {item.rating}/5</span> : null}{item.attachment_name ? <span>مرفق: {item.attachment_name}</span> : null}</div>{item.admin_note ? <p className="md-account-admin-note"><strong>رد الإدارة:</strong> {item.admin_note}</p> : null}</article>)}</div> : <EmptyState title="لم ترسل بلاغًا بعد" description="بعد الإرسال ستظهر الحالة ورد الفريق هنا." icon="help" compact />}
      </section>
    </div>
  </AccountPage>;
}
