import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import {
  cancelPrivacyRequest,
  createPrivacyRequest,
} from "@/app/actions/support";
import { requireUser } from "@/src/lib/auth";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الخصوصية والبيانات | مَدار" };
const requestLabels: Record<string, string> = {
  export_account: "تصدير بيانات الحساب",
  export_workspace: "تصدير بيانات مساحة العمل",
  delete_account: "حذف الحساب",
  delete_workspace: "حذف مساحة العمل",
};
const statusLabels: Record<string, string> = {
  requested: "تم الاستلام",
  processing: "قيد المعالجة",
  completed: "مكتمل",
  rejected: "مرفوض",
  cancelled: "ملغى",
};
type PrivacyRequest = {
  id: string;
  request_type: string;
  status: string;
  reason: string | null;
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
  organizations: { name: string } | null;
};

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireUser(),
    params = await searchParams;
  const memberships = await supabaseFetch(
      `/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&role=eq.OWNER&select=organization_id,organizations(name,type,status)`,
    ),
    business = memberships?.find(
      (membership: { organizations?: { type?: string } }) =>
        membership.organizations?.type !== "STUDENT",
    );
  const requests: PrivacyRequest[] = await supabaseFetch(
    `/rest/v1/data_privacy_requests?user_id=eq.${encodeURIComponent(user.id)}&select=id,request_type,status,reason,admin_note,requested_at,processed_at,organizations(name)&order=requested_at.desc&limit=100`,
  );
  return (
    <main className="mx-auto max-w-6xl p-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-bold text-[#70E4D4]">حسابي</p>
          <h1 className="mt-2 text-4xl font-black">الخصوصية وبياناتي</h1>
          <p className="mt-3 max-w-3xl leading-8 text-slate-300">
            نزّل نسخة فورية من بياناتك، أو أنشئ طلبًا موثقًا للتصدير أو الحذف.
            لا يُنفذ الحذف النهائي تلقائيًا لحمايتك من الفقد غير المقصود.
          </p>
        </div>
        <Link
          href="/account"
          className="rounded-xl border border-white/15 px-4 py-3 font-bold"
        >
          العودة إلى حسابي
        </Link>
      </div>
      <div className="mt-6">
        <ActionFeedback success={params.success} error={params.error} />
      </div>
      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <a
          href="/account/privacy/export/account"
          className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[.05] p-6"
        >
          <h2 className="text-2xl font-black text-emerald-100">
            تنزيل بيانات الحساب الآن
          </h2>
          <p className="mt-3 leading-7 text-slate-400">
            ملف JSON يتضمن الملف الشخصي والطلبات والإشعارات والعضويات والبلاغات
            المرتبطة بحسابك.
          </p>
        </a>
        {business ? (
          <a
            href="/account/privacy/export/workspace"
            className="rounded-3xl border border-violet-300/20 bg-violet-300/[.05] p-6"
          >
            <h2 className="text-2xl font-black text-violet-100">
              تنزيل بيانات مساحة العمل
            </h2>
            <p className="mt-3 leading-7 text-slate-400">
              نسخة من بيانات التجارة التي تملكها: المنتجات والعملاء والموردون
              والمبيعات والمصروفات والمهام.
            </p>
          </a>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 p-6 text-slate-500">
            لا تملك مساحة أعمال لتصديرها.
          </div>
        )}
      </section>
      <section className="mt-9 grid gap-7 lg:grid-cols-2">
        <form
          action={createPrivacyRequest}
          className="grid gap-4 rounded-3xl border border-white/10 bg-white/[.03] p-6"
        >
          <h2 className="text-2xl font-black">طلب رسمي جديد</h2>
          <label className="grid gap-2 font-bold">
            نوع الطلب
            <select name="request_kind" className="field rounded-xl p-3">
              <option value="export_account">
                تصدير الحساب ومراجعته إداريًا
              </option>
              {business && (
                <option value="export_workspace">
                  تصدير مساحة العمل ومراجعته إداريًا
                </option>
              )}
              <option value="delete_account">طلب حذف حسابي</option>
              {business && (
                <option value="delete_workspace">طلب حذف مساحة العمل</option>
              )}
            </select>
          </label>
          <label className="grid gap-2 font-bold">
            السبب أو الملاحظات
            <textarea
              name="reason"
              maxLength={2000}
              rows={5}
              className="field rounded-xl p-3"
            />
          </label>
          <label className="grid gap-2 font-bold">
            عبارة التأكيد عند طلب الحذف
            <input
              name="confirmation"
              className="field rounded-xl p-3"
              placeholder="حذف حسابي أو حذف مساحتي"
            />
            <span className="text-xs font-normal text-slate-500">
              اتركها فارغة لطلبات التصدير. للحذف اكتب العبارة المطابقة حرفيًا.
            </span>
          </label>
          <button className="rounded-xl bg-white p-3 font-black text-slate-950">
            تسجيل الطلب
          </button>
        </form>
        <article>
          <h2 className="text-2xl font-black">سجل الطلبات</h2>
          <div className="mt-4 space-y-4">
            {requests.length ? (
              requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-white/10 p-5"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <strong>
                        {requestLabels[request.request_type] ||
                          request.request_type}
                      </strong>
                      {request.organizations?.name && (
                        <p className="mt-1 text-xs text-slate-500">
                          {request.organizations.name}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                      {statusLabels[request.status] || request.status}
                    </span>
                  </div>
                  {request.reason && (
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      {request.reason}
                    </p>
                  )}
                  {request.admin_note && (
                    <p className="mt-3 rounded-xl bg-[#70E4D4]/10 p-3 text-sm text-[#baf7ee]">
                      رد الإدارة: {request.admin_note}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <time className="text-xs text-slate-500">
                      {new Date(request.requested_at).toLocaleString("ar-YE")}
                    </time>
                    {request.status === "requested" && (
                      <form action={cancelPrivacyRequest}>
                        <input
                          type="hidden"
                          name="request_id"
                          value={request.id}
                        />
                        <button className="text-sm font-bold text-red-200">
                          إلغاء الطلب
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-slate-500">
                لا توجد طلبات سابقة.
              </p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
