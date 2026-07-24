import Image from 'next/image';
import Link from 'next/link';
import {Icon} from '@/components/ui/Icons';
import {arabicMoney} from '@/src/lib/arabic-display';
import type {StoreItem} from '@/src/lib/store/types';

const labels:Record<string,string>={digital_product:'منتج رقمي',ready_system:'نظام جاهز',template:'قالب',student_resource:'مورد طلابي',service:'خدمة',subscription:'اشتراك',bundle:'باقة'};
const availability:Record<string,string>={available:'متاح',coming_soon:'قريبًا',sold_out:'نفد',disabled:'غير متاح'};

export default function StoreCard({item}:{item:StoreItem}){
 const href=item.entityType==='product'?`/products/${item.slug}`:item.entityType==='service'?`/services/${item.slug}`:`/subscriptions?plan=${item.slug}`;
 const action=item.entityType==='service'?'اطلب الخدمة':item.entityType==='plan'?'اشترك':'شراء';
 const state=String((item as StoreItem&{availability?:string}).availability||'available');
 return <article className="md-card md-card-interactive group flex h-full flex-col overflow-hidden p-0">
  <div className="relative aspect-[16/10] overflow-hidden bg-[#0b1020]">
   {item.thumbnailUrl?<Image src={item.thumbnailUrl} alt={`صورة ${item.name}`} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105"/>:<div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_30%_25%,rgba(124,77,255,.48),transparent_34%),radial-gradient(circle_at_75%_70%,rgba(50,214,189,.35),transparent_38%)]"><span className="grid h-24 w-24 place-items-center rounded-3xl border border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur"><Icon name={item.entityType==='service'?'automation':item.entityType==='plan'?'sparkles':'layers'} className="h-12 w-12"/></span></div>}
   <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2"><span className="md-badge border-white/15 bg-black/60 text-white backdrop-blur">{labels[item.itemType]||labels[item.entityType]||'عنصر متجر'}</span>{state!=='available'&&<span className="md-badge bg-amber-300/90 text-amber-950">{availability[state]||state}</span>}</div>
  </div>
  <div className="flex flex-1 flex-col p-6">
   <p className="text-sm font-black text-emerald-300">{item.subcategory?.name||item.category?.name||'متجر مَدار | ORBIT'}</p>
   <h2 className="mt-2 text-2xl font-black leading-8"><Link href={href}>{item.name}</Link></h2>
   <p className="mt-3 line-clamp-3 flex-1 leading-7 text-slate-400">{item.shortDescription}</p>
   <div className="mt-4 flex items-center gap-3 text-xs text-slate-400"><span aria-label={`التقييم ${item.ratingAverage} من خمسة`}>★ {item.ratingAverage.toFixed(1)}</span><span>{item.ratingCount} تقييم</span></div>
   <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/10 pt-5"><div><strong className="block text-xl text-emerald-300">{item.isFree?'مجاني':arabicMoney(item.price,item.currency)}</strong>{item.compareAtPrice!==null&&item.compareAtPrice>item.price&&<del className="text-sm text-slate-500">{arabicMoney(item.compareAtPrice,item.currency)}</del>}</div><div className="flex gap-2"><Link href={href} className="md-button md-button-ghost md-button-sm">التفاصيل</Link><Link href={`${href}#purchase`} className="md-button md-button-primary md-button-sm">{action}</Link></div></div>
  </div>
 </article>;
}
