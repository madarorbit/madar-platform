import Link from 'next/link';
import {businessMoney,requireBusinessWorkspace} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';
export const metadata={title:'تشغيل التجارة | مَدار'};

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
 const cards=[['المنتجات',products.length,'/workspace/products'],['العملاء',customers.length,'/workspace/customers'],['المبيعات',businessMoney(revenue,workspace.currency),'/workspace/sales'],['المصروفات',businessMoney(spending,workspace.currency),'/workspace/expenses'],['مخزون منخفض',low.length,'/workspace/inventory'],['مهام مفتوحة',tasks.length,'/workspace/tasks']];
 return <main className="mx-auto max-w-7xl p-5 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold text-[#70E4D4]">مركز تشغيل الأعمال</p><h2 className="mt-2 text-4xl font-black">صورة مباشرة عن تجارتك</h2><p className="mt-3 max-w-2xl leading-8 text-slate-300">هذه هي النواة التشغيلية للمرحلة الرابعة: بيانات كل تجارة معزولة داخل مساحتها وتتحول العمليات إلى مؤشرات قابلة للتحليل.</p></div><Link href="/workspace/sales" className="rounded-xl bg-white px-5 py-3 font-black text-slate-950">تسجيل عملية بيع</Link></div><section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label,value,href])=><Link key={String(label)} href={String(href)} className="rounded-3xl border border-white/10 bg-white/[.04] p-6 transition hover:border-[#70E4D4]/40"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-black">{String(value)}</p></Link>)}</section><section className="mt-8 grid gap-6 lg:grid-cols-2"><article className="rounded-3xl border border-amber-300/15 bg-amber-300/[.05] p-6"><h3 className="text-xl font-black">تنبيهات المخزون</h3><div className="mt-4 space-y-3">{low.length?low.slice(0,6).map((p:{id:string;name:string;stock_quantity:number})=><div key={p.id} className="flex justify-between rounded-xl bg-black/20 p-3"><span>{p.name}</span><strong className="text-amber-200">{p.stock_quantity}</strong></div>):<p className="text-slate-400">لا توجد منتجات عند حد التنبيه.</p>}</div></article><article className="rounded-3xl border border-violet-300/15 bg-violet-300/[.05] p-6"><h3 className="text-xl font-black">المهام الأقرب</h3><div className="mt-4 space-y-3">{tasks.length?tasks.map((task:{id:string;title:string;priority:string;due_at:string|null})=><div key={task.id} className="rounded-xl bg-black/20 p-3"><div className="flex justify-between gap-4"><span>{task.title}</span><strong className="text-violet-200">{task.priority}</strong></div>{task.due_at&&<p className="mt-1 text-xs text-slate-400">{new Date(task.due_at).toLocaleString('ar-YE')}</p>}</div>):<p className="text-slate-400">لا توجد مهام مفتوحة.</p>}</div></article></section></main>;
}
