import 'server-only';
import {redirect} from 'next/navigation';
import {supabaseConfig} from '@/src/lib/env';
import {currentProfile,supabaseFetch,type Profile} from '@/src/lib/supabase/server';
import type {BlogCategorySlug} from '@/src/data/blog';

export type BlogPost={
 id:string;category_slug:BlogCategorySlug;slug:string;title:string;excerpt:string;content:string;
 status:'draft'|'published';media_type:'image'|'video'|null;media_url:string|null;media_path:string|null;
 author_id:string;likes_count:number;comments_count:number;shares_count:number;
 published_at:string|null;created_at:string;updated_at:string;
};
export type BlogComment={id:string;post_id:string;author_name:string;body:string;created_at:string};

const postSelect='id,category_slug,slug,title,excerpt,content,status,media_type,media_url,media_path,author_id,likes_count,comments_count,shares_count,published_at,created_at,updated_at';

export function canManageBlog(profile:Profile|null|undefined){return Boolean(profile&&profile.status==='active'&&(profile.role==='SUPER_ADMIN'||profile.role==='EDITOR'));}

export async function requireBlogManager(){
 const profile=await currentProfile();
 if(!profile)redirect('/login?next=/blog');
 if(!canManageBlog(profile))redirect('/blog?error=forbidden');
 return profile;
}

async function publicFetch(path:string){
 const {url,key}=supabaseConfig();
 const response=await fetch(`${url}${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},cache:'no-store'});
 if(!response.ok)throw new Error('تعذر تحميل محتوى المدونة.');
 return response.json();
}

export async function listPublishedPosts(options:{category?:BlogCategorySlug;limit?:number}={}){
 const category=options.category?`&category_slug=eq.${encodeURIComponent(options.category)}`:'';
 const limit=Math.min(Math.max(options.limit||60,1),500);
 return await publicFetch(`/rest/v1/blog_posts?select=${postSelect}&status=eq.published${category}&order=published_at.desc.nullslast,created_at.desc&limit=${limit}`) as BlogPost[];
}

export async function listVisiblePosts(options:{category?:BlogCategorySlug;limit?:number}={}){
 const profile=await currentProfile().catch(()=>null);
 if(!canManageBlog(profile))return listPublishedPosts(options);
 const category=options.category?`&category_slug=eq.${encodeURIComponent(options.category)}`:'';
 const limit=Math.min(Math.max(options.limit||100,1),500);
 return await supabaseFetch(`/rest/v1/blog_posts?select=${postSelect}${category}&order=published_at.desc.nullslast,created_at.desc&limit=${limit}`) as BlogPost[];
}

export async function getVisiblePostBySlug(slug:string){
 const profile=await currentProfile().catch(()=>null);
 const path=`/rest/v1/blog_posts?select=${postSelect}&slug=eq.${encodeURIComponent(slug)}&limit=1`;
 const rows=canManageBlog(profile)?await supabaseFetch(path).catch(()=>[]) as BlogPost[]:await publicFetch(`${path}&status=eq.published`).catch(()=>[]) as BlogPost[];
 return rows[0]||null;
}

export async function getPostForManager(id:string){
 await requireBlogManager();
 const rows=await supabaseFetch(`/rest/v1/blog_posts?select=${postSelect}&id=eq.${encodeURIComponent(id)}&limit=1`) as BlogPost[];
 return rows[0]||null;
}

export async function getPublicComments(postId:string){
 return await publicFetch(`/rest/v1/blog_comments?select=id,post_id,author_name,body,created_at&post_id=eq.${encodeURIComponent(postId)}&is_visible=eq.true&order=created_at.asc&limit=500`) as BlogComment[];
}
