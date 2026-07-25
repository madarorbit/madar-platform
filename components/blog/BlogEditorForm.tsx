/* eslint-disable @next/next/no-img-element */
'use client';

import {useActionState} from 'react';
import {blogCategories} from '@/src/data/blog';
import {createBlogPost,updateBlogPost,type BlogEditorState} from '@/app/actions/blog';
import type {BlogPost} from '@/src/lib/blog/server';

const initial:BlogEditorState={};

export default function BlogEditorForm({post}:{post?:BlogPost}){
 const[state,action,pending]=useActionState(post?updateBlogPost:createBlogPost,initial);
 return <form action={action} className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[.04] p-6 sm:p-8">
  {post&&<input type="hidden" name="id" value={post.id}/>}<div className="grid gap-5 sm:grid-cols-2">
   <label className="sm:col-span-2 grid gap-2 text-sm font-bold">عنوان المقال أو المنشور<input name="title" required minLength={4} maxLength={180} defaultValue={post?.title} className="field rounded-xl p-3" placeholder="اكتب عنوانًا واضحًا وجذابًا"/></label>
   <label className="grid gap-2 text-sm font-bold">القسم<select name="category_slug" required defaultValue={post?.category_slug||blogCategories[0].slug} className="field rounded-xl p-3">{blogCategories.map(category=><option key={category.slug} value={category.slug}>{category.title}</option>)}</select></label>
   <label className="grid gap-2 text-sm font-bold">حالة النشر<select name="status" defaultValue={post?.status||'draft'} className="field rounded-xl p-3"><option value="draft">مسودة خاصة</option><option value="published">منشور للعامة</option></select></label>
   <label className="sm:col-span-2 grid gap-2 text-sm font-bold">الرابط المختصر <span className="font-normal text-slate-500">اختياري؛ يُنشأ من العنوان تلقائيًا</span><input name="slug" maxLength={140} defaultValue={post?.slug} className="field rounded-xl p-3" dir="ltr" placeholder="example-article"/></label>
   <label className="sm:col-span-2 grid gap-2 text-sm font-bold">الملخص<input name="excerpt" maxLength={500} defaultValue={post?.excerpt} className="field rounded-xl p-3" placeholder="ملخص موجز يظهر في بطاقة المقال ونتائج البحث"/></label>
   <label className="sm:col-span-2 grid gap-2 text-sm font-bold">المحتوى<textarea name="content" required minLength={20} maxLength={40000} rows={18} defaultValue={post?.content} className="field rounded-2xl p-4 leading-8" placeholder="اكتب المحتوى هنا. افصل بين الفقرات بسطر فارغ."/></label>
   <label className="sm:col-span-2 grid gap-2 text-sm font-bold">صورة أو فيديو مرفق <span className="font-normal text-slate-500">الصور حتى 8 MB، والفيديو MP4 أو WebM حتى 25 MB</span><input name="media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="field rounded-xl p-3"/></label>
   {post?.media_url&&<div className="sm:col-span-2 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm font-bold">الوسائط الحالية</p>{post.media_type==='image'?<img src={post.media_url} alt="وسائط المقال الحالية" className="mt-3 max-h-72 w-full rounded-xl object-cover"/>:<video src={post.media_url} controls className="mt-3 max-h-72 w-full rounded-xl"/>}<label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="remove_media"/> حذف الوسائط الحالية عند الحفظ</label></div>}
  </div>
  {state.error&&<p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{state.error}</p>}
  <button disabled={pending} className="mt-6 w-full rounded-2xl bg-gradient-to-l from-[#6C3BFF] to-[#00A98F] px-6 py-4 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60">{pending?'جارٍ الحفظ…':post?'حفظ التعديلات':'إنشاء المقال'}</button>
 </form>;
}
