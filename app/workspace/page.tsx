import Link from 'next/link';
import {businessMoney,requireBusinessWorkspace} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {Icon,type IconName} from '@/components/ui/Icons';

export const dynamic='force-dynamic';
export const metadata={title:'لوحة معلومات الأعمال | مَدار | ORBIT'};

export default async function WorkspaceHome(){
 const{workspace}=await requireBusinessWorkspace();
 const id=encodeURIComponent(workspace.id);
 const[products,customers,sales,expenses,tasks]=await Promise.all([
  supabaseFetch(`/rest/v1/business_products?organization_id=eq.${id}&select=id,name,stock_quantity,low_stock_threshold,is_active`).catch(()=>[]),
  supabaseFetch(`/rest/v1/business_customers?organization_id=eq.${id}&select=id,status`).catch(()=>[]),
  supabaseFetch(`/rest/v1/business_sales?organization_id=eq.${id}&status=eq.completed&select=id,total,sold_at&order=sold_at.desc&limit=1000`).catch(()=>[]),
  supabaseFetch(`/rest/v1/business_expenses?organization_id=eq.${id}&select=id,amount,incurred_at&order=incurred_at.desc&limit=1000`).catch(()=>[]),
  supabaseFetch(`/rest/v1/business_tasks?organization_id=eq.${id}&status=in.(todo,in_progress)&select=id,title,priority,due_at&order=due_at.asc.nullslast&limit=6`).catch(()=>[]),
 ]);
 const revenue=(sales||[]).reduce((sum:number,row:{total:number|string})=>sum+Number(row.total),0),spending=(expenses||[]).reduce((sum:number,row:{amount:number|string})=>sum+Number(row.amount),0),low=(products||[]).filter((p:{is_active:boolean;stock_quantity:number;low_stock_threshold:number})=>p.is_active&&Number(p.stock_quantity)<=Number(p.low_stock_threshold));
 const cards:Array<{label:string;value:string|number;href:string;icon:IconName}>=[
  {label:'المنتجات',value:products.length,href:'/workspace/products',icon:'store'},
  {label:'العملاء',value:customers.length,href:'/workspace/customers',icon:'community'},
  {label:'إجمالي المبيعات',value:businessMoney(revenue,workspace.currency),href:'/workspace/sales',icon:'chart'},
  {label:'إجمالي المصروفات',value:businessMoney(spending,workspace.currency),href:'/workspace/expenses',icon:'document'},
  {label:'تنبيهات المخزون',value:low.length,href:'/workspace/inventory',icon:'layers'},
  {label:'المهام المفتوحة',value:tasks.length,href:'/workspace/tasks',icon:'check'},
 ];
 return <main className="mx-auto max-w-7xl p-4 py-6 sm:p-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-emerald-300">مركز تشغيل الأعمال · لوحة المعلومات</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">ملخص مباشر لمساحة {workspace.name}</h2><p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">مؤشرات مختصرة، وتنبيهات قريبة، واختصارات للعمليات الأكثر استخدامًا.</p></div><Link href="/workspace/sales" className="md-button md-button-primary"><Icon name="chart"/>تسجيل عملية بيع</Link></header><section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card=><Link key={card.href} href={card.href} className="md-card md-card-interactive flex items-center gap-3 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Icon name={card.icon} className="h-5 w-5"/></span><span className="min-w-0"><span className="block text-xs text-slate-500">{card.label}</span><strong className="mt-1 block truncate text-lg">{String(card.value)}</strong></span></Link>)}</section><section className="mt-5 grid gap-5 lg:grid-cols-[1fr_.9fr]"><article className="md-panel"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-amber-300">يتطلب متابعة</p><h3 className="mt-1 text-lg font-black">تنبيهات المخزون</h3></div><Link href="/workspace/inventory" className="md-button md-button-ghost md-button-sm">فتح المخزون</Link></div><div className="mt-4 grid gap-2">{low.length?low.slice(0,6).map((p:{id:string;name:string;stock_quantity:number})=><div key={p.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.025] p-3"><span className="truncate text-sm">{p.name}</span><strong className="rounded-lg bg-amber-300/10 px-2 py-1 text-xs text-amber-200">المتبقي {p.stock_quantity}</strong></div>):<p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">لا توجد منتجات عند حد التنبيه.</p>}</div></article><article className="md-panel"><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-violet-300">العمل الحالي</p><h3 className="mt-1 text-lg font-black">المهام الأقرب</h3></div><Link href="/workspace/tasks" className="md-button md-button-ghost md-button-sm">كل المهام</Link></div><div className="mt-4 grid gap-2">{tasks.length?tasks.map((task:{id:string;title:string;priority:string;due_at:string|null})=><div key={task.id} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><div className="flex justify-between gap-4"><span className="truncate text-sm">{task.title}</span><strong className="text-xs text-violet-200">{task.priority}</strong></div>{task.due_at&&<p className="mt-1 text-xs text-slate-500">{new Date(task.due_at).toLocaleString('ar-YE')}</p>}</div>):<p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">لا توجد مهام مفتوحة.</p>}</div></article></section><section className="mt-5"><h3 className="mb-3 text-sm font-black">اختصارات سريعة</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Shortcut href="/workspace/products" icon="store" label="إضافة أو تعديل منتج"/><Shortcut href="/workspace/customers" icon="community" label="إدارة العملاء"/><Shortcut href="/workspace/analytics" icon="chart" label="فتح التقارير"/><Shortcut href="/workspace/orby" icon="sparkles" label="اسأل أوربي"/></div></section></main>;
}

function Shortcut({href,icon,label}:{href:string;icon:IconName;label:string}){return <Link href={href} className="md-dashboard-shortcut"><span className="md-dashboard-shortcut-icon"><Icon name={icon} className="h-4 w-4"/></span><b className="text-sm">{label}</b></Link>}
