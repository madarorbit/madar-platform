import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import {PageHero,Section,EmptyState} from '@/components/ui/Section';
import {Icon} from '@/components/ui/Icons';
import {getStoreCategories} from '@/src/lib/store/server';
import type {StoreCategory} from '@/src/lib/store/types';

export const metadata={title:'تصنيفات متجر مَدار | ORBIT',description:'استكشف منتجات وخدمات متجر مَدار حسب التصنيف.'};

export default async function Page(){
 let categories:StoreCategory[]=[];
 try{categories=await getStoreCategories()}catch{}
 return <PageShell><PageHero eyebrow="متجر مَدار · التصنيفات" title="استكشف المتجر حسب المجال" description="لا تظهر هنا إلا التصنيفات التي فعّلتها الإدارة وجعلتها مرئية للعملاء."/><Section>{categories.length?<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{categories.map(category=><article key={category.id} className="md-card md-card-interactive"><span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Icon name="layers"/></span><h2 className="mt-5 text-2xl font-black">{category.name}</h2><p className="mt-3 min-h-14 leading-7 text-slate-400">{category.description||'منتجات وخدمات مختارة ضمن هذا التصنيف.'}</p><div className="mt-6 flex gap-2 border-t border-white/10 pt-5"><Link href={`/products?category=${category.slug}`} className="md-button md-button-secondary md-button-sm">المنتجات</Link><Link href={`/services?category=${category.slug}`} className="md-button md-button-ghost md-button-sm">الخدمات</Link></div></article>)}</div>:<EmptyState title="لا توجد تصنيفات منشورة" description="التصنيفات الافتراضية مخفية حتى يراجعها المالك ويفعّلها."/>}</Section></PageShell>;
}
