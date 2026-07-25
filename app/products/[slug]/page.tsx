import type {Metadata} from 'next';
import StoreDetailPage from '@/components/store/StoreDetailPage';
import {getStoreItem} from '@/src/lib/store/server';
import {siteConfig} from '@/src/config/site';

type Props={params:Promise<{slug:string}>};
export const dynamic='force-dynamic';
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const slug=(await params).slug;
 try{
  const item=await getStoreItem('product',slug);
  if(!item)return{title:'منتج غير موجود',robots:{index:false,follow:false}};
  const url=`${siteConfig.baseUrl}/products/${slug}`;
  const image=item.thumbnailUrl||siteConfig.assets.ogImage;
  return{title:item.name,description:item.shortDescription,alternates:{canonical:url},openGraph:{title:item.name,description:item.shortDescription,url,type:'website',images:[image]},twitter:{card:'summary_large_image',title:item.name,description:item.shortDescription,images:[image]}};
 }catch{return{title:'تعذر تحميل المنتج',robots:{index:false,follow:false}}}
}
export default async function Page({params}:Props){return <StoreDetailPage entityType="product" slug={(await params).slug}/>}