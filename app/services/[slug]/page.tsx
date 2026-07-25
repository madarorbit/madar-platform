import type {Metadata} from 'next';
import StoreDetailPage from '@/components/store/StoreDetailPage';
import {createStoreItemMetadata} from '@/src/lib/seo';
import {getStoreItem} from '@/src/lib/store/server';

type Props={params:Promise<{slug:string}>};
export const dynamic='force-dynamic';
export async function generateMetadata({params}:Props):Promise<Metadata>{try{const item=await getStoreItem('service',(await params).slug);return item?createStoreItemMetadata(item,'service'):{title:{absolute:'خدمة غير موجودة | مَدار | ORBIT'},robots:{index:false,follow:false}}}catch{return{title:{absolute:'تعذر تحميل الخدمة | مَدار | ORBIT'},robots:{index:false,follow:false}}}}
export default async function Page({params}:Props){return <StoreDetailPage entityType="service" slug={(await params).slug}/>}
