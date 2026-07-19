import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import { siteConfig } from '@/src/config/site';
import { products } from '@/src/data/products';

export default function FeaturedProducts() {
  return (
    <section id="products" className="bg-white py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-[#6A0DAD]" />
            <span className="text-sm font-medium text-[#475569]">المنتجات المختارة</span>
          </div>
          <h2 className="mb-6 text-4xl font-bold text-[#0F172A] sm:text-5xl">
            أفضل المنتجات الرقمية
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-[#475569]">
            اختر من مجموعة واسعة من المنتجات الرقمية المتخصصة والمصممة لتطوير عملك
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {products.slice(0, 3).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link href={siteConfig.links.products} className="rounded-xl border-2 border-[#E2E8F0] px-8 py-4 font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6A0DAD] focus-visible:ring-offset-2">
            عرض جميع المنتجات
          </Link>
        </div>
      </div>
    </section>
  );
}
