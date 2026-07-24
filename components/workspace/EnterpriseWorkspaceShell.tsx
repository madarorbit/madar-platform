'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {Icon,type IconName} from '@/components/ui/Icons';
import {cx} from '@/components/ui/Enterprise';
import {siteConfig} from '@/src/config/site';
import ThemeToggle from '@/components/theme/ThemeToggle';

const navigation:Array<{href:string;label:string;icon:IconName;orby?:boolean}>=[
 {href:'/workspace',label:'نظرة عامة',icon:'home'},
 {href:'/workspace/orby',label:'أوربي',icon:'sparkles',orby:true},
 {href:'/workspace/analytics',label:'التحليلات',icon:'chart'},
 {href:'/workspace/setup',label:'إعداد المساحة',icon:'automation'},
 {href:'/workspace/imports',label:'استيراد البيانات',icon:'document'},
 {href:'/workspace/products',label:'المنتجات',icon:'store'},
 {href:'/workspace/inventory',label:'المخزون',icon:'layers'},
 {href:'/workspace/customers',label:'العملاء',icon:'community'},
 {href:'/workspace/sales',label:'المبيعات',icon:'chart'},
 {href:'/workspace/expenses',label:'المصروفات',icon:'document'},
 {href:'/workspace/suppliers',label:'الموردون',icon:'briefcase'},
 {href:'/workspace/tasks',label:'المهام',icon:'check'},
 {href:'/workspace/activity',label:'سجل النشاط',icon:'shield'},
 {href:'/account/subscription',label:'الاشتراك والفوترة',icon:'layers'},
 {href:'/account/support',label:'الدعم والملاحظات',icon:'help'},
];

const roleNames:Record<string,string>={OWNER:'المالك',ADMIN:'مدير',EDITOR:'محرر',VIEWER:'مشاهد'};
const subscriptionNames:Record<string,string>={active:'نشط',trialing:'تجريبي',past_due:'متأخر',expired:'منتهي',cancelled:'ملغى',grace:'مهلة سماح'};
const currencyNames:Record<string,string>={YER:'ريال يمني',SAR:'ريال سعودي',USD:'دولار أمريكي'};

export default function EnterpriseWorkspaceShell({children,workspaceName,role,currency,subscriptionStatus}:{children:ReactNode;workspaceName:string;role:string;currency:string;subscriptionStatus:string}){
 const pathname=usePathname();
 const isActive=(href:string)=>href==='/workspace'?pathname==='/workspace':pathname?.startsWith(href);
 return <div className="md-sidebar-layout md-shell print:block">
  <aside className="md-sidebar md-no-print" aria-label="تنقل مساحة العمل"><div className="flex items-center gap-3 border-b border-white/10 pb-4"><Link href="/dashboard" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.045]"><Image src={siteConfig.assets.logo} alt="مَدار" width={32} height={32} className="h-7 w-auto brightness-0 invert"/></Link><div className="min-w-0"><p className="text-xs font-bold text-emerald-300">مساحة العمل</p><h1 className="truncate text-base font-black">{workspaceName}</h1></div></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><span className="block text-[11px] text-slate-500">الصلاحية</span><strong className="text-xs">{roleNames[role]||'عضو'}</strong></div><div className="rounded-xl border border-white/10 bg-white/[.03] p-2"><span className="block text-[11px] text-slate-500">الاشتراك</span><strong className="text-xs">{subscriptionNames[subscriptionStatus]||'غير محدد'}</strong></div></div><nav className="md-sidebar-nav mt-5">{navigation.map(item=><Link key={item.href} href={item.href} aria-current={isActive(item.href)?'page':undefined} className={cx('md-sidebar-link',isActive(item.href)&&'md-sidebar-link-active',item.orby&&'border border-violet-300/10 bg-gradient-to-l from-violet-400/10 to-emerald-400/5')}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.04]">{item.orby?<Image src={siteConfig.assets.orby} alt="صورة أوربي" width={32} height={32} unoptimized className="h-8 w-8 rounded-lg object-cover"/>:<Icon name={item.icon} className="h-4 w-4"/>}</span><span>{item.label}</span></Link>)}</nav><div className="mt-5 border-t border-white/10 pt-4 text-xs leading-6 text-slate-500">العملة: {currencyNames[currency]||currency}<br/>تُعزل بيانات هذه المساحة عن جميع المساحات الأخرى.</div></aside>
  <div className="min-w-0"><header className="md-topbar md-no-print"><div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6"><div><p className="text-xs font-bold text-slate-500">مَدار للأعمال</p><p className="font-black">{workspaceName}</p></div><div className="flex items-center gap-2"><ThemeToggle/><Link href="/workspace/orby" className="hidden sm:inline-flex"><span className="md-orby-chip"><Image src={siteConfig.assets.orby} alt="صورة أوربي" width={30} height={30} unoptimized className="md-orby-avatar"/><span>اسأل أوربي</span></span></Link><Link href="/account" className="md-button md-button-secondary md-button-sm"><Icon name="user"/>حسابي</Link></div></div></header><div className="min-w-0">{children}</div></div>
 </div>;
}
