import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import {siteConfig} from '@/src/config/site';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {catalogImageUrl} from '@/src/lib/catalog-media';
import {Icon} from '@/components/ui/Icons';

export default async function FeaturedProducts(){
 let products:Record<string,unknown>[]=[];
 try{const rows=await supabaseFetch('/rest/v1/products?status=eq.published&is_featured=eq.true&select=name,slug,short_description,price,currency,features,includes,thumbnail_url&order=published_at.desc&limit=3');products=rows.map((product:Record<string,unknown>)=>({title:product.name,slug:product.slug,description:product.short_description||'',price:Number(product.price),currency:product.currency,icon:'✦',features:product.features||[],includes:product.includes||[],category:'منتجات مَدار',longDescription:product.short_description||'',delivery:'تسليم رقمي',thumbnailUrl:catalogImageUrl(product.thumbnail_url)}))}catch{}
 return <section id="products" className="md-section border-b border-white/10"><div className="md-container"><div className="mb-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="md-eyebrow"><Icon name="store" className="h-4 w-4"/>من متجر مَدار</span><h2 className="mt-4 text-3xl font-black text-white sm:text-5xl">منتجات مختارة للعمل الحقيقي</h2><p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">أدوات وأنظمة رقمية منشورة ومدارة مباشرة من مَدار.</p></div><Link href={siteConfig.links.store} className="md-button md-button-secondary">فتح المتجر <Icon name="arrow" className="h-4 w-4"/></Link></div><div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">{products.map(product=><ProductCard key={String(product.slug)} product={product as never}/>)}</div>{!products.length&&<div className="md-empty"><div><span className="md-empty-icon mx-auto"><Icon name="store"/></span><p className="mt-4 text-slate-400">تصفح المتجر للاطلاع على المنتجات المتاحة.</p></div></div>}</div></section>;
}
