import type {Metadata} from 'next';
import {siteConfig} from '@/src/config/site';
import type {StoreEntityType,StoreItem} from '@/src/lib/store/types';

type MetadataOptions={
 title:string;
 description:string;
 path:string;
 image?:string|null;
 keywords?:string[];
};

const routeSegment:Record<StoreEntityType,string>={product:'products',service:'services',plan:'subscriptions'};

export function absoluteUrl(path='/'){
 if(/^https?:\/\//i.test(path))return path;
 const clean=path.replace(/^\/+|\/+$/g,'');
 return clean?`${siteConfig.baseUrl}/${clean}`:`${siteConfig.baseUrl}/`;
}

export function brandedTitle(title:string){
 return title.includes('مَدار')||title.includes('ORBIT')?title:`${title} | ${siteConfig.name}`;
}

export function safeJsonLd(value:unknown){
 return JSON.stringify(value).replace(/</g,'\\u003c');
}

function sharedMetadata(options:MetadataOptions){
 const title=brandedTitle(options.title);
 const url=absoluteUrl(options.path);
 const image=absoluteUrl(options.image||siteConfig.assets.ogImage);
 return {
  title,
  url,
  image,
  metadata:{
   description:options.description,
   alternates:{canonical:url},
   keywords:options.keywords,
   robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-video-preview':-1,'max-image-preview':'large' as const,'max-snippet':-1}},
   openGraph:{title,description:options.description,url,siteName:siteConfig.name,locale:siteConfig.locale,type:'website' as const,images:[{url:image,width:siteConfig.openGraph.imageWidth,height:siteConfig.openGraph.imageHeight,alt:title}]},
   twitter:{card:'summary_large_image' as const,title,description:options.description,creator:siteConfig.seo.twitterHandle,images:[image]},
  },
 };
}

export function createRouteMetadata(options:MetadataOptions):Metadata{
 const shared=sharedMetadata(options);
 return {...shared.metadata,title:{default:shared.title,template:'%s'}};
}

export function createPageMetadata(options:MetadataOptions):Metadata{
 const shared=sharedMetadata(options);
 return {...shared.metadata,title:{absolute:shared.title}};
}

export function createStoreItemMetadata(item:StoreItem,entityType:StoreEntityType):Metadata{
 return createPageMetadata({
  title:item.name,
  description:item.shortDescription||item.longDescription,
  path:`/${routeSegment[entityType]}/${item.slug}`,
  image:item.thumbnailUrl,
  keywords:item.keywords,
 });
}

export function storeItemStructuredData(item:StoreItem,entityType:StoreEntityType){
 const url=absoluteUrl(`/${routeSegment[entityType]}/${item.slug}`);
 const availability={available:'https://schema.org/InStock',coming_soon:'https://schema.org/PreOrder',sold_out:'https://schema.org/OutOfStock',disabled:'https://schema.org/Discontinued'}[item.availability];
 const offer={'@type':'Offer',url,price:String(item.price),priceCurrency:item.currency,availability,itemCondition:'https://schema.org/NewCondition'};
 const shared={
  '@context':'https://schema.org',
  '@id':`${url}#item`,
  name:item.name,
  description:item.longDescription||item.shortDescription,
  url,
  ...(item.thumbnailUrl?{image:[absoluteUrl(item.thumbnailUrl)]}:{}),
  offers:offer,
 };
 if(entityType==='service')return {...shared,'@type':'Service',serviceType:item.itemType,provider:{'@type':'Organization','@id':`${siteConfig.baseUrl}/#organization`,name:siteConfig.name,url:siteConfig.baseUrl}};
 return {...shared,'@type':'Product',sku:item.id,category:entityType==='plan'?'اشتراك':'منتج رقمي',brand:{'@type':'Brand',name:siteConfig.name},...(item.ratingCount>0?{aggregateRating:{'@type':'AggregateRating',ratingValue:item.ratingAverage,ratingCount:item.ratingCount}}:{})};
}
