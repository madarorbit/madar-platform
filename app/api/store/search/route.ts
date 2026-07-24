import {NextRequest,NextResponse} from 'next/server';
import {searchStore} from '@/src/lib/store/server';
import type {StoreEntityType,StoreSearchFilters} from '@/src/lib/store/types';

function number(value:string|null){if(value===null||value==='')return undefined;const parsed=Number(value);return Number.isFinite(parsed)?parsed:undefined}

export async function GET(request:NextRequest){
 const query=request.nextUrl.searchParams;
 const entity=query.get('type');
 const filters:StoreSearchFilters={
  q:query.get('q')?.slice(0,100)||undefined,
  entityType:entity==='product'||entity==='service'||entity==='plan'?entity as StoreEntityType:'all',
  category:query.get('category')||undefined,
  subcategory:query.get('subcategory')||undefined,
  free:query.get('free')==='free'||query.get('free')==='paid'?query.get('free') as 'free'|'paid':'all',
  featured:query.get('featured')==='true'||undefined,
  comingSoon:query.get('comingSoon')==='true'||undefined,
  minPrice:number(query.get('minPrice')),
  maxPrice:number(query.get('maxPrice')),
  sort:(['latest','best_selling','rating','price_asc','price_desc','alphabetical'].includes(query.get('sort')||'')?query.get('sort'):'latest') as StoreSearchFilters['sort'],
  page:Math.max(1,number(query.get('page'))||1),
  pageSize:Math.min(48,Math.max(1,number(query.get('pageSize'))||12)),
 };
 try{
  const result=await searchStore(filters);
  return NextResponse.json(result,{headers:{'Cache-Control':'public, s-maxage=60, stale-while-revalidate=300'}});
 }catch{
  return NextResponse.json({items:[],total:0,page:filters.page||1,pageSize:filters.pageSize||12,hasMore:false,error:'تعذر البحث في المتجر حاليًا.'},{status:503});
 }
}
