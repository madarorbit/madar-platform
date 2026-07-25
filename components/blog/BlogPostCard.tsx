/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import {deleteBlogPost} from '@/app/actions/blog';
import {blogCategoryBySlug} from '@/src/data/blog';
import type {BlogPost} from '@/src/lib/blog/server';

export default function BlogPostCard({post,canManage=false}:{post:BlogPost;canManage?:boolean}){
 const category=blogCategoryBySlug(post.category_slug);
 return <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[.04] transition hover:-translate-y-1 hover:border-[#70E4D4]/30">
  {post.media_type==='image'&&post.media_url?<img src={post.media_url} alt={post.title} className="aspect-[16/9] w-full object-cover" loading="lazy"/>:<div className="grid aspect-[16/9] place-items-center bg-gradient-to-br from-violet-400/15 via-white/[.02] to-emerald-400/10"><img src={category?.iconUrl} alt="" className="h-16 w-16 opacity-90" loading="lazy"/></div>}
  <div className="flex flex-1 flex-col p-6"><div className="flex flex-wrap items-center gap-2 text-xs font-bold"><span className="text-[#70E4D4]">{category?.title||post.category_slug}</span><span className="text-slate-500">{new Date(post.published_at||post.created_at).toLocaleDateString('ar-YE')}</span>{post.status==='draft'&&<span className="rounded-full bg-amber-300/10 px-2 py-1 text-amber-200">مسودة</span>}{post.media_type==='video'&&<span className="rounded-full bg-violet-300/10 px-2 py-1 text-violet-200">فيديو</span>}</div>
   <h2 className="mt-4 text-2xl font-black leading-9"><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p className="mt-3 flex-1 leading-7 text-slate-300">{post.excerpt||post.content.slice(0,180)}</p>
   <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-bold text-slate-400"><div className="flex gap-4"><span>♡ {post.likes_count}</span><span>◌ {post.comments_count}</span></div><span>↗ {post.shares_count}</span></div>
   <div className="mt-5 flex flex-wrap gap-2"><Link href={`/blog/${post.slug}`} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-slate-950">قراءة</Link>{canManage&&<><Link href={`/blog/manage/${post.id}`} className="rounded-xl border border-violet-300/30 px-4 py-2 text-sm font-black text-violet-100">تعديل</Link><form action={deleteBlogPost}><input type="hidden" name="id" value={post.id}/><button className="rounded-xl border border-red-300/25 px-4 py-2 text-sm font-black text-red-200">حذف</button></form></>}</div>
  </div>
 </article>;
}
