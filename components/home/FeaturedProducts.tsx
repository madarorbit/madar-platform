import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import { siteConfig } from '@/src/config/site';
import { supabaseFetch } from '@/src/lib/supabase/server';
import {catalogImageUrl} from '@/src/lib/catalog-media';

export default async function FeaturedProducts() {
 let products:Record<string,unknown>[]=[];
 try {
  const rows=await supabaseFetch('/rest/v1/products?status=eq.published&is_featured=eq.true&select=name,slug,short_description,price,currency,features,includes,thumbnail_url&order=published_at.desc&limit=3');
  products=rows.map((p:Record<string,unknown>)=>({title:p.name,slug:p.slug,description:p.short_description||'',price:Number(p.price),currency:p.currency,icon:'✦',features:p.features||[],includes:p.includes||[],category:'منتجات مَدار',longDescription:p.short_description||'',delivery:'تسليم رقمي',thumbnailUrl:catalogImageUrl(p.thumbnail_url)}));
 } catch { /* The public catalog page presents the actionable error. */ }
 return <section id="products" className="bg-white py-20 sm:py-28"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-black text-[#5B2AE8]">من متجر مَدار</p><h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-5xl">منتجات مختارة للعمل الحقيقي</h2><p className="mt-4 max-w-2xl text-lg text-slate-600">أدوات وأنظمة رقمية منشورة ومدارة مباشرة من مَدار.</p></div><Link href={siteConfig.links.store} className="font-bold text-[#5B2AE8]">فتح المتجر ←</Link></div><div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">{products.map((product)=><ProductCard key={String(product.slug)} product={product as never}/>)}</div>{!products.length&&<div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">تصفح المتجر للاطلاع على المنتجات المتاحة.</div>}</div></section>;
}
