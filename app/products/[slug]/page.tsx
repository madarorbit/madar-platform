import type {Metadata} from 'next';
import StoreDetailPage from '@/components/store/StoreDetailPage';
import {getStoreItem} from '@/src/lib/store/server';

type Props={params:Promise<{slug:string}>};
export const dynamic='force-dynamic';
export async function generateMetadata({params}:Props):Promise<Metadata>{try{const item=await getStoreItem('product',(await params).slug);return item?{title:item.name,description:item.shortDescription}:{title:'منتج غير موجود'}}catch{return{title:'تعذر تحميل المنتج'}}}
export default async function Page({params}:Props){return <StoreDetailPage entityType="product" slug={(await params).slug}/>}
