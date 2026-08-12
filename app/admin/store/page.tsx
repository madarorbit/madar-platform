import Link from 'next/link';
import {requireAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {Icon,type IconName} from '@/components/ui/Icons';

export const dynamic='force-dynamic';
type StatusRow={id:string;status:string;visibility:string;is_active:boolean;show_in_store?:boolean};
const sections:Array<[string,string,IconName,string]>=[
 ['products','إدارة المنتجات','layers','المنتجات الرقمية والأنظمة والقوالب والموارد.'],
 ['media','إدارة الصور والملفات','store','أغلفة المنتجات والملفات الرقمية الخاصة وإصداراتها.'],
 ['finance','العملات وأسعار الصرف والدفع','chart','العملات الديناميكية، أسعار الصرف، وسائل الدفع وعملة التقارير.'],
 ['services','إدارة الخدمات','briefcase','الخدمات البرمجية والتقنية والإبداعية.'],
 ['plans','إدارة الاشتراكات','sparkles','الباقات وخطط الاشتراك وتسعيرها.'],
 ['plan-features','خصائص الاشتراكات','check','الميزات والقيم والحدود الخاصة بكل خطة.'],
 ['categories','إدارة التصنيفات','document','الفئات الرئيسية للكتالوج.'],
 ['subcategories','الفئات الفرعية','layers','تقسيمات أكثر دقة لكل فئة.'],
 ['tags','إدارة الوسوم','megaphone','وسوم البحث والربط بين العناصر.'],
 ['gallery','معرض المنتجات','layers','صور وفيديوهات متعددة مع غلاف وترتيب.'],
 ['offers','إدارة العروض','megaphone','الخصومات وجدولة العروض.'],
 ['featured','العناصر المميزة','sparkles','الظهور المميز في المتجر والرئيسية.'],
 ['search','إدارة البحث','search','مراجعة الكلمات المفتاحية والفهرسة.'],
 ['settings','إعدادات المتجر','settings','إعدادات العرض والطلب العامة.'],
];

export default async function Page(){await requireAdmin();let products:StatusRow[]=[];let services:StatusRow[]=[];let plans:StatusRow[]=[];let offers:StatusRow[]=[];try{[products,services,plans,offers]=await Promise.all([supabaseFetch('/rest/v1/products?deleted_at=is.null&select=id,status,visibility,is_active,show_in_store'),supabaseFetch('/rest/v1/services?deleted_at=is.null&select=id,status,visibility,is_active,show_in_store'),supabaseFetch('/rest/v1/plans?deleted_at=is.null&select=id,status,visibility,is_active,show_in_store'),supabaseFetch('/rest/v1/offers?deleted_at=is.null&select=id,status,visibility,is_active')])}catch{}
 const all=[...products,...services,...plans];const published=all.filter(item=>item.status==='published'&&item.visibility==='visible'&&item.is_active&&item.show_in_store).length;const drafts=all.filter(item=>item.status==='draft').length;const hidden=all.filter(item=>item.visibility==='hidden').length;
 const stats=[['كل العناصر',all.length,'store'],['منشور ومرئي',published,'check'],['مسودات',drafts,'document'],['مخفية',hidden,'shield'],['العروض',offers.length,'megaphone']] as Array<[string,number,IconName]>;
 return <main className="mx-auto max-w-7xl p-4 py-6 sm:p-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold text-emerald-300">MADAR Store Engine</p><h1 className="mt-1 text-3xl font-black">إدارة المتجر</h1><p className="mt-2 max-w-3xl leading-7 text-slate-400">مصدر حقيقة واحد للكتالوج والملفات والعملات والدفع، مع الإبقاء على أدوات المتجر الحالية.</p></div><Link href="/store" className="md-button md-button-secondary"><Icon name="store"/>معاينة المتجر</Link></header><section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{stats.map(([label,value,icon])=><article key={label} className="md-card flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-300/10 text-violet-200"><Icon name={icon}/></span><span><span className="block text-xs text-slate-500">{label}</span><strong className="text-2xl">{value}</strong></span></article>)}</section><section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sections.map(([slug,label,icon,description])=><Link key={slug} href={`/admin/store/${slug}`} className="md-card md-card-interactive flex gap-4 p-5"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200"><Icon name={icon}/></span><span><strong className="text-lg">{label}</strong><span className="mt-1 block text-sm leading-6 text-slate-400">{description}</span></span></Link>)}</section></main>;
}
