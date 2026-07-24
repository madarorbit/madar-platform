import {notFound} from 'next/navigation';
import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import {Section} from '@/components/ui/Section';
import {Breadcrumbs} from '@/components/ui/Breadcrumbs';
import {Badge,Card} from '@/components/ui/Enterprise';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {catalogImageUrl} from '@/src/lib/catalog-media';
import {arabicDisplay,arabicList,arabicMoney} from '@/src/lib/arabic-display';
import {Icon} from '@/components/ui/Icons';
import AddToCart from '@/components/cart/AddToCart';
export const dynamic='force-dynamic';

export default async function Page({params}:{params:Promise<{slug:string}>}){
 let service;try{service=(await supabaseFetch(`/rest/v1/services?slug=eq.${encodeURIComponent((await params).slug)}&status=eq.published&select=*`))?.[0]}catch{throw new Error('تعذر تحميل الخدمة.')}if(!service)notFound();
 const image=catalogImageUrl(service.thumbnail_url),name=arabicDisplay(service.name),description=arabicDisplay(service.long_description||service.short_description),features=arabicList(service.features);
 return <PageShell><Section><Breadcrumbs items={[{label:'المتجر',href:'/store'},{label:'الخدمات',href:'/services'},{label:name}]}/><div className="mt-7 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]"><article><div className="relative mb-8 aspect-[16/8] overflow-hidden rounded-[2rem] border border-white/10 bg-[#11182B]">{image?<div className="absolute inset-0 bg-cover bg-center" style={{backgroundImage:`url("${image.replace(/["\\]/g,'')}")`}} role="img" aria-label={`صورة خدمة ${name}`}/>:<div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(124,77,255,.55),transparent_35%),radial-gradient(circle_at_70%_75%,rgba(50,214,189,.38),transparent_38%)]"><Icon name="automation" className="h-24 w-24"/></div>}</div><Badge variant="success">خدمة تنفيذ من مَدار</Badge><h1 className="mt-4 text-4xl font-black leading-tight sm:text-6xl">{name}</h1><p className="mt-6 max-w-3xl text-lg leading-9 text-slate-300">{description}</p><h2 className="mt-10 text-2xl font-black">مخرجات الخدمة</h2><ul className="mt-5 grid gap-3 sm:grid-cols-2">{features.map(feature=><li key={feature} className="md-card flex gap-3 p-4 text-slate-300"><Icon name="check" className="h-5 w-5 shrink-0 text-emerald-300"/>{feature}</li>)}</ul></article><Card className="h-fit lg:sticky lg:top-24"><p className="text-sm text-slate-400">السعر التقديري</p><p className="mt-2 text-3xl font-black text-emerald-300">يبدأ من {arabicMoney(service.price_from,service.currency)}</p><p className="mt-5 leading-7 text-slate-300">تُعتمد التفاصيل النهائية بعد مراجعة احتياجك.</p><div className="mt-6"><AddToCart item={{id:service.id,type:'service',title:service.name,price:Number(service.price_from),currency:service.currency,slug:service.slug}} label="أضف الخدمة إلى السلة"/></div><Link href="/cart" className="md-button md-button-ghost mt-3 w-full">عرض السلة</Link><Link href="/service-agreement" className="mt-3 block text-center text-sm text-slate-400 hover:text-white">اتفاقية تقديم الخدمة</Link></Card></div></Section></PageShell>}
