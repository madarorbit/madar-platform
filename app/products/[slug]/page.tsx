import type {Metadata} from 'next';
import StoreDetailPage from '@/components/store/StoreDetailPage';
import {createStoreItemMetadata} from '@/src/lib/seo';
import {getStoreItem} from '@/src/lib/store/server';

type Props={params:Promise<{slug:string}>};
export const dynamic='force-dynamic';
export async function generateMetadata({params}:Props):Promise<Metadata>{try{const item=await getStoreItem('product',(await params).slug);return item?createStoreItemMetadata(item,'product'):{title:{absolute:'منتج غير موجود | مَدار | ORBIT'},robots:{index:false,follow:false}}}catch{return{title:{absolute:'تعذر تحميل المنتج | مَدار | ORBIT'},robots:{index:false,follow:false}}}}
export default async function Page({params}:Props){return <StoreDetailPage entityType="product" slug={(await params).slug}/>}
