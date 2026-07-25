'use client';

import {useActionState,useEffect,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {addBlogComment,likeBlogPost,shareBlogPost,type BlogCommentState} from '@/app/actions/blog';

const initial:BlogCommentState={};

function Heart(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg>}
function Message(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>}
function Share(){return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/></svg>}

export default function BlogInteractions({postId,title,initialLikes,initialComments,initialShares,authenticatedName}:{postId:string;title:string;initialLikes:number;initialComments:number;initialShares:number;authenticatedName?:string}){
 const router=useRouter(),[pending,startTransition]=useTransition(),[liked,setLiked]=useState(false),[likes,setLikes]=useState(initialLikes),[shares,setShares]=useState(initialShares);
 const[state,commentAction,commentPending]=useActionState(addBlogComment,initial);
 useEffect(()=>{if(state.success)router.refresh()},[state.success,router]);
 const like=()=>startTransition(async()=>{const result=await likeBlogPost(postId);setLikes(result.count);if(result.ok)setLiked(true)});
 const share=()=>startTransition(async()=>{const url=window.location.href;try{if(navigator.share)await navigator.share({title,url});else await navigator.clipboard.writeText(url);const result=await shareBlogPost(postId);setShares(result.count)}catch{}});
 return <section className="mt-10 border-t border-white/10 pt-7">
  <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2">
   <button type="button" onClick={like} disabled={pending||liked} aria-label="إعجاب" className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition ${liked?'border-pink-300/40 bg-pink-400/15 text-pink-200':'border-white/10 bg-white/[.04] text-slate-300 hover:border-pink-300/30 hover:text-pink-200'}`}><Heart/><span>{likes}</span></button>
   <a href="#comments" aria-label="التعليقات" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-violet-300/30 hover:text-violet-200"><Message/><span>{initialComments}</span></a>
  </div><button type="button" onClick={share} disabled={pending} aria-label="مشاركة" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm font-bold text-slate-300 transition hover:border-emerald-300/30 hover:text-emerald-200"><Share/><span>{shares}</span></button></div>
  <form action={commentAction} className="mt-8 rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><input type="hidden" name="post_id" value={postId}/><div className="hidden" aria-hidden="true"><label>الموقع<input name="website" tabIndex={-1} autoComplete="off"/></label></div><h2 className="text-xl font-black">أضف تعليقًا</h2><div className="mt-4 grid gap-4">{!authenticatedName&&<label className="grid gap-2 text-sm font-bold">الاسم<input name="author_name" required minLength={2} maxLength={80} className="field rounded-xl p-3"/></label>}<label className="grid gap-2 text-sm font-bold">التعليق<textarea name="body" required minLength={2} maxLength={1200} rows={4} className="field rounded-xl p-3" placeholder="اكتب تعليقك باحترام ووضوح."/></label></div>{state.error&&<p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">{state.error}</p>}{state.success&&<p role="status" className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">{state.success}</p>}<button disabled={commentPending} className="mt-4 rounded-xl bg-white px-5 py-3 font-black text-slate-950 disabled:opacity-60">{commentPending?'جارٍ النشر…':'نشر التعليق'}</button></form>
 </section>;
}
