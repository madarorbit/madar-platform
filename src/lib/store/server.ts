import 'server-only';
import {supabaseConfig} from '@/src/lib/env';
import {catalogImageUrl} from '@/src/lib/catalog-media';
import type {StoreCategory,StoreEntityType,StoreItem,StoreSearchFilters,StoreSearchResponse} from './types';

type RawCategory={id:string;name:string;slug:string;description:string|null;image_url:string|null;sort_order:number};
type RawItem=Record<string,unknown>&{categories?:RawCategory|null;subcategories?:RawCategory|null};

const publicPredicate={status:'published',visibility:'visible',is_active:'true',show_in_store:'true',deleted_at:'is.null'} as const;
const commonSelect='id,name,slug,short_description,long_description,currency,status,visibility,is_featured,show_on_home,rating_average,rating_count,sales_count,view_count,thumbnail_url,video_url,external_url,purchase_url,delivery_duration,requires_approval,is_free,features,keywords,published_at,created_at,categories(id,name,slug,description,image_url,sort_order),subcategories(id,name,slug,description,image_url,sort_order)';

function cleanSearch(value:string){return value.replace(/[*,()]/g,' ').replace(/\s+/g,' ').trim().slice(0,100)}
function category(value:unknown):StoreCategory|null{const item=value as RawCategory|null|undefined;return item?{id:item.id,name:item.name,slug:item.slug,description:item.description,imageUrl:catalogImageUrl(item.image_url),sortOrder:Number(item.sort_order||0)}:null}
function list(value:unknown){return Array.isArray(value)?value.map(String).filter(Boolean):[]}
function number(value:unknown){const result=Number(value);return Number.isFinite(result)?result:0}
function nullableNumber(value:unknown){if(value===null||value===undefined||value==='')return null;const result=Number(value);return Number.isFinite(result)?result:null}

function mapItem(raw:RawItem,entityType:StoreEntityType):StoreItem{
 const price=entityType==='service'?number(raw.price_from):number(raw.price);
 return {
  id:String(raw.id),entityType,name:String(raw.name||''),slug:String(raw.slug||''),shortDescription:String(raw.short_description||''),longDescription:String(raw.long_description||raw.short_description||''),
  price,compareAtPrice:nullableNumber(raw.compare_at_price),currency:String(raw.currency||'SAR'),status:String(raw.status||'draft') as StoreItem['status'],visibility:String(raw.visibility||'hidden') as StoreItem['visibility'],
  itemType:String(raw.product_type||raw.service_type||(entityType==='plan'?'subscription':entityType)),category:category(raw.categories),subcategory:category(raw.subcategories),thumbnailUrl:catalogImageUrl(raw.thumbnail_url),
  videoUrl:raw.video_url?String(raw.video_url):null,externalUrl:raw.external_url?String(raw.external_url):null,purchaseUrl:raw.purchase_url?String(raw.purchase_url):null,
  deliveryType:raw.delivery_type?String(raw.delivery_type):null,deliveryDuration:raw.delivery_duration?String(raw.delivery_duration):null,requiresApproval:Boolean(raw.requires_approval),isFree:Boolean(raw.is_free)||price===0,
  isFeatured:Boolean(raw.is_featured),showOnHome:Boolean(raw.show_on_home),ratingAverage:number(raw.rating_average),ratingCount:number(raw.rating_count),salesCount:number(raw.sales_count),viewCount:number(raw.view_count),
  features:list(raw.features),includes:list(raw.includes),keywords:list(raw.keywords),publishedAt:raw.published_at?String(raw.published_at):null,createdAt:String(raw.created_at||new Date(0).toISOString())
 };
}

async function publicFetch(path:string,{count=false,revalidate=60}:{count?:boolean;revalidate?:number}={}){
 const {url,key}=supabaseConfig();
 const headers:Record<string,string>={apikey:key,Authorization:`Bearer ${key}`};
 if(count)headers.Prefer='count=exact';
 const response=await fetch(`${url}${path}`,{headers,next:{revalidate,tags:['madar-store']}});
 if(!response.ok)throw new Error('تعذر تحميل بيانات المتجر.');
 return {data:await response.json(),count:Number(response.headers.get('content-range')?.split('/')[1]||0)};
}

