import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountPage } from "@/components/account/AccountPage";
import ServiceCards from "@/components/account/ServiceCards";
import { Avatar, Badge, ButtonLink, ErrorState, Input, Notice, StatusBadge } from "@/components/ui/Enterprise";
import { Icon, type IconName } from "@/components/ui/Icons";
import { formatCurrency, formatDate, formatDateTime } from "@/src/lib/format";
import { getAccountHomeData } from "@/src/lib/account/server";
import { attentionForService, daysUntil, sortAccountServices, type AttentionItem } from "@/src/lib/account/presentation";

export const dynamic = "force-dynamic";
export const metadata = { title: "الرئيسية | حساب مَدار" };

export default async function AccountPageRoute({ searchParams }: { searchParams: Promise<{ error?: string; service?: string; view?: string }> }) {
  const query = await searchParams;
  if (query.view === "services") redirect("/account/services");
  if (query.view === "orby") redirect("/orby");
  if (query.view === "account") redirect("/account/profile");

  // getAccountHomeData composes getAccountServices; «فتح خدماتي» remains the canonical service entry in the shell.
  const data = await getAccountHomeData();
  const { identity } = data;
  const services = sortAccountServices(data.services);
  const activeServices = services.filter((service) => service.state === "ACTIVE");
  const serviceAttention = services.map(attentionForService).filter(Boolean) as AttentionItem[];
  const expiryAttention = activeServices
    .filter((service) => service.subscription && daysUntil(service.subscription.ends_at) <= 14)
    .map((service): AttentionItem => ({
      key: `expiry-${service.definition.code}`,
      title: `اشتراك ${service.definition.shortName} يقترب من الانتهاء`,
      description: `ينتهي في ${formatDate(service.subscription!.ends_at)}.`,
      href: "/account/subscriptions",
      tone: "warning",
    }));
  const storeAttention = data.orders.data
    .filter((order) => ["unpaid", "rejected"].includes(order.payment_status))
    .map((order): AttentionItem => ({
      key: `order-${order.id}`,
      title: order.payment_status === "rejected" ? "راجع دفعة طلب المتجر" : "أكمل دفع طلب المتجر",
      description: `الطلب ${order.order_number} يحتاج إجراءً قبل اكتماله.`,
      href: `/account/orders/${order.id}`,
      tone: order.payment_status === "rejected" ? "danger" : "warning",
    }));
  const plusAttention: AttentionItem[] = data.plusPayment.data?.status === "rejected" ? [{
    key: `orby-payment-${data.plusPayment.data.id}`,
    title: "راجع طلب ORBY Plus",
    description: data.plusPayment.data.review_note || "تعذر اعتماد الدفعة الحالية.",
    href: "/orby/plus",
    tone: "danger",
  }] : [];
  const attention = [...storeAttention, ...expiryAttention, ...serviceAttention, ...plusAttention];
  const heroAction = attention.find((item) => item.tone !== "info") || null;
  const profileIncomplete = !identity.profile?.full_name;
  const usage = data.usage.data;
  const notifications = identity.shell.notifications;

  return (
    <AccountPage>
      {query.error === "forbidden" ? <Notice title="ليست لديك صلاحية لفتح الصفحة المطلوبة" variant="danger" /> : null}
      {query.service === "expired" ? <Notice title="انتهى اشتراك الخدمة" variant="warning">بيانات الخدمة محفوظة. راجع الاشتراكات للتجديد.</Notice> : null}
      {query.service === "missing" || query.service === "cancelled" ? <Notice title="الخدمة غير متاحة لهذا الحساب" variant="warning">راجع حالة الخدمة أو اطلب التفعيل من خدماتي.</Notice> : null}

      <section className="md-account-welcome md-home-welcome">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar src={identity.shell.hasAvatar ? "/account/avatar" : null} alt="صورة الحساب" size="lg" />
          <div className="min-w-0">
            <span className="md-eyebrow">مركز حساب مَدار</span>
            <h1 className="md-type-h1 mt-2 truncate">مرحبًا، {identity.shell.displayName}</h1>
            <p className="md-type-body-sm md-muted mt-1">{activeServices.length ? `لديك ${activeServices.length.toLocaleString("ar-YE")} ${activeServices.length === 1 ? "خدمة نشطة" : "خدمات نشطة"}.` : "حسابك جاهز؛ اختر الخدمة التي تناسب تجارتك أو ابدأ مع ORBY."}</p>
            {profileIncomplete ? <Link href="/account/profile" className="md-home-profile-prompt">أكمل بيانات التواصل الأساسية</Link> : null}
          </div>
        </div>
        {heroAction ? <ButtonLink href={heroAction.href} variant={heroAction.tone === "danger" ? "danger" : "primary"}>{heroAction.title}<Icon name="arrow" className="md-icon-directional" /></ButtonLink> : null}
      </section>

      {attention.length ? <section className="md-account-section md-attention-section" aria-labelledby="attention-title">
        <div><span className="md-eyebrow">يحتاج انتباهك</span><h2 id="attention-title">الإجراءات والحالات المهمة</h2></div>
        <div className="md-home-attention-list">{attention.slice(0, 5).map((item) => <Link key={item.key} href={item.href} className={`md-account-attention-item is-${item.tone}`}><span><strong>{item.title}</strong><small>{item.description}</small></span><Icon name="arrow" className="md-icon-directional" /></Link>)}</div>
      </section> : null}

      <section className="md-account-section md-home-services" aria-labelledby="services-title">
        <div className="md-home-section-heading"><div><span className="md-eyebrow">ماذا أملك؟</span><h2 id="services-title">خدماتي</h2><p className="md-type-body-sm md-muted">الخدمات الثلاث وحالتها الفعلية، مرتبة حسب ما تستخدمه وما يحتاج إجراءً.</p></div><Link href="/account/services" className="md-button md-button-ghost md-button-sm">تفاصيل الخدمات</Link></div>
        <div className="mt-5"><ServiceCards services={services} compact /></div>
      </section>

      <div className="md-home-dashboard-grid">
        <section className="md-account-section md-home-orby" aria-labelledby="orby-title">
          <div className="md-home-section-heading"><div><span className="md-eyebrow">ORBY</span><h2 id="orby-title">اسأل بطريقتك</h2></div><Badge variant={usage?.tier === "plus" ? "success" : "default"}>{usage?.tier === "plus" ? "Plus" : activeServices.length ? "Customer" : "Free"}</Badge></div>
          <p className="md-type-body-sm md-muted mt-2">ابدأ سؤالًا عامًا من هنا. عند فتح ORBY من داخل خدمة، يُضبط سياق المساحة تلقائيًا.</p>
          <form action="/orby" className="md-home-orby-composer"><label htmlFor="home-orby-starter" className="sr-only">رسالتك إلى ORBY</label><Input id="home-orby-starter" name="starter" maxLength={500} placeholder="اسأل ORBY أي شيء…" required /><button type="submit" className="md-button md-button-primary"><Icon name="send" />فتح المحادثة</button></form>
          {data.usage.failed ? <p className="md-type-caption md-muted mt-3">تعذر تحديث حد الاستخدام الآن؛ ما زال بإمكانك فتح ORBY.</p> : usage?.tier !== "plus" ? <p className="md-type-caption md-muted mt-3">المتبقي اليوم: {Number(usage?.remaining ?? 5).toLocaleString("ar-YE")} من {Number(usage?.daily_limit ?? 5).toLocaleString("ar-YE")}</p> : null}
        </section>

        <section className="md-account-section" aria-labelledby="subscriptions-title">
          <div className="md-home-section-heading"><div><span className="md-eyebrow">الملكية المستمرة</span><h2 id="subscriptions-title">الاشتراكات</h2></div><Link href="/account/subscriptions" className="md-button md-button-ghost md-button-sm">إدارة</Link></div>
          <div className="md-home-summary-list">
            {activeServices.map((service) => <SummaryRow key={service.definition.code} icon={service.definition.icon} title={service.definition.shortName} detail={service.subscription ? `ينتهي ${formatDate(service.subscription.ends_at)}` : "نشط"} status="نشط" />)}
            {data.plusSubscription.data?.status === "active" ? <SummaryRow icon="sparkles" title="ORBY Plus" detail={`ينتهي ${formatDate(data.plusSubscription.data.ends_at)}`} status="نشط" /> : null}
            {!activeServices.length && data.plusSubscription.data?.status !== "active" ? <p className="md-account-empty-line">لا توجد اشتراكات نشطة. تظهر الخطط والتجديدات هنا بعد التفعيل.</p> : null}
          </div>
        </section>
      </div>

      <div className="md-home-dashboard-grid">
        {data.library.failed ? <ErrorState title="تعذر تحميل المكتبة" description="يمكنك فتح مكتبتك والمحاولة مجددًا دون أن تتأثر بقية الصفحة." action={<ButtonLink href="/account/purchases" variant="secondary">فتح مكتبتي</ButtonLink>} /> : data.library.data.length ? <section className="md-account-section" aria-labelledby="library-title">
          <div className="md-home-section-heading"><div><span className="md-eyebrow">مشترياتك الرقمية</span><h2 id="library-title">مكتبتي</h2></div><Link href="/account/purchases" className="md-button md-button-ghost md-button-sm">عرض الكل</Link></div>
          <div className="md-home-summary-list">{data.library.data.map((item) => <SummaryRow key={item.id} icon="book" title={item.product_name} detail={`${formatCurrency(item.original_amount, item.original_currency)} · ${formatDate(item.purchased_at)}`} href={`/account/purchases/${item.id}/download`} action="تحميل" />)}</div>
        </section> : null}

        <section className="md-account-section" aria-labelledby="notifications-title">
          <div className="md-home-section-heading"><div><span className="md-eyebrow">ماذا حدث؟</span><h2 id="notifications-title">آخر التحديثات</h2></div><Link href="/account/notifications" className="md-button md-button-ghost md-button-sm">كل الإشعارات</Link></div>
          <div className="md-home-activity-list">{notifications.length ? notifications.map((item) => <Link key={item.id} href={item.href} className="md-account-activity"><span className={!item.read ? "is-unread" : ""} aria-hidden="true" /><div><strong>{item.title}</strong><p>{item.body}</p></div><time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time></Link>) : <p className="md-account-empty-line">لا توجد تحديثات بعد. ستظهر هنا أحداث الخدمات والطلبات المهمة.</p>}</div>
        </section>
      </div>

      <section className="md-home-quick-access" aria-label="وصول سريع"><QuickLink href="/account/payments" icon="document" label="مدفوعاتي" /><QuickLink href="/account/purchases" icon="briefcase" label="مكتبتي" /><QuickLink href="/account/orby" icon="sparkles" label="خطة ORBY" /><QuickLink href="/account/profile" icon="user" label="الملف الشخصي" /></section>
    </AccountPage>
  );
}

function SummaryRow({ icon, title, detail, status, href, action }: { icon: IconName; title: string; detail: string; status?: string; href?: string; action?: string }) {
  const content = <><span className="md-home-summary-icon"><Icon name={icon} /></span><span className="min-w-0 flex-1"><strong>{title}</strong><small>{detail}</small></span>{status ? <StatusBadge status="active">{status}</StatusBadge> : action ? <span className="md-button md-button-ghost md-button-sm">{action}</span> : null}</>;
  return href ? <Link href={href} className="md-home-summary-row">{content}</Link> : <div className="md-home-summary-row">{content}</div>;
}

function QuickLink({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return <Link href={href} className="md-account-quick-link"><Icon name={icon} className="h-4 w-4" /><span>{label}</span></Link>;
}
