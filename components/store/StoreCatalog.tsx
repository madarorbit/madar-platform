'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import StoreCard from './StoreCard';
import {Icon} from '@/components/ui/Icons';
import type {StoreCategory,StoreSearchFilters,StoreSearchResponse} from '@/src/lib/store/types';

type Props={initial:StoreSearchResponse;categories:StoreCategory[];fixed?:Partial<StoreSearchFilters>;title?:string};

export default function StoreCatalog({initial,categories,fixed={},title='كتالوج المتجر'}:Props){
 const router=useRouter(),current=useSearchParams(),first=useRef(true);
 const [q,setQ]=useState(current.get('q')||'');
 const [category,setCategory]=useState(current.get('category')||fixed.category||'');
 const [entityType,setEntityType]=useState(current.get('type')||fixed.entityType||'all');
 const [free,setFree]=useState(current.get('free')||fixed.free||'all');
 const [sort,setSort]=useState(current.get('sort')||fixed.sort||'latest');
 const [featured,setFeatured]=useState(fixed.featured||current.get('featured')==='true');
 const [comingSoon,setComingSoon]=useState(fixed.comingSoon||current.get('comingSoon')==='true');
 const [minimum,setMinimum]=useState(current.get('minPrice')||'');
 const [maximum,setMaximum]=useState(current.get('maxPrice')||'');
 const [result,setResult]=useState(initial);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const lockedType=fixed.entityType&&fixed.entityType!=='all';

 const query=useMemo(()=>{const params=new URLSearchParams();if(q.trim())params.set('q',q.trim());if(category)params.set('category',category);if(entityType!=='all')params.set('type',String(entityType));if(free!=='all')params.set('free',String(free));if(sort!=='latest')params.set('sort',String(sort));if(featured)params.set('featured','true');if(comingSoon)params.set('comingSoon','true');if(minimum)params.set('minPrice',minimum);if(maximum)params.set('maxPrice',maximum);params.set('pageSize','12');return params},[q,category,entityType,free,sort,featured,comingSoon,minimum,maximum]);

 useEffect(()=>{
  if(first.current){first.current=false;return}
  const controller=new AbortController();
  const timer=window.setTimeout(async()=>{setLoading(true);setError('');try{const response=await fetch(`/api/store/search?${query.toString()}`,{signal:controller.signal});const payload=await response.json();if(!response.ok)throw new Error(payload.error||'تعذر تحديث النتائج.');setResult(payload);router.replace(`${window.location.pathname}${query.size?`?${query.toString()}`:''}`,{scroll:false})}catch(value){if((value as Error).name!=='AbortError')setError(value instanceof Error?value.message:'تعذر تحديث النتائج.')}finally{setLoading(false)}},250);
  return()=>{window.clearTimeout(timer);controller.abort()};
 },[query,router]);

 async function more(){if(!result.hasMore)return;setLoading(true);setError('');try{const params=new URLSearchParams(query);params.set('page',String(result.page+1));const response=await fetch(`/api/store/search?${params.toString()}`);const payload=await response.json();if(!response.ok)throw new Error(payload.error||'تعذر تحميل المزيد.');setResult(previous=>({...payload,items:[...previous.items,...payload.items]}))}catch(value){setError(value instanceof Error?value.message:'تعذر تحميل المزيد.')}finally{setLoading(false)}}
 const reset=()=>{setQ('');setCategory('');if(!lockedType)setEntityType('all');setFree('all');setSort('latest');setFeatured(Boolean(fixed.featured));setComingSoon(Boolean(fixed.comingSoon));setMinimum('');setMaximum('')};

 return <div>
  <div className="md-panel mb-7" aria-label="بحث وفلاتر المتجر">
   <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
    <label className="md-field min-w-0 flex-1"><span className="md-label">البحث اللحظي</span><div className="md-search-field"><Icon name="search" className="h-5 w-5"/><input value={q} onChange={event=>setQ(event.target.value)} className="md-input" placeholder="ابحث بالاسم أو الوصف أو كلمات SEO" autoComplete="off"/></div></label>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:flex-[2]">
     <label className="md-field"><span className="md-label">الفئة</span><select value={category} onChange={event=>setCategory(event.target.value)} className="md-select"><option value="">كل الفئات</option>{categories.map(item=><option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
     {!lockedType&&<label className="md-field"><span className="md-label">النوع</span><select value={String(entityType)} onChange={event=>setEntityType(event.target.value)} className="md-select"><option value="all">الكل</option><option value="product">منتج</option><option value="service">خدمة</option><option value="plan">اشتراك</option></select></label>}
     <label className="md-field"><span className="md-label">السعر</span><select value={String(free)} onChange={event=>setFree(event.target.value)} className="md-select"><option value="all">مجاني ومدفوع</option><option value="free">مجاني</option><option value="paid">مدفوع</option></select></label>
     <label className="md-field"><span className="md-label">الترتيب</span><select value={String(sort)} onChange={event=>setSort(event.target.value)} className="md-select"><option value="latest">الأحدث</option><option value="best_selling">الأكثر مبيعًا</option><option value="rating">الأعلى تقييمًا</option><option value="price_asc">السعر: الأقل</option><option value="price_desc">السعر: الأعلى</option><option value="alphabetical">أبجديًا</option></select></label>
     <button type="button" onClick={reset} className="md-button md-button-ghost self-end">إعادة الضبط</button>
    </div>
   </div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <label className="md-field"><span className="md-label">أقل سعر</span><input value={minimum} onChange={event=>setMinimum(event.target.value)} type="number" inputMode="decimal" min="0" className="md-input"/></label>
    <label className="md-field"><span className="md-label">أعلى سعر</span><input value={maximum} onChange={event=>setMaximum(event.target.value)} type="number" inputMode="decimal" min="0" className="md-input"/></label>
    <label className="md-store-filter-toggle"><input type="checkbox" checked={featured} onChange={event=>setFeatured(event.target.checked)}/><span>المميز فقط</span></label>
    <label className="md-store-filter-toggle"><input type="checkbox" checked={comingSoon} onChange={event=>setComingSoon(event.target.checked)}/><span>قريبًا</span></label>
   </div>
  </div>
  <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="md-type-h2">{title}</h2><p className="md-help mt-1">{result.total} نتيجة</p></div>{loading&&<span role="status" className="md-badge md-badge-brand">جارٍ التحديث…</span>}</div>
  {error&&<div role="alert" className="md-notice md-notice-danger mb-5"><Icon name="warning" className="h-5 w-5 shrink-0"/><div><strong>تعذر تحديث النتائج</strong><p className="md-help mt-1">{error}</p></div></div>}
  {result.items.length?<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{result.items.map(item=><StoreCard key={`${item.entityType}-${item.id}`} item={item}/>)}</div>:<div className="md-empty"><div><span className="md-empty-icon mx-auto"><Icon name="store"/></span><h3 className="md-type-h3 mt-4">لا توجد نتائج مطابقة</h3><p className="md-type-body-sm md-muted mt-2">جرّب تعديل البحث أو الفلاتر، أو انتظر تفعيل عناصر جديدة من الإدارة.</p></div></div>}
  {result.hasMore&&<div className="mt-8 text-center"><button type="button" disabled={loading} onClick={more} className="md-button md-button-secondary">تحميل المزيد</button></div>}
 </div>;
}