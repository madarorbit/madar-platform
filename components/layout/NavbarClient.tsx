'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {siteConfig} from '@/src/config/site';
import {Icon} from '@/components/ui/Icons';

const focus='focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2';
type Props={authenticated:boolean;displayName?:string;hasAvatar:boolean;isAdmin:boolean};

function AccountLink({hasAvatar,displayName,onClick}:{hasAvatar:boolean;displayName?:string;onClick?:()=>void}){
 return <Link href="/account" onClick={onClick} className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold text-slate-800 transition hover:border-violet-200 hover:bg-violet-50 ${focus}`}>
  {hasAvatar?<Image src="/account/avatar" alt="صورة الحساب" width={30} height={30} unoptimized className="h-8 w-8 rounded-full object-cover"/>:<span className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-[#5B2AE8]"><Icon name="user" className="h-4 w-4"/></span>}
  <span className="max-w-28 truncate">{displayName||'حسابي'}</span>
 </Link>;
}

export default function NavbarClient({authenticated,displayName,hasAvatar,isAdmin}:Props){
 const[open,setOpen]=useState(false);const pathname=usePathname();const active=(href:string)=>href==='/'?pathname==='/':pathname?.startsWith(href);
 return <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl" aria-label="التنقل الرئيسي">
  <div className="mx-auto flex min-h-18 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
   <Link href="/" className={`flex shrink-0 items-center gap-2 rounded-xl ${focus}`} aria-label="مَدار — الرئيسية"><Image src={siteConfig.assets.logo} alt="" width={112} height={38} priority className="h-9 w-auto"/><span className="hidden text-sm font-black text-slate-950 sm:inline">مَدار</span></Link>
   <div className="hidden flex-1 items-center justify-center gap-1 lg:flex">{siteConfig.nav.map(link=><Link key={link.href} href={link.href} aria-current={active(link.href)?'page':undefined} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${focus} ${active(link.href)?'bg-violet-50 text-[#5B2AE8]':'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}`}>{link.label}</Link>)}</div>
   <div className="mr-auto hidden items-center gap-2 md:flex"><Link href="/search" className={`grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-violet-50 hover:text-[#5B2AE8] ${focus}`} aria-label="البحث"><Icon name="search"/></Link>{authenticated?<>{isAdmin&&<Link href="/admin" className="rounded-xl px-3 py-2 text-sm font-bold text-[#5B2AE8]">الإدارة</Link>}<AccountLink hasAvatar={hasAvatar} displayName={displayName}/></>:<><Link href="/login" className={`rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 ${focus}`}>تسجيل الدخول</Link><Link href="/register" className={`rounded-xl bg-gradient-to-l from-[#6C3BFF] to-[#00A98F] px-5 py-2.5 text-sm font-bold text-white ${focus}`}>ابدأ مع مَدار</Link></>}</div>
   <button type="button" onClick={()=>setOpen(v=>!v)} className={`mr-auto rounded-xl p-2.5 text-slate-900 hover:bg-slate-100 md:hidden ${focus}`} aria-expanded={open} aria-controls="mobile-nav" aria-label={open?'إغلاق القائمة':'فتح القائمة'}><span className="block h-5 w-6 space-y-1.5">{[0,1,2].map(i=><span key={i} className={`block h-0.5 rounded bg-current transition ${open&&i===0?'translate-y-2 rotate-45':''} ${open&&i===1?'opacity-0':''} ${open&&i===2?'-translate-y-2 -rotate-45':''}`}/>)}</span></button>
  </div>
  {open&&<div id="mobile-nav" className="border-t border-slate-200 bg-white px-4 py-4 md:hidden"><div className="mx-auto grid max-w-7xl gap-2">{siteConfig.nav.map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)} className={`rounded-xl px-4 py-3 font-semibold ${active(link.href)?'bg-violet-50 text-[#5B2AE8]':'text-slate-700 hover:bg-slate-50'}`}>{link.label}</Link>)}<Link href="/search" onClick={()=>setOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-slate-700"><Icon name="search"/> البحث في مَدار</Link>{authenticated?<div className="mt-2 grid gap-2">{isAdmin&&<Link href="/admin" onClick={()=>setOpen(false)} className="rounded-xl bg-violet-50 px-4 py-3 text-center font-bold text-[#5B2AE8]">لوحة الإدارة</Link>}<AccountLink hasAvatar={hasAvatar} displayName={displayName} onClick={()=>setOpen(false)}/></div>:<div className="mt-2 grid grid-cols-2 gap-2"><Link href="/login" onClick={()=>setOpen(false)} className="rounded-xl border px-4 py-3 text-center font-bold text-slate-800">تسجيل الدخول</Link><Link href="/register" onClick={()=>setOpen(false)} className="rounded-xl bg-[#5B2AE8] px-4 py-3 text-center font-bold text-white">ابدأ مع مَدار</Link></div>}</div></div>}
 </nav>;
}
