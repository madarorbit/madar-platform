import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Badge } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { serviceStateCtas, serviceStateLabels } from "@/src/lib/services/catalog";
import { getAccountServices } from "@/src/lib/services/server";
import { getOrbyAccountData } from "@/src/lib/account/server";
import { formatDate } from "@/src/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "الاشتراكات | حساب مَدار" };

export default async function SubscriptionsPage() {
  const [services, orby] = await Promise.all([getAccountServices(), getOrbyAccountData()]);
  return (
    <AccountPage>
      <AccountPageHeader title="الاشتراكات" description="مرجع واحد للخدمة والخطة والحالة وتاريخ الانتهاء والإجراء المطلوب، بدل توزيع الاشتراكات داخل كل منتج." actions={<Link href="/orby/plus" className="md-button md-button-secondary"><Icon name="sparkles" />ORBY Plus</Link>} />
      <div className="grid gap-4">
        {services.map((service) => (
          <article key={service.definition.code} className="md-subscription-row">
            <div className="md-subscription-main"><span className="md-subscription-icon"><Icon name={service.definition.icon} /></span><div><h2>{service.definition.name}</h2><p>{service.plan?.name || "لا توجد خطة مفعلة"}</p></div></div>
            <dl><div><dt>الحالة</dt><dd><Badge variant={service.state === "ACTIVE" ? "success" : service.state === "NOT_SUBSCRIBED" ? "default" : "warning"}>{serviceStateLabels[service.state]}</Badge></dd></div><div><dt>البداية</dt><dd>{service.subscription ? formatDate(service.subscription.starts_at) : "—"}</dd></div><div><dt>الانتهاء</dt><dd>{service.subscription ? formatDate(service.subscription.ends_at) : "—"}</dd></div></dl>
            {service.href ? <Link href={service.href} className="md-button md-button-secondary">{serviceStateCtas[service.state]}<Icon name="arrow" /></Link> : <button disabled className="md-button md-button-secondary">{serviceStateCtas[service.state]}</button>}
          </article>
        ))}
        <article className="md-subscription-row">
          <div className="md-subscription-main"><span className="md-subscription-icon"><Icon name="sparkles" /></span><div><h2>ORBY Plus</h2><p>{orby.subscription.data ? "خطة Plus" : "الخطة الأساسية حسب أهلية الحساب"}</p></div></div>
          <dl><div><dt>الحالة</dt><dd><Badge variant={orby.subscription.data?.status === "active" ? "success" : orby.payment.data?.status === "under_review" ? "warning" : "default"}>{orby.subscription.data?.status === "active" ? "نشط" : orby.payment.data?.status === "under_review" ? "قيد المراجعة" : "غير مشترك"}</Badge></dd></div><div><dt>البداية</dt><dd>{orby.subscription.data ? formatDate(orby.subscription.data.starts_at) : "—"}</dd></div><div><dt>الانتهاء</dt><dd>{orby.subscription.data ? formatDate(orby.subscription.data.ends_at) : "—"}</dd></div></dl>
          <Link href="/account/orby" className="md-button md-button-secondary">إدارة ORBY<Icon name="arrow" /></Link>
        </article>
      </div>
    </AccountPage>
  );
}
