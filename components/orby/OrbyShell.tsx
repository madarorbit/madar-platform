'use client';

import Link from 'next/link';
import {useState,type ReactNode} from 'react';

export default function OrbyShell({children,sidebar,plus,newChatHref,authenticated}:{children:ReactNode;sidebar?:ReactNode;plus:boolean;newChatHref:string;authenticated:boolean}){
 const[open,setOpen]=useState(false);
 return <main className="min-h-[calc(100dvh-4rem)] bg-[radial-gradient(circle_at_top,#17122d_0%,#080b12_38%,#05070c_100%)] text-slate-100">
  <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1600px] flex-col px-2 py-2 sm:px-4 sm:py-4">
   <header className="sticky top-2 z-30 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#0b0f18]/90 px-3 py-2 shadow-2xl shadow-black/20 backdrop-blur-xl sm:px-4">
    <div className="flex items-center gap-2">
     {authenticated&&sidebar?<button type="button" onClick={()=>setOpen(value=>!value)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.04] transition hover:bg-white/[.08]" aria-label={open?'إغلاق قائمة أوربي':'فتح قائمة أوربي'} aria-expanded={open}><span className="grid gap-1"><i className="block h-0.5 w-5 rounded-full bg-current"/><i className="block h-0.5 w-3.5 rounded-full bg-current"/></span></button>:null}
     <div className="flex items-center gap-2"><strong className="text-base font-black tracking-wide sm:text-lg">ORBY</strong>{plus?<span className="rounded-full border border-violet-300/30 bg-violet-400/15 px-2 py-0.5 text-[11px] font-black text-violet-100">Plus</span>:null}</div>
    </div>
    <div className="flex items-center gap-2">
     <Link href={newChatHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs font-bold text-emerald-100 transition hover:bg-emerald-300/15"><span aria-hidden>＋</span><span className="hidden sm:inline">محادثة جديدة</span></Link>
     <details className="relative"><summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-white/10 bg-white/[.04] text-xl leading-none hover:bg-white/[.08]" aria-label="المزيد">⋮</summary><div className="absolute end-0 top-12 z-50 min-w-48 rounded-xl border border-white/10 bg-[#111725] p-2 text-sm shadow-2xl"><Link className="block rounded-lg px-3 py-2 hover:bg-white/[.06]" href="/orby/plus">ORBY Plus</Link>{authenticated?<><Link className="block rounded-lg px-3 py-2 hover:bg-white/[.06]" href="/account/privacy">الخصوصية والبيانات</Link><Link className="block rounded-lg px-3 py-2 hover:bg-white/[.06]" href="/account">حساب مَدار</Link></>:<Link className="block rounded-lg px-3 py-2 hover:bg-white/[.06]" href="/login?next=/orby">تسجيل الدخول</Link>}</div></details>
    </div>
   </header>
   <div className={`relative mt-2 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#070a11]/80 ${authenticated&&sidebar?'lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]':''}`}>
    {authenticated&&sidebar?<><button type="button" aria-label="إغلاق القائمة" onClick={()=>setOpen(false)} className={`fixed inset-0 z-30 bg-black/55 transition lg:hidden ${open?'opacity-100':'pointer-events-none opacity-0'}`}/><aside className={`fixed inset-y-0 right-0 z-40 w-[min(88vw,20rem)] overflow-y-auto border-l border-white/10 bg-[#0b0f18] p-3 pt-20 shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:translate-x-0 lg:border-l lg:pt-3 ${open?'translate-x-0':'translate-x-full'}`}>{sidebar}</aside></>:null}
    <section className="min-w-0 flex-1">{children}</section>
   </div>
  </div>
 </main>;
}
