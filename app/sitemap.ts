import type {MetadataRoute} from 'next';
import {siteConfig} from '@/src/config/site';
import {blogPosts,jobs} from '@/src/data/platform-content';
import {searchStore} from '@/src/lib/store/server';

const routes=['','store','products','services','subscriptions','categories','offers','featured','latest','best-sellers','free','about','blog','docs','help','community','careers','contact','faq','privacy','terms','refund-policy','service-agreement'];

export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const lastModified=new Date('2026-07-25');
 let storeItems:Awaited<ReturnType<typeof searchStore>>['items']=[];
 try{
  const results=await Promise.all([
   searchStore({entityType:'product',pageSize:48}),
   searchStore({entityType:'service',pageSize:48}),
   searchStore({entityType:'plan',pageSize:48}),
  ]);
  storeItems=results.flatMap(result=>result.items);
 }catch{}
 return [
  ...routes.map(route=>({url:route?`${siteConfig.baseUrl}/${route}`:`${siteConfig.baseUrl}/`,lastModified,changeFrequency:route==='blog'?'weekly' as const:'monthly' as const,priority:route?0.7:1})),
  ...storeItems.map(item=>({url:`${siteConfig.baseUrl}/${item.entityType==='product'?'products':item.entityType==='service'?'services':'subscriptions'}/${item.slug}`,lastModified:new Date(item.publishedAt||item.createdAt),changeFrequency:'weekly' as const,priority:.8})),
  ...blogPosts.map(post=>({url:`${siteConfig.baseUrl}/blog/${post.slug}`,lastModified,changeFrequency:'monthly' as const,priority:.7})),
  ...jobs.map(job=>({url:`${siteConfig.baseUrl}/careers/${job.slug}`,lastModified,changeFrequency:'weekly' as const,priority:.6})),
 ];
}