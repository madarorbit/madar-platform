import type { Metadata } from 'next';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import ProductCard from '@/components/product/ProductCard';
import { siteConfig } from '@/src/config/site';
import { productCategories, products } from '@/src/data/products';

export const metadata: Metadata = {
  title: 'متجر المنتجات الرقمية',
  description: 'استعرض منتجات مَدار الرقمية المتاحة مع فئات واضحة وبطاقات متوافقة مع تجربة عربية RTL.',
};

export default function ProductsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#1A1A1A] text-white">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(106,13,173,0.28),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(0,128,128,0.22),transparent_34%)]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-[#70E4D4] backdrop-blur">
                متجر MADAR للمنتجات الرقمية
              </p>
              <h1 className="mb-6 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                منتجات رقمية عملية للأتمتة وتشغيل الأعمال
              </h1>
              <p className="text-lg leading-8 text-slate-300">
                صفحة المتجر تجمع المنتجات الرقمية الحالية في تجربة عربية أولاً، مع بطاقات واضحة وفئات قابلة للتوسع لاحقاً عند اكتمال قرارات الدفع وقاعدة البيانات.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="products-heading" className="pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur md:flex-row md:items-center md:justify-between">
              <div>
                <h2 id="products-heading" className="text-2xl font-bold text-white">
                  جميع المنتجات
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {products.length} منتجات ضمن حافظة {siteConfig.shortName} الحالية.
                </p>
              </div>
              <div className="flex flex-wrap gap-3" aria-label="فئات المنتجات المتاحة">
                {productCategories.map((category) => (
                  <span key={category} className="rounded-full border border-[#008080]/30 bg-[#008080]/10 px-3 py-1 text-sm text-[#70E4D4]">
                    {category}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
