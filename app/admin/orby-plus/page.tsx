import Link from 'next/link';
import {requireAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import OrbyOsSubnav from '@/components/admin/OrbyOsSubnav';
import OrbyPlusAdmin from '@/components/admin/orby/OrbyPlusAdmin';
import type {CurrencyDefinition} from '@/src/lib/store/currency';

export const dynamic='force-dynamic';
export const metadata={title:'ORBY Plus | إدارة مَدار'};

type RequestRow={id:string;user_id:string;original_amount:number|string;original_currency:string;payment_amount:number|string;payment_currency:string;payment_reference:string;storage_path:string|null;payment_method_id:string;created_at:string};
type Profile={id:string;full_name:string|null;email:string|null};
type Method={id:string;name:string};

export default async function AdminOrbyPlusPage(){
 await requireAdmin();
 const[planRows,currencyRows,requests,methods]=await Promise.all([
  supabaseFetch('/rest/v1/subscription_plans?service_code=eq.ORBY_PLUS&code=eq.ORBY-PLUS&select=price,currency,billing_months,is_available&limit=1').catch(()=>[]),
  supabaseFetch('/rest/v1/currencies?is_active=eq.true&select=code,name,symbol,decimal_places,is_active&order=code').catch(()=>[]),
  supabaseFetch('/rest/v1/orby_plus_payment_requests?status=eq.under_review&select=id,user_id,original_amount,original_currency,payment_amount,payment_currency,payment_reference,storage_path,payment_method_id,created_at&order=created_at.asc').catch(()=>[]),
  supabaseFetch('/rest/v1/payment_methods?select=id,name').catch(()=>[]),
 ]);
 const paymentRows=requests as RequestRow[],userIds=[...new Set(paymentRows.map(item=>item.user_id))],profiles=userIds.length?(await supabaseFetch(`/rest/v1/profiles?id=in.(${userIds.join(',')})&select=id,full_name,email`).catch(()=>[]) as Profile[]):[],profileMap=new Map(profiles.map(item=>[item.id,item])),methodMap=new Map((methods as Method[]).map(item=>[item.id,item.name]));
 const enriched=paymentRows.map(item=>({...item,display_name:profileMap.get(item.user_id)?.full_name||'',email:profileMap.get(item.user_id)?.email||'',method_name:methodMap.get(item.payment_method_id)||'وسيلة دفع'}));
 return <main className="container-wide py-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><span className="md-eyebrow">ORBY Control Plane</span><h1 className="mt-3 text-3xl font-black">ORBY Plus</h1><p className="mt-2 text-sm text-slate-500">إعداد السعر ومراجعة الاشتراكات المستقلة لأوربي باستخدام العملات ووسائل الدفع الحالية في مَدار.</p></div><Link href="/orby" className="md-button md-button-secondary">فتح ORBY</Link></div><OrbyOsSubnav/><OrbyPlusAdmin plan={(planRows as Array<{price:number|string;currency:string;billing_months:number;is_available:boolean}>)?.[0]||null} currencies={currencyRows as CurrencyDefinition[]} requests={enriched}/></main>;
}
