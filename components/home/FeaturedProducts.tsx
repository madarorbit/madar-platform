import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import { siteConfig } from '@/src/config/site';
import { supabaseFetch } from '@/src/lib/supabase/server';

export default async function FeaturedProducts() {
 let products:Record<string,unknown>[]=[];
 try {
  const rows=await supabaseFetch('/rest/v1/products?status=eq.published&is_featured=eq.true&select=name,slug,short_description,price,currency,features,includes&order=published_at.desc&limit=3');
  products=rows.map((p:Record<string,unknown>)=>({title:p.name,slug:p.slug,description:p.short_description||'',price:Number(p.price),currency:p.currency,icon:'✦',features:p.features||[],includes:p.includes||[],category:'منتجات مَدار',longDescription:p.short_description||'',delivery:'تسليم رقمي'}));
 } catch { /* The public catalog page presents the actionable error. */ }
 return <section id="products" className="bg-white py-20 sm:py-32"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="mb-16 text-center"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2"><span className="h-2 w-2 rounded-full bg-[#6A0DAD]"/><span className="text-sm font-medium text-[#475569]">المنتجات المختارة</span></div><h2 className="mb-6 text-4xl font-bold text-[#0F172A] sm:text-5xl">أفضل المنتجات الرقمية</h2><p className="mx-auto max-w-2xl text-lg text-[#475569]">منتجات منشورة ومدارة مباشرة من مَدار</p></div><div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">{products.map((product)=><ProductCard key={String(product.slug)} product={product as never}/>)}</div>{!products.length&&<p className="text-center text-[#475569]">تصفح الكتالوج للاطلاع على المنتجات المتاحة.</p>}<div className="mt-16 text-center"><Link href={siteConfig.links.products} className="rounded-xl border-2 border-[#E2E8F0] px-8 py-4 font-semibold text-[#0F172A]">عرض جميع المنتجات</Link></div></div></section>;
}
