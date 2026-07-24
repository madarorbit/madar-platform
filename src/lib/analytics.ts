import 'server-only';
import {supabaseFetch} from '@/src/lib/supabase/server';

export type AnalyticsKpis={
 revenue:number;orders:number;discounts:number;average_order_value:number;cost_of_goods:number;gross_profit:number;expenses:number;net_profit_estimate:number;
 active_customers:number;new_customers:number;returning_customers:number;low_stock:number;out_of_stock:number;inventory_value:number;open_tasks:number;overdue_tasks:number;
};
export type DailySale={date:string;revenue:number;orders:number};
export type DailyExpense={date:string;amount:number};
export type TopProduct={product_id:string;name:string;quantity:number;revenue:number;profit:number};
export type CustomerSegment={status:string;count:number};
export type BusinessAnalytics={
 organization_id:string;currency:string;period:{start:string;end:string;days:number};previous_period:{start:string;end:string};kpis:AnalyticsKpis;
 comparison:{previous_revenue:number;previous_orders:number;previous_expenses:number;revenue_change:number;orders_change:number;expenses_change:number};
 daily_sales:DailySale[];daily_expenses:DailyExpense[];top_products:TopProduct[];customer_segments:CustomerSegment[];generated_at:string;
};

const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export function adenToday(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Aden',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const pick=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 return `${pick('year')}-${pick('month')}-${pick('day')}`;
}
export function shiftIsoDate(date:string,days:number){
 if(!datePattern.test(date)||!Number.isInteger(days))throw new Error('تعذر حساب الفترة المختصرة.');
 const[year,month,day]=date.split('-').map(Number),shifted=new Date(Date.UTC(year,month-1,day)+days*86400000);
 return shifted.toISOString().slice(0,10);
}
export function resolveAnalyticsRange(start?:string,end?:string){
 const today=adenToday(),defaultStart=`${today.slice(0,8)}01`;
 const from=datePattern.test(start||'')?start!:defaultStart,to=datePattern.test(end||'')?end!:today;
 const fromDate=new Date(`${from}T00:00:00Z`),toDate=new Date(`${to}T00:00:00Z`),days=Math.floor((toDate.getTime()-fromDate.getTime())/86400000)+1;
 if(!Number.isFinite(days)||days<1||days>366)throw new Error('اختر فترة صحيحة لا تتجاوز 366 يومًا.');
 return{start:from,end:to,days};
}
export async function loadBusinessAnalytics(organizationId:string,start:string,end:string){
 const response=await supabaseFetch('/rest/v1/rpc/business_analytics',{method:'POST',body:JSON.stringify({target_organization:organizationId,report_start:start,report_end:end})});
 const data=(Array.isArray(response)?response[0]:response) as BusinessAnalytics|undefined;
 if(!data?.kpis)throw new Error('تعذر تجهيز تقرير التجارة.');
 return data;
}
export function analyticsMoney(value:number|string|null|undefined,currency:string){
 return new Intl.NumberFormat('ar-YE',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value||0));
}
export function changeLabel(value:number){
 const number=Number(value||0);return `${number>0?'+':''}${number.toLocaleString('ar-YE',{maximumFractionDigits:2})}%`;
}
