'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {siteConfig} from '@/src/config/site';
import {Icon} from '@/components/ui/Icons';
import {cx} from '@/components/ui/Enterprise';
import ThemeToggle from '@/components/theme/ThemeToggle';

type Props={authenticated:boolean;displayName?:string;hasAvatar:boolean;isAdmin:boolean};

function AccountLink({hasAvatar,displayName,onClick}:{hasAvatar:boolean;displayName?:string;onClick?:()=>void}){
 return <Link href="/account" onClick={onClick} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.045] px-2.5 py-1.5 font-bold text-slate-100 transition hover:border-violet-300/30 hover:bg-violet-300/10">
  {hasAvatar?<Image src="/account/avatar" alt="صورة الحساب" width={32} height={32} unoptimized className="h-8 w-8 rounded-lg object-cover"/>:<span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-300/10 text-violet-200"><Icon name="user" className="h-4 w-4"/></span>}
  <span className="max-w-28 truncate text-sm">{displayName||'حسابي'}</span>
 </Link>;
}

export default function NavbarClient({authenticated,displayName,hasAvatar,isAdmin}:Props){
 const[open,setOpen]=useState(false);const pathname=usePathname();const active=(href:string)=>href==='/'?pathname==='/':pathname?.startsWith(href.split('#')[0]);
 const close=()=>setOpen(false);
 return <nav className="md-topbar top-0 z-50 md-no-print" aria-label="التنقل الرئيسي">
  <div className="md-container flex min-h-[4.65rem] items-center gap-3">
   <Link href="/" className="flex shrink-0 items-center gap-2 rounded-xl" aria-label="مَدار — الرئيسية"><Image src={siteConfig.assets.logo} alt="شعار مَدار" width={108} height={38} priority className="h-9 w-auto brightness-0 invert"/><span className="hidden text-sm font-black text-white sm:inline">مَدار</span></Link>
   <div className="hidden flex-1 items-center justify-center gap-1 lg:flex">{siteConfig.nav.map(link=><Link key={link.href} href={link.href} aria-current={active(link.href)?'page':undefined} className={cx('rounded-lg px-3 py-2 text-sm font-bold transition',active(link.href)?'bg-white/[.07] text-white':'text-slate-400 hover:bg-white/[.045] hover:text-white')}>{link.label}</Link>)}<Link href={siteConfig.links.orby} className="mr-1" aria-label="التعرف على أوربي"><span className="md-orby-chip"><Image src={siteConfig.assets.orby} alt="صورة أوربي" width={32} height={32} unoptimized className="md-orby-avatar"/><span>أوربي</span></span></Link></div>
   <div className="mr-auto hidden items-center gap-2 md:flex"><Link href="/search" className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-slate-400 transition hover:border-violet-300/30 hover:text-white" aria-label="البحث"><Icon name="search"/></Link>{authenticated?<><ThemeToggle compact/>{isAdmin&&<Link href="/admin" className="rounded-xl px-3 py-2 text-sm font-bold text-violet-200 transition hover:bg-violet-300/10">الإدارة</Link>}<AccountLink hasAvatar={hasAvatar} displayName={displayName}/></>:<><Link href="/login" className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[.045] hover:text-white">تسجيل الدخول</Link><Link href="/register" className="md-button md-button-primary md-button-sm">ابدأ مع مَدار</Link></>}</div>
   <button type="button" onClick={()=>setOpen(value=>!value)} className="mr-auto grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-white md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open?'إغلاق القائمة':'فتح القائمة'}><span className="block h-5 w-6 space-y-1.5">{[0,1,2].map(index=><span key={index} className={cx('block h-0.5 rounded bg-current transition',open&&index===0&&'translate-y-2 rotate-45',open&&index===1&&'opacity-0',open&&index===2&&'-translate-y-2 -rotate-45')}/>)}</span></button>
  </div>
  {open&&<div id="mobile-nav" className="border-t border-white/10 bg-[#090d18]/98 px-3 py-4 md:hidden"><div className="md-container grid gap-2">{siteConfig.nav.map(link=><Link key={link.href} href={link.href} onClick={close} className={cx('rounded-xl px-4 py-3 font-bold',active(link.href)?'bg-violet-300/10 text-violet-100':'text-slate-300 hover:bg-white/[.045]')}>{link.label}</Link>)}<Link href={siteConfig.links.orby} onClick={close} className="flex items-center justify-between rounded-xl border border-violet-300/15 bg-gradient-to-l from-violet-400/10 to-emerald-400/10 px-3 py-2"><span className="font-black">أوربي</span><Image src={siteConfig.assets.orby} alt="صورة أوربي" width={44} height={44} unoptimized className="h-11 w-11 rounded-xl object-cover"/></Link><Link href="/search" onClick={close} className="flex items-center gap-3 rounded-xl px-4 py-3 font-bold text-slate-300"><Icon name="search"/> البحث في مَدار</Link>{authenticated?<div className="mt-2 grid gap-2"><ThemeToggle/>{isAdmin&&<Link href="/admin" onClick={close} className="rounded-xl bg-violet-300/10 px-4 py-3 text-center font-bold text-violet-100">لوحة الإدارة</Link>}<AccountLink hasAvatar={hasAvatar} displayName={displayName} onClick={close}/></div>:<div className="mt-2 grid grid-cols-2 gap-2"><Link href="/login" onClick={close} className="md-button md-button-secondary md-button-sm">تسجيل الدخول</Link><Link href="/register" onClick={close} className="md-button md-button-primary md-button-sm">ابدأ مع مَدار</Link></div>}</div></div>}
 </nav>;
}
