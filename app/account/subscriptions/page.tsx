import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Badge } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { serviceStateCtas, serviceStateLabels } from "@/src/lib/services/catalog";
import { getAccountServices } from "@/src/lib/services/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الاشتراكات | حساب مَدار" };

export default async function SubscriptionsPage() {
  const services = await getAccountServices();
  return (
    <AccountPage>
      <AccountPageHeader title="الاشتراكات" description="مرجع واحد للخدمة والخطة والحالة وتاريخ الانتهاء والإجراء المطلوب، بدل توزيع الاشتراكات داخل كل منتج." actions={<Link href="/orby/plus" className="md-button md-button-secondary"><Icon name="sparkles" />ORBY Plus</Link>} />
      <div className="grid gap-4">
        {services.map((service) => (
          <article key={service.definition.code} className="md-subscription-row">
            <div className="md-subscription-main"><span className="md-subscription-icon"><Icon name={service.definition.icon} /></span><div><h2>{service.definition.name}</h2><p>{service.plan?.name || "لا توجد خطة مفعلة"}</p></div></div>
            <dl><div><dt>الحالة</dt><dd><Badge variant={service.state === "ACTIVE" ? "success" : service.state === "NOT_SUBSCRIBED" ? "default" : "warning"}>{serviceStateLabels[service.state]}</Badge></dd></div><div><dt>البداية</dt><dd>{service.subscription ? new Date(service.subscription.starts_at).toLocaleDateString("ar-YE") : "—"}</dd></div><div><dt>الانتهاء</dt><dd>{service.subscription ? new Date(service.subscription.ends_at).toLocaleDateString("ar-YE") : "—"}</dd></div></dl>
            {service.href ? <Link href={service.href} className="md-button md-button-secondary">{serviceStateCtas[service.state]}<Icon name="arrow" /></Link> : <button disabled className="md-button md-button-secondary">{serviceStateCtas[service.state]}</button>}
          </article>
        ))}
      </div>
    </AccountPage>
  );
}
