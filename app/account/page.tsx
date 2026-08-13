import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountPage } from "@/components/account/AccountPage";
import ServiceCards from "@/components/account/ServiceCards";
import { Avatar, Badge, ButtonLink, Notice } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { formatDate } from "@/src/lib/format";
import { requireUser } from "@/src/lib/auth";
import { getAccountServices } from "@/src/lib/services/server";
import { currentProfile, supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الرئيسية | حساب مَدار" };

type Usage = { tier?: "registered" | "customer" | "plus"; remaining?: number; daily_limit?: number };
type Notification = { id: string; title: string; body: string; link: string | null; created_at: string; read_at: string | null };

export default async function AccountPageRoute({ searchParams }: { searchParams: Promise<{ error?: string; service?: string; view?: string }> }) {
  const query = await searchParams;
  if (query.view === "services") redirect("/account/services");
  if (query.view === "orby") redirect("/orby");
  if (query.view === "account") redirect("/account/profile");

  const [user, profile, services, usageRaw, notificationRows] = await Promise.all([
    requireUser(),
    currentProfile(),
    getAccountServices(),
    supabaseFetch("/rest/v1/rpc/orby_usage_status", { method: "POST", body: "{}" }).catch(() => null),
    supabaseFetch("/rest/v1/notifications?select=id,title,body,link,created_at,read_at&order=created_at.desc&limit=5").catch(() => []),
  ]);
  const usage = (Array.isArray(usageRaw) ? usageRaw[0] : usageRaw) as Usage | null;
  const notifications = (notificationRows || []) as Notification[];
  const unread = notifications.filter((item) => !item.read_at).length;
  const activeServices = services.filter((service) => service.state === "ACTIVE");
  const attentionServices = services.filter((service) => !["ACTIVE", "NOT_SUBSCRIBED"].includes(service.state));
  const displayName = profile?.full_name || user.email?.split("@")[0] || "مرحبًا بك";

  return (
    <AccountPage>
      {query.error === "forbidden" ? <Notice title="ليست لديك صلاحية لفتح الصفحة المطلوبة" variant="danger" /> : null}
      {query.service === "expired" ? <Notice title="انتهى اشتراك الخدمة" variant="warning">بيانات الخدمة محفوظة. راجع الاشتراكات للتجديد.</Notice> : null}
      {query.service === "missing" || query.service === "cancelled" ? <Notice title="الخدمة غير متاحة لهذا الحساب" variant="warning">راجع حالة الخدمة أو طلب التفعيل من خدماتي.</Notice> : null}

      <section className="md-account-welcome">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar src={profile?.avatar_url ? "/account/avatar" : null} alt="صورة الحساب" size="lg" />
          <div className="min-w-0"><span className="md-eyebrow">حساب مَدار</span><h1 className="md-type-h1 mt-2 truncate">مرحبًا، {displayName}</h1><p dir="ltr" className="md-type-body-sm md-muted mt-1 truncate text-right">{user.email}</p></div>
        </div>
        <div className="md-account-primary-actions"><ButtonLink href="/account/services" variant="primary"><Icon name="layers" />فتح خدماتي</ButtonLink><ButtonLink href="/orby" variant="secondary"><Icon name="sparkles" />اسأل ORBY</ButtonLink></div>
      </section>

      {attentionServices.length || unread ? (
        <section className="md-account-section md-attention-section">
          <div><span className="md-eyebrow">يحتاج انتباهك</span><h2>ما الذي ينتظر إجراءً؟</h2></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {attentionServices.map((service) => <Link key={service.definition.code} href={service.href || "/account/services"} className="md-account-attention-item"><span><strong>{service.definition.shortName}</strong><small>الحالة الحالية تحتاج مراجعتك</small></span><Icon name="arrow" /></Link>)}
            {unread ? <Link href="/account/notifications" className="md-account-attention-item"><span><strong>{unread} إشعارات غير مقروءة</strong><small>راجع آخر تحديثات حسابك وطلباتك</small></span><Icon name="arrow" /></Link> : null}
          </div>
        </section>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,.65fr)]">
        <section className="md-account-section">
          <div className="flex items-end justify-between gap-3"><div><span className="md-eyebrow">ماذا أملك؟</span><h2>الخدمات النشطة</h2></div><Link href="/account/services" className="md-button md-button-ghost md-button-sm">كل الخدمات</Link></div>
          <div className="mt-5"><ServiceCards services={activeServices} compact emptyTitle="لا توجد خدمة نشطة بعد" emptyDescription="راجع خدماتك لمعرفة حالة التفعيل أو الإجراء المطلوب." emptyHref="/account/services" emptyAction="عرض حالة خدماتي" /></div>
        </section>
        <div className="grid content-start gap-5">
          <section className="md-account-section">
            <div className="flex items-start justify-between gap-3"><div><span className="md-eyebrow">ORBY</span><h2>مساعدك في مكان واحد</h2></div><Badge variant={usage?.tier === "plus" ? "success" : "default"}>{usage?.tier === "plus" ? "Plus" : activeServices.length ? "Customer" : "Free"}</Badge></div>
            <p className="md-type-body-sm md-muted mt-3">افتح محادثة عامة من هنا، أو ادخل من الخدمة ليُضبط سياقها تلقائيًا.</p>
            {usage?.tier !== "plus" ? <p className="md-type-caption md-muted mt-3">المتبقي اليوم: {Number(usage?.remaining ?? 5)} من {Number(usage?.daily_limit ?? 5)}</p> : null}
            <ButtonLink href="/orby" variant="primary" className="mt-4 w-full">فتح ORBY</ButtonLink>
          </section>
          <section className="md-account-section"><h2>وصول سريع</h2><div className="mt-3 grid grid-cols-2 gap-2"><QuickLink href="/account/subscriptions" icon="clock" label="الاشتراكات" /><QuickLink href="/account/orders" icon="document" label="الطلبات" /><QuickLink href="/account/purchases" icon="briefcase" label="المكتبة" /><QuickLink href="/account/profile" icon="user" label="الحساب" /></div></section>
        </div>
      </div>

      <section className="md-account-section mt-5">
        <div className="flex items-end justify-between gap-3"><div><span className="md-eyebrow">ماذا حدث؟</span><h2>آخر التحديثات</h2></div><Link href="/account/notifications" className="md-button md-button-ghost md-button-sm">كل الإشعارات</Link></div>
        <div className="mt-4 grid gap-2">{notifications.length ? notifications.map((item) => <Link key={item.id} href={item.link || "/account/notifications"} className="md-account-activity"><span className={!item.read_at ? "is-unread" : ""} /><div><strong>{item.title}</strong><p>{item.body}</p></div><time dateTime={item.created_at}>{formatDate(item.created_at)}</time></Link>) : <p className="md-account-empty-line">لا توجد تحديثات بعد. ستظهر هنا أحداث الخدمات والطلبات المهمة.</p>}</div>
      </section>
    </AccountPage>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: "clock" | "document" | "briefcase" | "user"; label: string }) {
  return <Link href={href} className="md-account-quick-link"><Icon name={icon} className="h-4 w-4" /><span>{label}</span></Link>;
}
