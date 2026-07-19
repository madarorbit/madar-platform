import Link from 'next/link';
import type { Product } from '@/src/data/products';

type ProductCardProps = {
  product: Product;
};

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <article id={product.slug} className="group relative overflow-hidden rounded-2xl border border-[#2A3344] bg-[#111827]/80 shadow-2xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-[#6A0DAD]/70 focus-within:border-[#6A0DAD]/70">
      <div className="relative flex h-48 items-center justify-center overflow-hidden bg-gradient-to-br from-[#1A1A1A] via-[#25113A] to-[#063B3B]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(106,13,173,0.32),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(0,128,128,0.26),transparent_30%)]" />
        <span className="relative text-6xl transition-transform duration-300 group-hover:scale-110" aria-hidden="true">
          {product.icon}
        </span>
      </div>

      <div className="p-6">
        <p className="mb-4 inline-flex rounded-full border border-[#6A0DAD]/30 bg-[#6A0DAD]/15 px-3 py-1 text-xs font-semibold text-[#C9A7FF]">
          {product.category}
        </p>

        <h3 className="mb-3 text-xl font-bold text-white">{product.title}</h3>
        <p className="mb-6 line-clamp-2 text-sm leading-7 text-slate-300">{product.description}</p>

        <div className="flex items-center justify-between gap-4">
          <span className="text-2xl font-bold text-[#70E4D4]">{product.price}</span>
          <Link
            href={`/products#${product.slug}`}
            className="rounded-xl bg-gradient-to-r from-[#6A0DAD] to-[#008080] px-4 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-[#6A0DAD]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#70E4D4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111827]"
          >
            عرض المنتج
          </Link>
        </div>
      </div>
    </article>
  );
}
