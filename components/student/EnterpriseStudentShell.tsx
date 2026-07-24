'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import type {ReactNode} from 'react';
import {Icon,type IconName} from '@/components/ui/Icons';
import {cx} from '@/components/ui/Enterprise';
import {siteConfig} from '@/src/config/site';
import ThemeToggle from '@/components/theme/ThemeToggle';
import NavigationControls from '@/components/navigation/NavigationControls';

const navigation:Array<{view:string;label:string;icon:IconName;orby?:boolean}>=[
 {view:'dashboard',label:'لوحة المعلومات',icon:'home'},
 {view:'courses',label:'المقررات والمعدل',icon:'book'},
 {view:'tasks',label:'المهام والتذكيرات',icon:'check'},
 {view:'library',label:'المكتبة',icon:'document'},
 {view:'calendar',label:'الجداول والمواعيد',icon:'calendar'},
 {view:'notes',label:'الملاحظات',icon:'note'},
 {view:'focus',label:'التركيز والأهداف',icon:'clock'},
 {view:'ai',label:'أوربي',icon:'sparkles',orby:true},
];

export default function EnterpriseStudentShell({children}:{children:ReactNode}){
 const searchParams=useSearchParams();const active=searchParams.get('view')||'dashboard';
 return <div className="md-sidebar-layout md-shell">
  <aside className="md-sidebar md-no-print" aria-label="تنقل مساحة الطالب"><div className="border-b border-white/10 pb-4"><Link href="/" className="flex items-center text-white"><Image src={siteConfig.assets.logo} alt="شعار مَدار | ORBIT" width={164} height={38} className="h-8 w-auto"/></Link><div className="mt-3"><p className="text-xs font-bold text-emerald-300">مَدار | ORBIT للتعليم</p><h1 className="text-sm font-black">مساحة الطالب الجامعي</h1></div></div><nav className="md-sidebar-nav mt-5">{navigation.map(item=><Link key={item.view} href={`/student?view=${item.view}`} aria-current={active===item.view?'page':undefined} className={cx('md-sidebar-link',active===item.view&&'md-sidebar-link-active',item.orby&&'border border-violet-300/10 bg-gradient-to-l from-violet-400/10 to-emerald-400/5')}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[.04]">{item.orby?<Image src={siteConfig.assets.orby} alt="صورة أوربي" width={28} height={28} unoptimized className="md-orby-alive h-7 w-7 rounded-md object-cover"/>:<Icon name={item.icon} className="h-4 w-4"/>}</span><span>{item.label}</span></Link>)}</nav><div className="mt-5 border-t border-white/10 pt-4"><Link href="/account" className="md-sidebar-link"><Icon name="user" className="h-4 w-4"/>الحساب والإعدادات</Link></div></aside>
  <div className="min-w-0"><header className="md-topbar md-no-print"><div className="flex min-h-14 items-center justify-between gap-4 px-4 sm:px-6"><NavigationControls/><div className="flex items-center gap-2"><ThemeToggle/><Link href="/student?view=ai" className="hidden sm:inline-flex"><span className="md-orby-chip"><Image src={siteConfig.assets.orby} alt="صورة أوربي" width={28} height={28} unoptimized className="md-orby-avatar md-orby-alive"/><span>اسأل أوربي</span></span></Link><Link href="/account" className="md-button md-button-secondary md-button-sm"><Icon name="user"/>حسابي</Link></div></div></header><div className="min-w-0">{children}</div></div>
 </div>;
}
