import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import {PageHero,Section,EmptyState} from '@/components/ui/Section';
import {Icon} from '@/components/ui/Icons';
import StoreCard from '@/components/store/StoreCard';
import {getStoreCategories,searchStore} from '@/src/lib/store/server';

export const metadata={title:'متجر مَدار | ORBIT',description:'محرك متجر مَدار للمنتجات الرقمية والأنظمة والخدمات والاشتراكات والباقات.'};

const destinations=[
 ['جميع المنتجات','/products','store','المنتجات الرقمية والأنظمة والقوالب والموارد.'],
 ['جميع الخدمات','/services','automation','خدمات البرمجة والذكاء الاصطناعي والتصميم والتسويق.'],
 ['الاشتراكات','/subscriptions','sparkles','الخطط والباقات الدورية المنشورة.'],
 ['التصنيفات','/categories','layers','استكشف الكتالوج حسب مجال الاستخدام.'],
 ['العروض','/offers','megaphone','العروض النشطة المتاحة حاليًا.'],
 ['المجانية','/free','document','المنتجات والخدمات المجانية.'],
] as const;

export default async function StorePage(){
 const emptyFeatured:Awaited<ReturnType<typeof searchStore>>={items:[],total:0,page:1,pageSize:3,hasMore:false};
 const emptyLatest:Awaited<ReturnType<typeof searchStore>>={items:[],total:0,page:1,pageSize:6,hasMore:false};
 let featured=emptyFeatured;let latest=emptyLatest;let categories:Awaited<ReturnType<typeof getStoreCategories>>=[];
 try{[featured,latest,categories]=await Promise.all([searchStore({featured:true,pageSize:3}),searchStore({sort:'latest',pageSize:6}),getStoreCategories()])}catch{}
 const validCategories=categories.filter((category):category is NonNullable<(typeof categories)[number]>=>category!=null);
 return <PageShell><PageHero eyebrow="MADAR Store Engine" title="متجر احترافي ينمو مع منظومة مَدار" description="منتجات رقمية وأنظمة وخدمات واشتراكات تُدار بالكامل من لوحة الإدارة، دون بيانات ثابتة داخل الواجهات."/><Section><nav className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="أقسام متجر مَدار">{destinations.map(([label,href,icon,description])=><Link key={href} href={href} className="md-card md-card-interactive flex gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Icon name={icon}/></span><span><strong className="text-lg">{label}</strong><span className="mt-1 block text-sm leading-6 text-slate-400">{description}</span></span></Link>)}</nav>{validCategories.length>0&&<div className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-black">التصنيفات النشطة</h2><Link href="/categories" className="md-button md-button-ghost md-button-sm">عرض الكل</Link></div><div className="flex flex-wrap gap-2">{validCategories.map(category=><Link key={category.id} href={`/products?category=${category.slug}`} className="md-badge md-badge-brand px-4 py-2">{category.name}</Link>)}</div></div>}</Section><Section className="border-t border-white/10"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-violet-300">اختيارات الإدارة</p><h2 className="mt-1 text-3xl font-black">العناصر المميزة</h2></div><Link href="/featured" className="md-button md-button-secondary">كل المميز</Link></div>{featured.items.length?<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{featured.items.map(item=><StoreCard key={`${item.entityType}-${item.id}`} item={item}/>)}</div>:<EmptyState title="لا توجد عناصر مميزة منشورة" description="يمكن للمالك اختيار العناصر المميزة من إدارة المتجر."/>}</Section><Section className="border-t border-white/10"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-sm font-bold text-emerald-300">أضيف حديثًا</p><h2 className="mt-1 text-3xl font-black">أحدث المنتجات والخدمات</h2></div><Link href="/latest" className="md-button md-button-secondary">عرض الأحدث</Link></div>{latest.items.length?<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{latest.items.map(item=><StoreCard key={`${item.entityType}-${item.id}`} item={item}/>)}</div>:<EmptyState title="المتجر غير منشور بعد" description="كل البيانات الافتراضية مخفية كمسودات حتى يراجعها المالك ويفعّلها."/>}</Section></PageShell>;
}
