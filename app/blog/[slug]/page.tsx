/* eslint-disable @next/next/no-img-element */
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import BlogInteractions from '@/components/blog/BlogInteractions';
import {deleteBlogPost} from '@/app/actions/blog';
import {blogCategoryBySlug} from '@/src/data/blog';
import {canManageBlog,getPublicComments,getVisiblePostBySlug} from '@/src/lib/blog/server';
import {currentProfile} from '@/src/lib/supabase/server';
import {absoluteUrl,createPageMetadata,safeJsonLd} from '@/src/lib/seo';
import {siteConfig} from '@/src/config/site';

export const dynamic='force-dynamic';

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const{slug}=await params,post=await getVisiblePostBySlug(slug).catch(()=>null);
 if(!post)return{title:'مقال غير موجود',robots:{index:false,follow:false}};
 const metadata=createPageMetadata({title:post.title,description:post.excerpt||post.content.slice(0,160),path:`/blog/${post.slug}`});
 return post.status==='draft'?{...metadata,robots:{index:false,follow:false}}:metadata;
}

export default async function BlogPostPage({params}:{params:Promise<{slug:string}>}){
 const{slug}=await params,post=await getVisiblePostBySlug(slug).catch(()=>null);if(!post)notFound();
 const profile=await currentProfile().catch(()=>null),manager=canManageBlog(profile),category=blogCategoryBySlug(post.category_slug),comments=post.status==='published'?await getPublicComments(post.id).catch(()=>[]):[];
 const url=absoluteUrl(`/blog/${post.slug}`),description=post.excerpt||post.content.slice(0,160),structuredData={'@context':'https://schema.org','@type':'Article',headline:post.title,description,datePublished:post.published_at||post.created_at,dateModified:post.updated_at,inLanguage:'ar',mainEntityOfPage:url,image:post.media_type==='image'&&post.media_url?[post.media_url]:[absoluteUrl(siteConfig.assets.ogImage)],author:{'@type':'Organization',name:siteConfig.name},publisher:{'@type':'Organization',name:siteConfig.name}};
 const paragraphs=post.content.split(/\n\s*\n/).map(value=>value.trim()).filter(Boolean);
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:safeJsonLd(structuredData)}}/><PageShell><PageHero eyebrow={`${category?.title||'مدونة مَدار'} · ${new Date(post.published_at||post.created_at).toLocaleDateString('ar-YE')}`} title={post.title} description={description}/><Section><article className="mx-auto max-w-4xl">
  {post.status==='draft'&&<div className="mb-6 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 font-bold text-amber-100">هذه مسودة خاصة لا يراها إلا المؤسس أو المدوّن المعتمد.</div>}
  {manager&&<div className="mb-6 flex flex-wrap gap-2"><Link href={`/blog/manage/${post.id}`} className="rounded-xl bg-violet-300 px-5 py-3 font-black text-violet-950">تعديل المقال</Link><form action={deleteBlogPost}><input type="hidden" name="id" value={post.id}/><button className="rounded-xl border border-red-300/30 px-5 py-3 font-black text-red-200">حذف المقال</button></form></div>}
  {post.media_type==='image'&&post.media_url&&<img src={post.media_url} alt={post.title} className="mb-8 max-h-[34rem] w-full rounded-3xl border border-white/10 object-cover"/>}{post.media_type==='video'&&post.media_url&&<video src={post.media_url} controls preload="metadata" className="mb-8 max-h-[34rem] w-full rounded-3xl border border-white/10 bg-black"/>}
  <div className="rounded-3xl border border-white/10 bg-white/[.025] p-6 sm:p-10">{paragraphs.map((paragraph,index)=><p key={`${index}-${paragraph.slice(0,20)}`} className={`${index?'mt-7':''} whitespace-pre-wrap text-lg leading-9 text-slate-200`}>{paragraph}</p>)}</div>
  {post.status==='published'&&<BlogInteractions postId={post.id} title={post.title} initialLikes={post.likes_count} initialComments={post.comments_count} initialShares={post.shares_count} authenticatedName={profile?.full_name||undefined}/>} 
  <section id="comments" className="mt-10"><h2 className="text-2xl font-black">التعليقات ({post.comments_count})</h2>{comments.length?<div className="mt-5 space-y-4">{comments.map(comment=><article key={comment.id} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{comment.author_name}</strong><time className="text-xs text-slate-500">{new Date(comment.created_at).toLocaleString('ar-YE')}</time></div><p className="mt-3 whitespace-pre-wrap leading-8 text-slate-300">{comment.body}</p></article>)}</div>:<p className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-500">لا توجد تعليقات بعد.</p>}</section>
  <div className="mt-10 border-t border-white/10 pt-7"><Link href={`/blog/category/${post.category_slug}`} className="font-bold text-[#70E4D4]">العودة إلى قسم {category?.title}</Link></div>
 </article></Section></PageShell></>;
}
