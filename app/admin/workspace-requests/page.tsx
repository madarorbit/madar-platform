import Link from "next/link";
import { Badge, Card, EmptyState } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { requireAdmin } from "@/src/lib/auth";
import { serviceDefinition, type ServiceCode } from "@/src/lib/services/catalog";
import { supabaseFetch } from "@/src/lib/supabase/server";
import ReviewForm from "./review-form";

export const dynamic = "force-dynamic";

type Relation<T> = T | T[] | null;
type Request = {
  id: string;
  name: string;
  service_code: ServiceCode;
  request_kind: string;
  status: string;
  onboarding_state: string;
  payment_reference: string | null;
  payment_submitted_at: string | null;
  setup_payload: Record<string, unknown>;
  profiles: Relation<{ email: string; full_name: string | null }>;
  workspace_payment_submissions: Relation<{ id: string; status: string; created_at: string; payment_methods: Relation<{ name: string }> }>;
};
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] || null : value;

export default async function ServiceRequestsPage() {
  await requireAdmin();
  const rows = (await supabaseFetch(
    "/rest/v1/workspace_requests?status=in.(pending_review,approved)&select=id,name,service_code,request_kind,status,onboarding_state,payment_reference,payment_submitted_at,setup_payload,profiles!workspace_requests_user_id_fkey(email,full_name),workspace_payment_submissions(id,status,created_at,payment_methods(name))&order=payment_submitted_at.asc.nullslast",
  ).catch(() => [])) as Request[];
  const requests = rows.filter((request) => request.status === "pending_review" || request.onboarding_state === "PROVISIONING");
  return (
    <main className="mx-auto max-w-6xl p-4 py-8 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-bold text-emerald-300">موافقة مركزية</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">طلبات تفعيل وتجديد الخدمات</h1><p className="mt-3 max-w-3xl leading-8 text-slate-400">راجع هوية العميل ومرجع الدفع والإثبات. تُنشأ المساحة وتُفعّل الخدمة للعميل الصحيح فقط بعد الاعتماد.</p></div>
        <Link href="/admin/local-payments" className="md-button md-button-secondary"><Icon name="settings" />الأسعار وطرق الدفع</Link>
      </header>
      <div className="mt-8 grid gap-5">
        {requests.length ? requests.map((request) => {
          const profile = one(request.profiles);
          const payment = one(request.workspace_payment_submissions);
          const method = one(payment?.payment_methods || null);
          const definition = serviceDefinition(request.service_code);
          const retry = request.status === "approved" && request.onboarding_state === "PROVISIONING";
          return (
            <Card key={request.id} className="p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/10 text-violet-100"><Icon name={definition.icon} /></span><h2 className="text-xl font-black">{definition.name}</h2><Badge variant={retry ? "danger" : "warning"}>{retry ? "يحتاج إعادة تجهيز" : "بانتظار القرار"}</Badge></div>
                  <dl className="mt-5 grid gap-3 rounded-2xl bg-white/[.03] p-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-slate-500">العميل</dt><dd className="mt-1 font-bold">{profile?.full_name || "عميل"}</dd><dd dir="ltr" className="text-right text-slate-400">{profile?.email}</dd></div>
                    <div><dt className="text-slate-500">التجارة</dt><dd className="mt-1 font-bold">{request.name}</dd><dd className="text-slate-400">{request.request_kind === "RENEWAL" ? "طلب تجديد" : "طلب تفعيل أول"}</dd></div>
                    <div><dt className="text-slate-500">طريقة الدفع</dt><dd className="mt-1 font-bold">{method?.name || "—"}</dd></div>
                    <div><dt className="text-slate-500">مرجع العملية</dt><dd dir="ltr" className="mt-1 text-right font-black">{request.payment_reference || "—"}</dd></div>
                  </dl>
                </div>
                <div className="flex min-w-48 flex-col gap-2">
                  {payment?.id ? <Link href={`/admin/local-payments/proof/workspace/${payment.id}`} target="_blank" className="md-button md-button-secondary"><Icon name="document" />مشاهدة الإثبات</Link> : <span className="text-sm text-amber-200">الإثبات غير متاح</span>}
                </div>
              </div>
              <ReviewForm id={request.id} retry={retry} />
            </Card>
          );
        }) : <EmptyState title="لا توجد طلبات بانتظار القرار" description="ستظهر هنا طلبات فتح الخدمات وتجديدها بعد رفع إثبات الدفع." icon="check" />}
      </div>
    </main>
  );
}
