import Image from "next/image";
import Link from "next/link";
import { Badge, ButtonLink } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { serviceStateCtas, serviceStateLabels, type ServiceState } from "@/src/lib/services/catalog";
import type { AccountService } from "@/src/lib/services/server";

const badgeVariant = (state: ServiceState) =>
  state === "ACTIVE" ? "success" as const
    : state === "PENDING_APPROVAL" || state === "SETUP_REQUIRED" ? "warning" as const
      : state === "REJECTED" || state === "SUSPENDED" || state === "EXPIRED" ? "danger" as const
        : "default" as const;

export default function ServiceCards({ services, compact = false, emptyTitle = "لا توجد خدمات في الحساب", emptyDescription = "استعرض خدمات مَدار المتاحة وابدأ بالخدمة المناسبة.", emptyHref = "/services", emptyAction = "استعراض الخدمات" }: { services: AccountService[]; compact?: boolean; emptyTitle?: string; emptyDescription?: string; emptyHref?: string; emptyAction?: string }) {
  if (!services.length) {
    return <div className="md-empty"><div><h2 className="text-xl font-black">{emptyTitle}</h2><p className="mt-2 text-slate-400">{emptyDescription}</p><Link href={emptyHref} className="md-button md-button-primary mt-5">{emptyAction}</Link></div></div>;
  }
  return (
    <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 lg:grid-cols-3"}>
      {services.map((service) => (
        <article key={service.definition.code} className={`overflow-hidden rounded-3xl border bg-white/[.02] ${service.state === "ACTIVE" ? "border-emerald-300/20" : "border-white/10"}`}>
          {!compact ? <div className="relative aspect-[16/9] overflow-hidden bg-black/20"><Image src={service.definition.coverImage} alt={`صورة ${service.definition.name}`} fill sizes="(max-width:1024px) 100vw, 33vw" className="object-cover" /></div> : null}
          <div className={compact ? "p-4" : "p-5"}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-100"><Icon name={service.definition.icon} className="h-4 w-4" /></span>
              <Badge variant={badgeVariant(service.state)}>{serviceStateLabels[service.state]}</Badge>
            </div>
            <h3 className="mt-4 font-black">{compact ? service.definition.shortName : service.definition.name}</h3>
            <p className={`mt-2 text-sm leading-6 text-slate-400 ${compact ? "line-clamp-2" : ""}`}>{compact ? service.definition.description : service.definition.detail}</p>
            {service.subscription ? <p className="mt-3 text-xs text-slate-500">ينتهي الاشتراك: {new Date(service.subscription.ends_at).toLocaleDateString("ar-YE")}</p> : null}
            {service.request?.rejection_reason && service.state === "REJECTED" ? <p className="mt-3 text-sm text-rose-200">{service.request.rejection_reason}</p> : null}
            <div className="mt-4 grid gap-2">
              {service.href ? <ButtonLink href={service.href} variant={service.state === "ACTIVE" ? "primary" : "secondary"}>{serviceStateCtas[service.state]}<Icon name="arrow" /></ButtonLink> : <button disabled className="md-button md-button-secondary">{serviceStateCtas[service.state]}</button>}
              {!compact && service.state === "ACTIVE" && service.subscription?.organization_id ? <Link href={`/orby?conversation=new&organization=${encodeURIComponent(service.subscription.organization_id)}`} className="md-button md-button-ghost text-xs"><Icon name="sparkles" />فتح ORBY في سياق الخدمة</Link> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
