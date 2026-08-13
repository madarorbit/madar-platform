import Image from 'next/image';
import Link from 'next/link';
import type {Product} from '@/src/data/products';
import {formatPrice} from '@/src/data/products';
import {Icon} from '@/components/ui/Icons';
import {arabicDisplay} from '@/src/lib/arabic-display';

function graphic(product:Product){const text=`${product.category} ${product.title}`;if(/ذكاء|اصطناعي/i.test(text))return 'sparkles';if(/أتمت|عمليات/i.test(text))return'automation';if(/بيانات|مبيعات|جداول/i.test(text))return'chart';return'layers'}

export default function ProductCard({product}:{product:Product}){
 const title=arabicDisplay(product.title),category=arabicDisplay(product.category),description=arabicDisplay(product.description);
 return <article className="md-card md-card-interactive md-product-card group">
  <div className="md-product-card-media">
   {product.thumbnailUrl?<Image src={product.thumbnailUrl} alt={`صورة ${title}`} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"/>:<div className="md-product-card-placeholder"><span><Icon name={graphic(product)} className="h-10 w-10"/></span></div>}
   <span className="md-badge md-product-type">منتج رقمي</span>
  </div>
  <div className="md-product-card-body"><p className="md-type-label text-[var(--md-mint)]">{category}</p><h3 className="md-type-h2 mt-2">{title}</h3><p className="md-type-body-sm md-muted mt-3 flex-1">{description}</p><div className="md-product-card-footer"><span className="md-type-h3 text-[var(--md-mint)]">{formatPrice(product)}</span><Link href={`/products/${product.slug}`} className="md-button md-button-secondary md-button-sm">التفاصيل <Icon name="arrow" className="md-icon-directional h-4 w-4"/></Link></div></div>
 </article>;
}
