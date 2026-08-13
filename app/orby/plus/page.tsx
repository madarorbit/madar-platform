import {redirect} from 'next/navigation';
import OrbyShell from '@/components/orby/OrbyShell';
import OrbyPlusCheckout from '@/components/orby/OrbyPlusCheckout';
import {ButtonLink,Notice,Panel,StatusBadge} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';
import {getOptionalShellIdentity,getShellServiceOptions} from '@/src/lib/shell/server';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {formatStoreMoney,type CurrencyDefinition,type ExchangeRateDefinition} from '@/src/lib/store/currency';

export const dynamic='force-dynamic';
export const metadata={title:'ORBY Plus | مَدار'};

type Plan={id:string;price:number|string;currency:string;billing_months:number;is_available:boolean;is_active:boolean};
type PlusSub={status:string;starts_at:string;ends_at:string};
type Pending={id:string;status:string;payment_amount:number|string;payment_currency:string;created_at:string};
type Method={id:string;name:string;account_name:string|null;account_identifier:string|null;instructions:string|null;currency_agnostic:boolean};
type Restriction={payment_method_id:string;currency_code:string};

export default async function OrbyPlusPage(){
 const identity=await getOptionalShellIdentity();if(!identity)redirect('/login?next=/orby/plus');
 const[serviceOptions,planRows,subRows,pendingRows,currencyRows,rateRows,methodRows,restrictionRows,usageRaw]=await Promise.all([
  getShellServiceOptions(),
  supabaseFetch('/rest/v1/subscription_plans?service_code=eq.ORBY_PLUS&code=eq.ORBY-PLUS&select=id,price,currency,billing_months,is_available,is_active&limit=1').catch(()=>[]),
  supabaseFetch(`/rest/v1/orby_plus_subscriptions?user_id=eq.${encodeURIComponent(identity.user.id)}&select=status,starts_at,ends_at&limit=1`).catch(()=>[]),
  supabaseFetch(`/rest/v1/orby_plus_payment_requests?user_id=eq.${encodeURIComponent(identity.user.id)}&status=eq.under_review&select=id,status,payment_amount,payment_currency,created_at&order=created_at.desc&limit=1`).catch(()=>[]),
  supabaseFetch('/rest/v1/currencies?is_active=eq.true&select=code,name,symbol,decimal_places,is_active&order=code').catch(()=>[]),
  supabaseFetch('/rest/v1/exchange_rates?status=eq.active&select=id,base_currency,quote_currency,rate,status').catch(()=>[]),
  supabaseFetch('/rest/v1/payment_methods?is_active=eq.true&select=id,name,account_name,account_identifier,instructions,currency_agnostic&order=sort_order.asc,name.asc').catch(()=>[]),
  supabaseFetch('/rest/v1/payment_method_currencies?select=payment_method_id,currency_code').catch(()=>[]),
  supabaseFetch('/rest/v1/rpc/orby_usage_status',{method:'POST',body:'{}'}).catch(()=>null),
 ]);
 const plan=(planRows as Plan[])?.[0]||null,subscription=(subRows as PlusSub[])?.[0]||null,pending=(pendingRows as Pending[])?.[0]||null,currencies=currencyRows as CurrencyDefinition[],rates=rateRows as ExchangeRateDefinition[],methods=methodRows as Method[],restrictions=restrictionRows as Restriction[],usage=(Array.isArray(usageRaw)?usageRaw[0]:usageRaw) as{tier?:string}|null,active=usage?.tier==='plus'&&subscription?.status==='active'&&Boolean(subscription);
 return <OrbyShell authenticated plus={Boolean(active)} newChatHref="/orby?conversation=new" contextLabel="إدارة ORBY Plus" returnHref="/orby" identity={identity.shell} shellContext={{kind:'account',name:identity.shell.displayName,detail:'حساب مَدار',homeHref:'/account',options:serviceOptions}}>
  <div className="md-orby-plus-page">
   <header className="md-orby-plus-header"><div><span className="md-eyebrow">خطة ORBY</span><h1>ORBY <span>Plus</span></h1><p>استخدام مرن من منظور المنتج، مع حماية استخدام عادل في الخلفية، ومحادثاتك وسياقات خدماتك في تجربة واحدة.</p></div><ButtonLink href="/orby" variant="secondary">العودة إلى المحادثة</ButtonLink></header>
   <div className="md-orby-plus-grid">
    <Panel className="md-orby-plus-benefits" tone="muted"><div className="md-orby-plus-title"><h2>ما الذي تحصل عليه؟</h2>{active?<StatusBadge status="active">Plus فعال</StatusBadge>:null}</div><ul><li><Icon name="check"/>ORBY واحد لحسابك ومحادثاتك وخدماتك.</li><li><Icon name="check"/>لا يظهر عداد رسائل يومي عادي.</li><li><Icon name="check"/>سياق الأعمال معزول حسب الخدمة والمساحة الحالية.</li><li><Icon name="check"/>حماية خلفية من الإغراق والتوازي غير المعقول.</li><li><Icon name="check"/>انتهاء Plus لا يحذف محادثاتك أو حسابك.</li></ul>{plan?<div className="md-orby-plus-price"><span>السعر المعتمد من الإدارة</span><strong>{formatStoreMoney(plan.price,plan.currency,currencies)}</strong><small>كل {plan.billing_months.toLocaleString('ar-YE')} شهر</small></div>:null}</Panel>
    <Panel className="md-orby-plus-checkout" tone="raised">{active&&subscription?<div className="md-orby-plus-state"><span className="md-orby-plus-mark"><Icon name="sparkles"/></span><h2>ORBY Plus فعال</h2><p>يستمر حتى <time dateTime={subscription.ends_at}>{new Date(subscription.ends_at).toLocaleString('ar-YE')}</time>.</p><ButtonLink href="/orby">ابدأ محادثة</ButtonLink></div>:pending?<div className="md-orby-plus-state"><StatusBadge status="pending">قيد المراجعة</StatusBadge><h2>استلمنا طلب الترقية</h2><p>قيمة الطلب {formatStoreMoney(pending.payment_amount,pending.payment_currency,currencies)}. ستتغير خطتك فور اعتماد الإدارة للدفع.</p><ButtonLink href="/orby" variant="secondary">استخدام ORBY الحالي</ButtonLink></div>:!plan||!plan.is_active||!plan.is_available||Number(plan.price)<=0?<div className="md-orby-plus-state"><Notice title="ORBY Plus غير متاح للشراء حاليًا" variant="warning">السعر أو حالة الخطة لم تُضبط من لوحة إدارة مَدار. لم نضع سعرًا افتراضيًا أو تخمينيًا.</Notice><ButtonLink href="/orby" variant="secondary">العودة إلى ORBY</ButtonLink></div>:<><div className="md-orby-plus-form-heading"><h2>ترقية الحساب</h2><p>رقم الحوالة إلزامي، وإرفاق الإيصال اختياري.</p></div><OrbyPlusCheckout price={Number(plan.price)} currency={plan.currency} currencies={currencies} rates={rates} methods={methods} restrictions={restrictions}/></>}</Panel>
   </div>
  </div>
 </OrbyShell>;
}
