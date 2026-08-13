import Image from 'next/image';
import Link from 'next/link';
import {ButtonLink,Card,EmptyState,StatusBadge,type StatusTone} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';
import {formatCurrency,formatDate} from '@/src/lib/format';
import {serviceStateCtas,serviceStateLabels,type ServiceState} from '@/src/lib/services/catalog';
import type {AccountService} from '@/src/lib/services/server';

const statusTone:Record<ServiceState,StatusTone>={
  NOT_SUBSCRIBED:'draft',
  SETUP_REQUIRED:'pending',
  PENDING_APPROVAL:'pending',
  ACTIVE:'active',
  EXPIRED:'expired',
  SUSPENDED:'suspended',
  REJECTED:'rejected',
};

export default function ServiceCards({services,compact=false,emptyTitle='لا توجد خدمات في الحساب',emptyDescription='استعرض خدمات مَدار المتاحة وابدأ بالخدمة المناسبة.',emptyHref='/services',emptyAction='استعراض الخدمات'}:{services:AccountService[];compact?:boolean;emptyTitle?:string;emptyDescription?:string;emptyHref?:string;emptyAction?:string}){
 if(!services.length)return <EmptyState title={emptyTitle} description={emptyDescription} compact={compact} action={<ButtonLink href={emptyHref}>{emptyAction}</ButtonLink>}/>;
 return <div className={compact?'md-service-grid is-compact':'md-service-grid'}>
  {services.map(service=><Card as="article" key={service.definition.code} className={`md-service-card is-${service.state.toLowerCase()}`}>
   <div className="md-service-card-media"><Image src={service.definition.coverImage} alt={`صورة ${service.definition.name}`} fill sizes={compact?'96px':'(max-width: 1024px) 100vw, 33vw'} className="object-cover"/></div>
   <div className="md-service-card-body">
    <div className="md-service-card-meta"><span className="md-service-card-icon"><Icon name={service.definition.icon}/></span><StatusBadge status={statusTone[service.state]}>{serviceStateLabels[service.state]}</StatusBadge></div>
    <div><h2 className="md-service-card-title">{compact?service.definition.shortName:service.definition.name}</h2><p className="md-service-card-description">{compact?service.definition.description:service.definition.detail}</p></div>
    <dl className="md-service-card-facts">
     {service.plan?<div><dt>الخطة</dt><dd>{service.plan.name}</dd></div>:null}
     {service.plan?<div><dt>السعر</dt><dd>{formatCurrency(service.plan.price,service.plan.currency)}</dd></div>:null}
     {service.subscription?<div><dt>ينتهي في</dt><dd>{formatDate(service.subscription.ends_at)}</dd></div>:null}
    </dl>
    {service.request?.rejection_reason&&service.state==='REJECTED'?<p className="md-service-card-reason" role="status">{service.request.rejection_reason}</p>:null}
    <div className="md-service-card-actions">
     {service.href?<ButtonLink href={service.href} variant={service.state==='ACTIVE'?'primary':'secondary'}>{serviceStateCtas[service.state]}<Icon name="arrow" className="md-icon-directional"/></ButtonLink>:<button disabled className="md-button md-button-secondary">{serviceStateCtas[service.state]}</button>}
     {!compact&&service.state==='ACTIVE'&&service.subscription?.organization_id?<Link href={`/orby?conversation=new&organization=${encodeURIComponent(service.subscription.organization_id)}&service=${service.definition.code}`} className="md-button md-button-ghost"><Icon name="sparkles"/>فتح ORBY في سياق الخدمة</Link>:null}
    </div>
   </div>
  </Card>)}
 </div>;
}
