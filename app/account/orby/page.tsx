import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Badge, ButtonLink, ErrorState, Stat, StatusBadge } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { getOrbyAccountData } from "@/src/lib/account/server";
import { formatCurrency, formatDate } from "@/src/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "ORBY والحساب | مَدار" };

export default async function AccountOrbyPage() {
  const data = await getOrbyAccountData();
  const usage = data.usage.data;
  const subscription = data.subscription.data;
  const payment = data.payment.data;
  const tier = usage?.tier === "plus" ? "Plus" : usage?.tier === "customer" ? "Customer" : "Free";
  return <AccountPage>
    <AccountPageHeader eyebrow="ORBY في حسابك" title="الخطة والاستخدام" description="ملخص هادئ لخطة ORBY وحد الاستخدام وطلب Plus. المحادثات نفسها تبقى داخل ORBY." actions={<ButtonLink href="/orby"><Icon name="sparkles" />فتح ORBY</ButtonLink>} />
    {data.usage.failed || data.subscription.failed || data.payment.failed ? <ErrorState title="تعذر تحديث جزء من بيانات ORBY" description="يمكنك متابعة المحادثة بصورة طبيعية، ثم العودة لتحديث بيانات الخطة." action={<ButtonLink href="/account/orby" variant="secondary">إعادة المحاولة</ButtonLink>} /> : null}
    <section className="md-account-section md-orby-account-summary">
      <div className="md-home-section-heading"><div><span className="md-eyebrow">الخطة الحالية</span><h2>ORBY {tier}</h2></div><Badge variant={tier === "Plus" ? "success" : "default"}>{tier}</Badge></div>
      <div className="md-orby-account-stats">
        <Stat label="الحد اليومي" value={tier === "Plus" ? "استخدام مرن" : Number(usage?.daily_limit ?? 5).toLocaleString("ar-YE")} detail={tier === "Plus" ? "تطبق حماية الاستخدام العادل في الخلفية" : "رسالة يوميًا حسب أهلية الحساب"} />
        <Stat label="المتبقي اليوم" value={tier === "Plus" ? "—" : Number(usage?.remaining ?? 5).toLocaleString("ar-YE")} detail="يتجدد وفق سياسة ORBY الحالية" />
        <Stat label="السياق" value="حساب واحد" detail="عام أو مساحة الخدمة التي فتحت ORBY منها" />
      </div>
    </section>
    {subscription ? <section className="md-account-section"><div className="md-home-section-heading"><div><span className="md-eyebrow">ORBY Plus</span><h2>تفاصيل الاشتراك</h2></div><StatusBadge status={subscription.status === "active" ? "active" : "expired"}>{subscription.status === "active" ? "نشط" : "غير نشط"}</StatusBadge></div><dl className="md-account-detail-grid"><div><dt>البداية</dt><dd>{formatDate(subscription.starts_at)}</dd></div><div><dt>الانتهاء</dt><dd>{formatDate(subscription.ends_at)}</dd></div></dl><ButtonLink href="/orby/plus" variant="secondary" className="mt-5">إدارة Plus</ButtonLink></section> : payment?.status === "under_review" ? <section className="md-account-section"><div className="md-home-section-heading"><div><span className="md-eyebrow">طلب الترقية</span><h2>دفعة Plus قيد المراجعة</h2></div><StatusBadge status="pending">قيد المراجعة</StatusBadge></div><p className="md-type-body-sm md-muted mt-3">استلمنا الطلب بقيمة {formatCurrency(payment.payment_amount, payment.payment_currency)}. ستتحدث الخطة بعد اعتماد الدفعة.</p><ButtonLink href="/orby/plus" variant="secondary" className="mt-5">عرض الطلب</ButtonLink></section> : <section className="md-account-section"><h2>هل تحتاج مساحة استخدام أوسع؟</h2><p className="md-type-body-sm md-muted mt-2">Plus يلغي العداد اليومي المعتاد مع بقاء حماية الاستخدام العادل، ولا يغيّر هوية ORBY أو سياق خدماتك.</p><ButtonLink href="/orby/plus" variant="secondary" className="mt-5">استعراض ORBY Plus</ButtonLink></section>}
  </AccountPage>;
}
