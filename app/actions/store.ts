'use server';

import {revalidatePath,updateTag} from 'next/cache';
import {requireAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {catalogSchema,formObject,offerSchema,settingSchema,taxonomySchema,zodMessage} from '@/src/lib/store/validation';

export type StoreActionState={success?:string;error?:string};
type StoreKind='product'|'service'|'plan';

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function audit(actor:string,action:string,type:string,id?:string,metadata:Record<string,unknown>={}){
 await supabaseFetch('/rest/v1/audit_logs',{method:'POST',body:JSON.stringify({actor_id:actor,action,entity_type:type,entity_id:id||null,metadata})});
}

function refreshStore(){
 updateTag('madar-store');
 for(const path of ['/store','/products','/services','/subscriptions','/categories','/offers','/featured','/latest','/best-sellers','/free','/search','/admin/store'])revalidatePath(path);
}

function entityTable(kind:string){
 if(kind==='product')return'products';
 if(kind==='service')return'services';
 if(kind==='plan')return'plans';
 throw new Error('نوع العنصر غير صالح.');
}

function validUuid(value:string){return uuidPattern.test(value)}

async function upsert(table:string,id:string,payload:Record<string,unknown>){
 if(id){await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(payload)});return id}
 const rows=await supabaseFetch(`/rest/v1/${table}`,{method:'POST',body:JSON.stringify(payload)});
 return String(rows?.[0]?.id||'');
}

async function syncTags(kind:StoreKind,entityId:string,tagIds:string[]){
 const relation=`${kind}_tags`,foreignKey=`${kind}_id`;
 await supabaseFetch(`/rest/v1/${relation}?${foreignKey}=eq.${encodeURIComponent(entityId)}`,{method:'DELETE'});
 if(tagIds.length)await supabaseFetch(`/rest/v1/${relation}`,{method:'POST',body:JSON.stringify(tagIds.map(tagId=>({[foreignKey]:entityId,tag_id:tagId})))});
}

function legacyProductDelivery(value:string){
 if(value==='instant_download')return'instant';
 if(value==='external_link')return'external';
 return'manual';
}

export async function saveStoreEntity(_previous:StoreActionState,form:FormData):Promise<StoreActionState>{
 try{
  const actor=await requireAdmin();
  const values=catalogSchema.parse(formObject(form));
  const id=values.id;
  const tagIds=form.getAll('tag_ids').map(String).filter(validUuid);
  const common={
   name:values.name,slug:values.slug,short_description:values.short_description||null,long_description:values.long_description||null,
   currency:values.currency,category_id:values.category_id,subcategory_id:values.subcategory_id,status:values.status,
   visibility:values.visibility,availability:values.availability,sort_order:values.sort_order,thumbnail_url:values.thumbnail_url,
   video_url:values.video_url,external_url:values.external_url,purchase_url:values.purchase_url,keywords:values.keywords,
   features:values.features,seo_title:values.seo_title||null,seo_description:values.seo_description||null,
   delivery_duration:values.delivery_duration||null,requires_approval:values.requires_approval,is_free:values.is_free,
   is_active:values.is_active,is_featured:values.is_featured,show_in_store:values.show_in_store,show_on_home:values.show_on_home,
   allow_reviews:values.allow_reviews,allow_comments:values.allow_comments,published_at:values.status==='published'?new Date().toISOString():null,
   updated_by:actor.id,...(!id?{created_by:actor.id}:{})
  };
  const payload=values.kind==='product'
   ?{...common,price:values.price,compare_at_price:values.compare_at_price,product_type:values.item_type,delivery_type:legacyProductDelivery(values.delivery_type),includes:values.includes}
   :values.kind==='service'
    ?{...common,price_from:values.price,compare_at_price:values.compare_at_price,service_type:values.item_type,delivery_type:values.delivery_type,includes:values.includes}
    :{...common,price:values.price,compare_at_price:values.compare_at_price,plan_type:values.item_type,delivery_type:values.delivery_type,billing_interval:values.billing_interval,trial_days:values.trial_days,includes:values.includes};
  const entityId=await upsert(entityTable(values.kind),id,payload);
  if(!entityId)throw new Error('تعذر تحديد معرف العنصر بعد الحفظ.');
  await syncTags(values.kind,entityId,tagIds);
  await audit(actor.id,id?'store.item.updated':'store.item.created',values.kind,entityId,{status:values.status,visibility:values.visibility,tags:tagIds.length});
  refreshStore();
  return{success:'تم حفظ العنصر في محرك المتجر.'};
 }catch(error){return{error:zodMessage(error)}}
}

