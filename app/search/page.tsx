import PageShell from '@/components/ui/PageShell';
import ProductCard from '@/components/product/ProductCard';
import { PageHero, Section, EmptyState } from '@/components/ui/Section';
import { supabaseFetch } from '@/src/lib/supabase/server';
import type { Product } from '@/src/data/products';

type CatalogRow={name:string;slug:string;short_description:string|null;price:number|string;currency:string;features:string[];includes:string[]};
export const metadata={title:'البحث'};
export const dynamic='force-dynamic';

export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){
 const q=(await searchParams).q?.trim().slice(0,80)||'';
 let results:Product[]=[];let error=false;
 if(q){try{
  const safe=encodeURIComponent(`*${q.replace(/[*,()]/g,' ')}*`);
  const rows=await supabaseFetch(`/rest/v1/products?status=eq.published&or=(name.ilike.${safe},short_description.ilike.${safe})&select=name,slug,short_description,price,currency,features,includes&limit=30`) as CatalogRow[];
  results=rows.map((p,index)=>({id:index,slug:p.slug,title:p.name,description:p.short_description||'',longDescription:p.short_description||'',price:Number(p.price),currency:p.currency,icon:'✦',status:'published',features:p.features||[],includes:p.includes||[],category:'منتجات مَدار',delivery:'تسليم رقمي'}));
 }catch{error=true;}}
 return <PageShell><PageHero eyebrow="Search" title="ابحث في منتجات مَدار" description="استخدم كلمات عربية واضحة مثل أتمتة أو Notion أو مبيعات."/><Section><form><input name="q" defaultValue={q} className="w-full rounded-2xl p-4 text-slate-900" placeholder="كلمة البحث"/></form><div className="mt-8">{error?<p role="alert">تعذر البحث حالياً. حاول لاحقاً.</p>:q?(results.length?<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{results.map(p=><ProductCard key={p.slug} product={p}/>)}</div>:<EmptyState title="لا توجد نتائج" description="جرّب كلمة أخرى أو تصفح صفحة المنتجات."/>):<EmptyState title="ابدأ البحث" description="اكتب كلمة في مربع البحث لعرض النتائج."/>}</div></Section></PageShell>;
}
