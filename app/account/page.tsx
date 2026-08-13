import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Badge, ButtonLink, Notice } from "@/components/ui/Enterprise";
import { Icon, type IconName } from "@/components/ui/Icons";
import PageShell from "@/components/ui/PageShell";
import { requireUser } from "@/src/lib/auth";
import { serviceStateCtas, serviceStateLabels, type ServiceState } from "@/src/lib/services/catalog";
import { getAccountServices, type AccountService } from "@/src/lib/services/server";
import { currentProfile, supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

type AccountView = "overview" | "services" | "orby" | "account";
type Usage = { tier?: "registered" | "customer" | "plus"; remaining?: number; daily_limit?: number; used?: number };

const views: Array<{ key: AccountView; label: string; icon: IconName }> = [
  { key: "overview", label: "نظرة عامة", icon: "home" },
  { key: "services", label: "الخدمات", icon: "layers" },
  { key: "orby", label: "ORBY", icon: "sparkles" },
  { key: "account", label: "الحساب", icon: "user" },
];
const badgeVariant = (state: ServiceState) =>
  state === "ACTIVE" ? "success" as const
    : state === "PENDING_APPROVAL" || state === "SETUP_REQUIRED" ? "warning" as const
      : state === "REJECTED" || state === "SUSPENDED" || state === "EXPIRED" ? "danger" as const
        : "default" as const;
const viewFrom = (value?: string): AccountView => views.some((item) => item.key === value) ? value as AccountView : "overview";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; view?: string }> }) {
  const query = await searchParams;
  const view = viewFrom(query.view);
  const [user, profile, accountServices, usageRaw, notificationRows] = await Promise.all([
    requireUser(),
    currentProfile(),
    getAccountServices(),
    supabaseFetch("/rest/v1/rpc/orby_usage_status", { method: "POST", body: "{}" }).catch(() => null),
    supabaseFetch("/rest/v1/notifications?read_at=is.null&select=id").catch(() => []),
  ]);
  const usage = (Array.isArray(usageRaw) ? usageRaw[0] : usageRaw) as Usage | null;
  const unread = notificationRows?.length || 0;
  const activeServices = accountServices.filter((service) => service.state === "ACTIVE");
  const activeCount = activeServices.length;
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(profile?.role || "");
  const planLabel = usage?.tier === "plus" ? "ORBY Plus" : activeCount ? "ORBY Customer" : "ORBY Free";

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        {query.error === "forbidden" ? <Notice title="ليست لديك صلاحية لفتح الصفحة المطلوبة" variant="danger" /> : null}

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-l from-violet-400/[.09] via-white/[.025] to-emerald-300/[.07]">
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-4">
              {profile?.avatar_url ? (
                <Image src="/account/avatar" alt="صورة الحساب" width={72} height={72} unoptimized className="h-16 w-16 shrink-0 rounded-2xl border border-white/10 object-cover sm:h-18 sm:w-18" />
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 bg-violet-300/10 text-violet-100"><Icon name="user" className="h-7 w-7" /></span>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="md-eyebrow">حساب مَدار</span><Badge variant="success">نشط</Badge></div>
                <h1 className="mt-2 truncate text-2xl font-black sm:text-3xl">{profile?.full_name || "مرحبًا بك"}</h1>
                <p dir="ltr" className="mt-1 truncate text-right text-sm text-slate-400">{user.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[22rem]">
              <SummaryStat label="خدمات نشطة" value={activeCount} />
              <SummaryStat label="إشعارات" value={unread} />
              <SummaryStat label="خطة ORBY" value={usage?.tier === "plus" ? "Plus" : activeCount ? "20/يوم" : "5/يوم"} />
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-2 sm:px-5" aria-label="أقسام الحساب">
            {views.map((item) => (
              <Link key={item.key} href={`/account?view=${item.key}`} aria-current={view === item.key ? "page" : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${view === item.key ? "bg-white/[.09] text-white" : "text-slate-400 hover:bg-white/[.04] hover:text-slate-200"}`}>
                <Icon name={item.icon} className="h-4 w-4" />{item.label}
              </Link>
            ))}
          </nav>
        </section>

        {view === "overview" ? <OverviewView services={accountServices} usage={usage} unread={unread} /> : null}
        {view === "services" ? <ServicesView services={accountServices} /> : null}
        {view === "orby" ? <OrbyView services={activeServices} usage={usage} planLabel={planLabel} /> : null}
        {view === "account" ? <AccountViewPanel isAdmin={isAdmin} /> : null}
      </main>
    </PageShell>
  );
}

function OverviewView({ services, usage, unread }: { services: AccountService[]; usage: Usage | null; unread: number }) {
  const active = services.filter((service) => service.state === "ACTIVE");
  const actionService = active[0] || services.find((service) => service.href) || services[0];
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
      <section className="md-panel p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3"><div><span className="md-eyebrow">خدماتي</span><h2 className="mt-2 text-2xl font-black">ما الذي يعمل الآن؟</h2></div><Link href="/account?view=services" className="md-button md-button-ghost md-button-sm">كل الخدمات</Link></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {services.map((service) => (
            <article key={service.definition.code} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
              <div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/10 text-violet-100"><Icon name={service.definition.icon} className="h-4 w-4" /></span><Badge variant={badgeVariant(service.state)}>{serviceStateLabels[service.state]}</Badge></div>
              <h3 className="mt-4 font-black">{service.definition.shortName}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{service.definition.description}</p>
              {service.href ? <Link href={service.href} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-violet-200">{serviceStateCtas[service.state]}<Icon name="arrow" className="h-3 w-3" /></Link> : null}
            </article>
          ))}
        </div>
      </section>

      <div className="grid content-start gap-5">
        <section className="md-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">ORBY</span><h2 className="mt-2 text-xl font-black">مساعدك جاهز</h2></div><Badge variant={usage?.tier === "plus" ? "success" : "default"}>{usage?.tier === "plus" ? "Plus" : active.length ? "Customer" : "Free"}</Badge></div>
          <p className="mt-3 text-sm leading-7 text-slate-400">ابدأ محادثة عامة، أو افتح ORBY داخل سياق خدمة نشطة دون إنشاء مساعد منفصل.</p>
          {usage?.tier !== "plus" ? <p className="mt-3 text-xs text-slate-500">المتبقي اليوم: {Number(usage?.remaining ?? 5)} من {Number(usage?.daily_limit ?? 5)}</p> : <p className="mt-3 text-xs text-violet-200">استخدام مرن مع Fair-use خلفية.</p>}
          <div className="mt-4 grid gap-2"><ButtonLink href="/orby" variant="primary"><Icon name="sparkles" />فتح ORBY</ButtonLink><ButtonLink href="/account?view=orby" variant="ghost">الخطة والسياقات</ButtonLink></div>
        </section>
        <section className="md-panel p-5"><h3 className="font-black">وصول سريع</h3><div className="mt-3 grid grid-cols-2 gap-2"><QuickLink href="/account/notifications" icon="bell" label={`الإشعارات ${unread ? `(${unread})` : ""}`} /><QuickLink href="/account/orders" icon="store" label="الطلبات" /><QuickLink href="/account/profile" icon="settings" label="الملف الشخصي" /><QuickLink href={actionService?.href || "/account?view=services"} icon="arrow" label="فتح خدمة" /></div></section>
      </div>
    </div>
  );
}

function ServicesView({ services }: { services: AccountService[] }) {
  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><span className="md-eyebrow">خدمات مَدار</span><h2 className="mt-2 text-2xl font-black">الخدمات والاشتراكات</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">كل بطاقة تمثل خدمة مستقلة وحالتها الفعلية. الدخول إلى الخدمة النشطة يمر عبر الاستحقاق والمساحة الخاصة بها.</p></div></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {services.map((service) => (
          <article key={service.definition.code} className={`overflow-hidden rounded-3xl border bg-white/[.02] ${service.state === "ACTIVE" ? "border-emerald-300/20" : "border-white/10"}`}>
            <div className="relative aspect-[16/10] overflow-hidden bg-black/25"><Image src={service.definition.coverImage} alt={`صورة ${service.definition.name}`} fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover" /></div>
            <div className="p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black">{service.definition.name}</h3><p className="mt-1 text-xs text-slate-500">{service.definition.description}</p></div><Badge variant={badgeVariant(service.state)}>{serviceStateLabels[service.state]}</Badge></div>
              <p className="mt-4 text-sm leading-7 text-slate-400">{service.definition.detail}</p>
              {service.subscription ? <p className="mt-3 text-xs text-slate-500">ينتهي: {new Date(service.subscription.ends_at).toLocaleDateString("ar-YE")}</p> : null}
              {service.request?.rejection_reason && service.state === "REJECTED" ? <p className="mt-3 text-sm text-rose-200">{service.request.rejection_reason}</p> : null}
              <div className="mt-5 grid gap-2">
                {service.href ? <ButtonLink href={service.href} variant={service.state === "ACTIVE" ? "primary" : "secondary"}>{serviceStateCtas[service.state]}<Icon name="arrow" /></ButtonLink> : <button disabled className="md-button md-button-secondary">{serviceStateCtas[service.state]}</button>}
                {service.state === "ACTIVE" && service.subscription?.organization_id ? <Link href={`/orby?conversation=new&organization=${encodeURIComponent(service.subscription.organization_id)}`} className="md-button md-button-ghost text-xs"><Icon name="sparkles" />ORBY في سياق الخدمة</Link> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrbyView({ services, usage, planLabel }: { services: AccountService[]; usage: Usage | null; planLabel: string }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="md-panel p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><span className="md-eyebrow">ORBY Plan</span><h2 className="mt-2 text-2xl font-black">{planLabel}</h2></div><Icon name="sparkles" className="h-7 w-7 text-violet-200" /></div>
        <p className="mt-3 text-sm leading-7 text-slate-400">ORBY واحد للحساب. المحادثات العامة وسياقات الخدمات تستخدم نفس الهوية والتاريخ، بينما بيانات كل مساحة تبقى معزولة.</p>
        {usage?.tier === "plus" ? <p className="mt-4 rounded-xl border border-violet-300/20 bg-violet-300/10 p-3 text-sm text-violet-100">Plus فعال: لا يظهر عداد يومي للمنتج، مع استمرار Fair-use والحماية الخلفية.</p> : <div className="mt-4 rounded-xl border border-white/10 bg-white/[.025] p-4"><span className="text-xs text-slate-500">استخدام اليوم</span><strong className="mt-1 block text-2xl">{Number(usage?.used ?? 0)} / {Number(usage?.daily_limit ?? 5)}</strong><p className="mt-1 text-xs text-slate-500">متبقي {Number(usage?.remaining ?? 5)} رسالة</p></div>}
        <div className="mt-5 flex flex-wrap gap-2"><ButtonLink href="/orby" variant="primary">فتح ORBY</ButtonLink><ButtonLink href="/orby/plus" variant="secondary">إدارة ORBY Plus</ButtonLink></div>
      </section>
      <section className="md-panel p-5 sm:p-6"><span className="md-eyebrow">سياقات الأعمال</span><h2 className="mt-2 text-xl font-black">اختر السياق عند الحاجة</h2><p className="mt-2 text-sm leading-7 text-slate-400">المحادثة العامة لا تقرأ بيانات الأعمال. فتح سياق خدمة يصرّح لـORBY بقراءة تلك المساحة فقط.</p><div className="mt-4 grid gap-2">{services.length ? services.map((service) => <Link key={service.definition.code} href={`/orby?conversation=new&organization=${encodeURIComponent(service.subscription?.organization_id || "")}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 hover:bg-white/[.045]"><div><strong className="text-sm">{service.definition.shortName}</strong><p className="mt-1 text-xs text-slate-500">{service.subscription?.organization_id ? "سياق نشط ومعزول" : "غير متاح"}</p></div><Icon name="arrow" className="h-4 w-4" /></Link>) : <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">لا توجد خدمة مدفوعة نشطة حاليًا. ORBY العام متاح لك رغم ذلك.</p>}</div></section>
    </div>
  );
}

function AccountViewPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <section className="md-panel p-5 sm:p-6"><span className="md-eyebrow">إدارة الحساب</span><h2 className="mt-2 text-2xl font-black">بياناتك وإعداداتك</h2><div className="mt-5 grid gap-2 sm:grid-cols-2"><QuickLink href="/account/profile" icon="settings" label="الملف الشخصي" /><QuickLink href="/account/notifications" icon="bell" label="الإشعارات" /><QuickLink href="/account/orders" icon="store" label="طلبات المتجر" /><QuickLink href="/account/privacy" icon="shield" label="الخصوصية والبيانات" /><QuickLink href="/account/support" icon="help" label="الدعم" />{isAdmin ? <QuickLink href="/admin" icon="shield" label="إدارة مَدار" /> : null}</div></section>
      <section className="md-panel p-5 sm:p-6"><span className="md-eyebrow">الجلسة</span><h2 className="mt-2 text-xl font-black">تسجيل الخروج</h2><p className="mt-2 text-sm leading-7 text-slate-400">يُنهي الجلسة الحالية على هذا المتصفح. لن تُحذف خدماتك أو بياناتك أو محادثات ORBY المحفوظة.</p><form action={logout} className="mt-5"><button className="md-button md-button-danger">تسجيل الخروج</button></form></section>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-center"><span className="block text-[10px] text-slate-500">{label}</span><strong className="mt-1 block truncate text-sm sm:text-base">{value}</strong></div>;
}
function QuickLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return <Link href={href} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/[.05] hover:text-white"><Icon name={icon} className="h-4 w-4" /><span>{label}</span></Link>;
}