function appendPublic(params:URLSearchParams){for(const[key,value]of Object.entries(publicPredicate))params.set(key,value)}
function appendFilters(params:URLSearchParams,filters:StoreSearchFilters,entityType:StoreEntityType){
 appendPublic(params);
 if(filters.q){const q=encodeURIComponent(`*${cleanSearch(filters.q)}*`);params.set('or',`(name.ilike.${q},short_description.ilike.${q},long_description.ilike.${q},seo_title.ilike.${q},seo_description.ilike.${q})`)}
 if(filters.category)params.set('categories.slug',`eq.${filters.category}`);
 if(filters.subcategory)params.set('subcategories.slug',`eq.${filters.subcategory}`);
 if(filters.free==='free')params.set('is_free','eq.true');
 if(filters.free==='paid')params.set('is_free','eq.false');
 if(filters.featured)params.set('is_featured','eq.true');
 if(filters.comingSoon)params.set('availability','eq.coming_soon');
 if(filters.minPrice!==undefined)params.set(entityType==='service'?'price_from':'price',`gte.${filters.minPrice}`);
 if(filters.maxPrice!==undefined)params.set(entityType==='service'?'price_from':'price',`lte.${filters.maxPrice}`);
 const priceField=entityType==='service'?'price_from':'price';
 const sort=filters.sort||'latest';
 const order=sort==='best_selling'?'sales_count.desc':sort==='rating'?'rating_average.desc':sort==='price_asc'?`${priceField}.asc`:sort==='price_desc'?`${priceField}.desc`:sort==='alphabetical'?'name.asc':'published_at.desc';
 params.set('order',`${order},sort_order.asc`);
}

async function queryEntity(entityType:StoreEntityType,filters:StoreSearchFilters){
 const page=Math.max(1,filters.page||1),pageSize=Math.min(48,Math.max(1,filters.pageSize||12)),offset=(page-1)*pageSize;
 const params=new URLSearchParams();
 const typeFields=entityType==='product'?',price,compare_at_price,product_type,delivery_type,includes,availability':entityType==='service'?',price_from,service_type,delivery_type,availability':',price,compare_at_price,billing_interval,trial_days,availability';
 params.set('select',`${commonSelect}${typeFields}`);
 appendFilters(params,filters,entityType);
 params.set('limit',String(pageSize));params.set('offset',String(offset));
 const table=entityType==='product'?'products':entityType==='service'?'services':'plans';
 const {data,count}=await publicFetch(`/rest/v1/${table}?${params.toString()}`,{count:true});
 return {items:(data as RawItem[]).map(item=>mapItem(item,entityType)),count};
}

export async function searchStore(filters:StoreSearchFilters={}):Promise<StoreSearchResponse>{
 const page=Math.max(1,filters.page||1),pageSize=Math.min(48,Math.max(1,filters.pageSize||12));
 const types:StoreEntityType[]=filters.entityType&&filters.entityType!=='all'?[filters.entityType]:['product','service','plan'];
 const results=await Promise.all(types.map(type=>queryEntity(type,{...filters,page:1,pageSize:Math.ceil(pageSize/types.length)+2})));
 const sort=filters.sort||'latest';
 const items=results.flatMap(result=>result.items).sort((a,b)=>{
  if(sort==='best_selling')return b.salesCount-a.salesCount;
  if(sort==='rating')return b.ratingAverage-a.ratingAverage;
  if(sort==='price_asc')return a.price-b.price;
  if(sort==='price_desc')return b.price-a.price;
  if(sort==='alphabetical')return a.name.localeCompare(b.name,'ar');
  return new Date(b.publishedAt||b.createdAt).getTime()-new Date(a.publishedAt||a.createdAt).getTime();
 }).slice(0,pageSize);
 const total=results.reduce((sum,result)=>sum+result.count,0);
 return {items,total,page,pageSize,hasMore:page*pageSize<total};
}

export async function getStoreItem(entityType:StoreEntityType,slug:string){
 const result=await searchStore({entityType,q:slug,pageSize:48});
 return result.items.find(item=>item.slug===slug)||null;
}

export async function getStoreCategories(){
 const params=new URLSearchParams({select:'id,name,slug,description,image_url,sort_order',is_active:'eq.true',visibility:'eq.visible',deleted_at:'is.null',order:'sort_order.asc,name.asc'});
 const {data}=await publicFetch(`/rest/v1/categories?${params.toString()}`,{revalidate:300});
 return (data as RawCategory[]).map(category);
}

export async function getStoreSettings(){
 const {data}=await publicFetch('/rest/v1/store_settings?is_public=eq.true&deleted_at=is.null&select=setting_key,setting_value',{revalidate:300});
 return Object.fromEntries((data as Array<{setting_key:string;setting_value:unknown}>).map(row=>[row.setting_key,row.setting_value]));
}