export async function softDeleteStoreEntity(form:FormData){
 try{
  const actor=await requireAdmin(),kind=String(form.get('kind')||''),id=String(form.get('id')||'');
  if(!validUuid(id))throw new Error('المعرف غير صالح.');
  await supabaseFetch(`/rest/v1/${entityTable(kind)}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({deleted_at:new Date().toISOString(),status:'archived',visibility:'hidden',is_active:false,show_in_store:false,updated_by:actor.id})});
  await audit(actor.id,'store.item.soft_deleted',kind,id);refreshStore();
 }catch{}
}

export async function saveTaxonomy(_previous:StoreActionState,form:FormData):Promise<StoreActionState>{
 try{
  const actor=await requireAdmin(),values=taxonomySchema.parse(formObject(form)),id=values.id;
  const table=values.kind==='category'?'categories':values.kind==='subcategory'?'subcategories':'tags';
  const payload=values.kind==='category'
   ?{name:values.name,slug:values.slug,description:values.description||null,visibility:values.visibility,is_active:values.is_active,sort_order:values.sort_order,seo_title:values.seo_title||null,seo_description:values.seo_description||null}
   :values.kind==='subcategory'
    ?{name:values.name,slug:values.slug,description:values.description||null,category_id:values.category_id,visibility:values.visibility,is_active:values.is_active,sort_order:values.sort_order,seo_title:values.seo_title||null,seo_description:values.seo_description||null}
    :{name:values.name,slug:values.slug,description:values.description||null,is_active:values.is_active};
  const entityId=await upsert(table,id,payload);
  await audit(actor.id,'store.taxonomy.saved',values.kind,entityId);refreshStore();
  return{success:'تم حفظ التصنيف أو الوسم.'};
 }catch(error){return{error:zodMessage(error)}}
}

export async function softDeleteTaxonomy(form:FormData){
 try{
  const actor=await requireAdmin(),kind=String(form.get('kind')||''),id=String(form.get('id')||'');
  const table=kind==='category'?'categories':kind==='subcategory'?'subcategories':'tags';
  await supabaseFetch(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({deleted_at:new Date().toISOString(),is_active:false,...(kind!=='tag'?{visibility:'hidden'}:{})})});
  await audit(actor.id,'store.taxonomy.soft_deleted',kind,id);refreshStore();
 }catch{}
}

export async function saveOffer(_previous:StoreActionState,form:FormData):Promise<StoreActionState>{
 try{
  const actor=await requireAdmin(),values=offerSchema.parse(formObject(form)),id=values.id;
  const entityId=await upsert('offers',id,{name:values.name,slug:values.slug,description:values.description||null,discount_type:values.discount_type,discount_value:values.discount_value,starts_at:values.starts_at||null,ends_at:values.ends_at||null,status:values.status,visibility:values.visibility,is_active:values.is_active});
  await audit(actor.id,'store.offer.saved','offer',entityId);refreshStore();
  return{success:'تم حفظ العرض.'};
 }catch(error){return{error:zodMessage(error)}}
}

export async function softDeleteOffer(form:FormData){
 try{
  const actor=await requireAdmin(),id=String(form.get('id')||'');
  await supabaseFetch(`/rest/v1/offers?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({deleted_at:new Date().toISOString(),status:'archived',visibility:'hidden',is_active:false})});
  await audit(actor.id,'store.offer.soft_deleted','offer',id);refreshStore();
 }catch{}
}

export async function saveStoreSetting(_previous:StoreActionState,form:FormData):Promise<StoreActionState>{
 try{
  const actor=await requireAdmin(),values=settingSchema.parse(formObject(form)),id=values.id;
  const entityId=await upsert('store_settings',id,{setting_key:values.setting_key,setting_value:values.setting_value,description:values.description||null,is_public:values.is_public,updated_by:actor.id,...(!id?{created_by:actor.id}:{})});
  await audit(actor.id,'store.setting.saved','store_setting',entityId,{key:values.setting_key});refreshStore();
  return{success:'تم حفظ إعداد المتجر.'};
 }catch(error){return{error:zodMessage(error)}}
}

export async function saveFeaturedItem(_previous:StoreActionState,form:FormData):Promise<StoreActionState>{
 try{
  const actor=await requireAdmin(),id=String(form.get('id')||''),entityType=String(form.get('entity_type')||''),entityId=String(form.get('entity_id')||''),placement=String(form.get('placement')||'store');
  if(!['product','service','plan','category'].includes(entityType)||!['store','home','offers','category'].includes(placement)||!validUuid(entityId))throw new Error('بيانات العنصر المميز غير صالحة.');
  const rowId=await upsert('featured_items',id,{entity_type:entityType,entity_id:entityId,placement,title_override:String(form.get('title_override')||'')||null,subtitle_override:String(form.get('subtitle_override')||'')||null,sort_order:Number(form.get('sort_order')||0),starts_at:String(form.get('starts_at')||'')||null,ends_at:String(form.get('ends_at')||'')||null,is_active:form.get('is_active')==='on'});
  await audit(actor.id,'store.featured.saved','featured_item',rowId);refreshStore();
  return{success:'تم حفظ موضع الظهور المميز.'};
 }catch(error){return{error:zodMessage(error)}}
}

export async function softDeleteFeaturedItem(form:FormData){
 try{
  const actor=await requireAdmin(),id=String(form.get('id')||'');
  await supabaseFetch(`/rest/v1/featured_items?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({deleted_at:new Date().toISOString(),is_active:false})});
  await audit(actor.id,'store.featured.soft_deleted','featured_item',id);refreshStore();
 }catch{}
}
