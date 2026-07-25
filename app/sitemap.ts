import type {MetadataRoute} from 'next';
import {siteConfig} from '@/src/config/site';
import {blogPosts,jobs} from '@/src/data/platform-content';
import {searchStore} from '@/src/lib/store/server';
import type {StoreEntityType} from '@/src/lib/store/types';

const routes=['','store','products','services','subscriptions','categories','offers','featured','latest','best-sellers','free','about','blog','docs','help','community','careers','contact','faq','privacy','terms','refund-policy','service-agreement'];
async function allStoreItems(entityType:StoreEntityType){const items:Awaited<ReturnType<typeof searchStore>>['items']=[];for(let page=1;page<=100;page+=1){const result=await searchStore({entityType,page,pageSize:48});items.push(...result.items);if(!result.hasMore)break}return items}

export default async function sitemap():Promise<MetadataRoute.Sitemap>{const lastModified=new Date('2026-07-25');let storeItems:Awaited<ReturnType<typeof searchStore>>['items']=[];try{storeItems=(await Promise.all([allStoreItems('product'),allStoreItems('service'),allStoreItems('plan')])).flat()}catch{}return[...routes.map(route=>({url:route?`${siteConfig.baseUrl}/${route}`:`${siteConfig.baseUrl}/`,lastModified,changeFrequency:route==='blog'?'weekly' as const:'monthly' as const,priority:route?0.7:1})),...storeItems.map(item=>({url:`${siteConfig.baseUrl}/${item.entityType==='product'?'products':item.entityType==='service'?'services':'subscriptions'}/${item.slug}`,lastModified:new Date(item.publishedAt||item.createdAt),changeFrequency:'weekly' as const,priority:.8})),...blogPosts.map(post=>({url:`${siteConfig.baseUrl}/blog/${post.slug}`,lastModified:new Date('2026-07-22'),changeFrequency:'monthly' as const,priority:.7})),...jobs.map(job=>({url:`${siteConfig.baseUrl}/careers/${job.slug}`,lastModified,changeFrequency:'weekly' as const,priority:.6}))]}
