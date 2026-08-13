import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import {siteConfig} from '@/src/config/site';
import {searchStore} from '@/src/lib/store/server';
import {Icon} from '@/components/ui/Icons';

export default async function FeaturedProducts(){
 let products:Record<string,unknown>[]=[];
 try{
  const result=await searchStore({entityType:'product',featured:true,pageSize:3});
  products=result.items.map(item=>({title:item.name,slug:item.slug,description:item.shortDescription,price:item.price,currency:item.currency,icon:'✦',features:item.features,includes:item.includes,category:item.category?.name||'منتجات مَدار | ORBIT',longDescription:item.longDescription||item.shortDescription,delivery:item.deliveryDuration||item.deliveryType||'تسليم رقمي',thumbnailUrl:item.thumbnailUrl}));
 }catch{}
 return <section id="products" className="md-public-feature-section md-section"><div className="md-container"><div className="md-section-heading"><div><span className="md-eyebrow"><Icon name="store" className="h-4 w-4"/>من متجر مَدار | ORBIT</span><h2 className="md-type-h1 mt-4">منتجات مختارة للعمل الحقيقي</h2><p className="md-type-body-lg md-muted mt-4 max-w-2xl">أدوات وأنظمة رقمية منشورة ومدارة مباشرة من مَدار | ORBIT.</p></div><Link href={siteConfig.links.store} className="md-button md-button-secondary">فتح المتجر <Icon name="arrow" className="md-icon-directional h-4 w-4"/></Link></div><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{products.map(product=><ProductCard key={String(product.slug)} product={product as never}/>)}</div>{!products.length?<div className="md-empty"><div><span className="md-empty-icon"><Icon name="store"/></span><p className="md-state-description">تصفح المتجر للاطلاع على المنتجات المتاحة.</p></div></div>:null}</div></section>;
}
