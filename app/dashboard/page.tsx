import Link from "next/link";
import { redirect } from "next/navigation";
import PageShell from "@/components/ui/PageShell";
import { PageHero, Section } from "@/components/ui/Section";
import {
  Badge,
  ButtonLink,
  Card,
  Grid,
  Notice,
} from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { requireUser } from "@/src/lib/auth";
import { currentProfile, supabaseFetch } from "@/src/lib/supabase/server";
import {
  organizationTypeLabels,
  type OrganizationType,
} from "@/src/lib/workspace";
export const dynamic = "force-dynamic";

const roleLabels: Record<string, string> = {
  OWNER: "المالك",
  ADMIN: "مدير",
  EDITOR: "محرر",
  VIEWER: "مشاهد",
};
const statusLabels: Record<string, string> = {
  active: "نشطة",
  suspended: "موقوفة",
  archived: "مؤرشفة",
  pending: "قيد الانتظار",
};

export default async function Page() {
  const user = await requireUser(),
    profile = await currentProfile();
  if (profile?.account_type === "PERSONAL") redirect("/student");
  const rows = await supabaseFetch(
    `/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,slug,type,status)`,
  );
  const membership = rows?.find(
      (item: { organizations?: { type?: string } }) =>
        item.organizations?.type !== "STUDENT",
    ),
    workspace = membership?.organizations;
  if (!workspace) {
    const requests = await supabaseFetch(
        `/rest/v1/workspace_requests?user_id=eq.${user.id}&select=id,name,status,rejection_reason&order=created_at.desc&limit=1`,
      ),
      request = requests?.[0];
    if (!request) redirect("/onboarding");
    if (request.status === "pending_payment")
      redirect(`/workspace-payment/${request.id}`);
    return (
      <PageShell>
        <PageHero
          eyebrow="مساحة العميل"
          title="حالة طلب مساحة العمل"
          description="تابع مراجعة طلبك من مكان واحد، وستُفتح المساحة تلقائيًا بعد الاعتماد."
        />
        <Section>
          <Card className="mx-auto max-w-3xl">
            <Badge
              variant={
                request.status === "pending_review" ? "warning" : "danger"
              }
            >
              {request.status === "pending_review"
                ? "قيد المراجعة"
                : "لم يُعتمد"}
            </Badge>
            <h2 className="mt-4 text-2xl font-black">{request.name}</h2>
            {request.status === "pending_review" ? (
              <Notice title="الدفع قيد المراجعة" variant="warning">
                ستفتح مساحتك تلقائيًا بمجرد موافقة إدارة مَدار.
              </Notice>
            ) : (
              <div className="mt-5">
                <Notice title="تم رفض الطلب" variant="danger">
                  {request.rejection_reason ||
                    "يرجى التواصل مع الدعم لمعرفة التفاصيل."}
                </Notice>
                <ButtonLink
                  href="/contact"
                  variant="secondary"
                  className="mt-5"
                >
                  تواصل مع الدعم
                </ButtonLink>
              </div>
            )}
          </Card>
        </Section>
      </PageShell>
    );
  }
  const complete = Boolean(profile?.full_name && profile?.phone),
    role = roleLabels[membership.role] || "عضو",
    status = statusLabels[workspace.status] || "غير محددة";
  const steps = [
    ["استكمال الملف الشخصي", complete],
    ["إنشاء مساحة عمل", true],
    ["إضافة أول منتج", false],
    ["تسجيل أول عميل", false],
    ["تسجيل أول عملية بيع", false],
    ["إضافة أعضاء عند الحاجة", false],
  ] as const;
  return (
    <PageShell>
      <PageHero
        eyebrow="مساحة العميل"
        title={`مرحبًا ${profile?.full_name || "بك"}`}
        description="تابع مساحة عملك وخطوات البدء وروابط التشغيل الأساسية من لوحة واحدة واضحة."
      />
      <Section>
        <Card className="border-violet-300/20 bg-gradient-to-l from-violet-400/10 to-emerald-400/5">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="brand">
                  {organizationTypeLabels[workspace.type as OrganizationType]}
                </Badge>
                <Badge
                  variant={
                    workspace.status === "active" ? "success" : "warning"
                  }
                >
                  {status}
                </Badge>
              </div>
              <h2 className="mt-4 text-3xl font-black">{workspace.name}</h2>
              <p className="mt-3 text-slate-300">
                صلاحيتك: {role} · البريد الإلكتروني{" "}
                {user.email_confirmed_at ? "مؤكد" : "بانتظار التأكيد"}
              </p>
            </div>
            <ButtonLink href="/workspace" size="lg">
              <Icon name="automation" />
              فتح مركز تشغيل التجارة
            </ButtonLink>
          </div>
        </Card>
        <Grid className="mt-6 md:grid-cols-2" auto={false}>
          <Card>
            <h2 className="text-xl font-black">خطوات البداية</h2>
            <ul className="mt-5 grid gap-3">
              {steps.map(([label, done]) => (
                <li
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3"
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-lg ${done ? "bg-emerald-300/10 text-emerald-200" : "bg-white/[.04] text-slate-500"}`}
                  >
                    <Icon
                      name={done ? "check" : "layers"}
                      className="h-4 w-4"
                    />
                  </span>
                  <span className={done ? "text-slate-200" : "text-slate-400"}>
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-xl font-black">روابط سريعة</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link className="md-button md-button-primary" href="/workspace">
                تشغيل النشاط
              </Link>
              <Link
                className="md-button md-button-secondary"
                href="/workspace/setup"
              >
                إعداد القطاع
              </Link>
              <Link
                className="md-button md-button-secondary"
                href="/account/subscription"
              >
                الباقة والفوترة
              </Link>
              <Link
                className="md-button md-button-secondary"
                href="/dashboard-app"
              >
                تطبيق لوحة القيادة
              </Link>
              <Link
                className="md-button md-button-secondary"
                href="/retail/onboarding"
              >
                MADAR Retail
              </Link>
            </div>
          </Card>
          <Card className="border-emerald-300/20 bg-emerald-300/[.04] md:col-span-2">
            <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <div>
                <Badge variant="success">Retail Small Business OS</Badge>
                <h2 className="mt-3 text-2xl font-black">تشغيل متجر التجزئة من داخل مَدار</h2>
                <p className="mt-2 max-w-2xl text-slate-300">نفس الحساب وصلاحيات المساحة، مع قاعدة Retail مستقلة للمبيعات والمخزون والصندوق والديون وORBY.</p>
              </div>
              <ButtonLink href="/retail/onboarding" size="lg">
                <Icon name="store" />
                فتح MADAR Retail
              </ButtonLink>
            </div>
          </Card>
        </Grid>
      </Section>
    </PageShell>
  );
}
