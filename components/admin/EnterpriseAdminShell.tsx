'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import {Icon,type IconName} from '@/components/ui/Icons';
import {cx} from '@/components/ui/Enterprise';
import {siteConfig} from '@/src/config/site';
import ThemeToggle from '@/components/theme/ThemeToggle';

const common:Array<{href:string;label:string;icon:IconName}>=[
 {href:'/admin',label:'نظرة الإدارة',icon:'home'},
 {href:'/admin/orders',label:'طلبات المتجر',icon:'store'},
 {href:'/admin/reports',label:'التقارير والإيرادات',icon:'chart'},
 {href:'/admin/products',label:'المنتجات',icon:'layers'},
 {href:'/admin/services',label:'الخدمات',icon:'briefcase'},
 {href:'/admin/categories',label:'التصنيفات',icon:'document'},
 {href:'/admin/coupons',label:'القسائم',icon:'megaphone'},
 {href:'/admin/users',label:'المستخدمون',icon:'community'},
 {href:'/admin/workspace-requests',label:'طلبات المساحات',icon:'automation'},
 {href:'/admin/local-payments',label:'الدفع والاشتراكات',icon:'shield'},
 {href:'/admin/applications',label:'طلبات التوظيف',icon:'briefcase'},
 {href:'/admin/beta-operations',label:'الدعم التجريبي',icon:'help'},
 {href:'/admin/system-health',label:'صحة المنصة',icon:'check'},
];
const founder:Array<{href:string;label:string;icon:IconName}>=[
 {href:'/admin/founder',label:'مركز قيادة المؤسس',icon:'sparkles'},
 {href:'/admin/founder/users',label:'تحكم الحسابات',icon:'user'},
 {href:'/admin/founder/workspaces',label:'تحكم المساحات',icon:'layers'},
 {href:'/admin/founder/settings',label:'إعدادات المنصة',icon:'automation'},
 {href:'/admin/founder/audit',label:'سجل القرارات',icon:'shield'},
];

export default function EnterpriseAdminShell({children,displayName,isFounder}:{children:ReactNode;displayName:string;isFounder:boolean}){
 const pathname=usePathname();const active=(href:string)=>href==='/admin'?pathname==='/admin':pathname?.startsWith(href);
 const link=(item:{href:string;label:string;icon:IconName})=><Link key={item.href} href={item.href} aria-current={active(item.href)?'page':undefined} className={cx('md-sidebar-link',active(item.href)&&'md-sidebar-link-active')}><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.04]"><Icon name={item.icon} className="h-4 w-4"/></span><span>{item.label}</span></Link>;
 return <div className="md-sidebar-layout md-shell"><aside className="md-sidebar md-no-print" aria-label="تنقل إدارة مَدار"><div className="flex items-center gap-3 border-b border-white/10 pb-4"><Link href="/" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.045]"><Image src={siteConfig.assets.logo} alt="مَدار" width={34} height={34} className="h-7 w-auto brightness-0 invert"/></Link><div><p className="text-xs font-bold text-emerald-300">إدارة المنصة</p><h1 className="font-black">مَدار</h1></div></div><div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3"><span className="block text-xs text-slate-500">الحساب الإداري</span><strong className="mt-1 block truncate text-sm">{displayName}</strong>{isFounder&&<span className="md-badge md-badge-brand mt-2">المؤسس</span>}</div><nav className="md-sidebar-nav mt-5">{common.map(link)}</nav>{isFounder&&<><div className="my-5 border-t border-white/10"/><p className="mb-2 px-2 text-xs font-black text-violet-200">صلاحيات المؤسس</p><nav className="md-sidebar-nav">{founder.map(link)}</nav></>}<div className="mt-5 border-t border-white/10 pt-4"><Link href="/account" className="md-sidebar-link"><Icon name="user" className="h-4 w-4"/>العودة إلى حسابي</Link></div></aside><div className="min-w-0"><header className="md-topbar md-no-print"><div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6"><div><p className="text-xs font-bold text-slate-500">لوحة التحكم المؤسسية</p><p className="font-black">إدارة مَدار</p></div><div className="flex items-center gap-2"><ThemeToggle/><Link href="/admin/system-health" className="md-button md-button-secondary md-button-sm"><Icon name="check"/>صحة المنصة</Link>{isFounder&&<Link href="/admin/founder" className="md-button md-button-primary md-button-sm"><Icon name="sparkles"/>مركز المؤسس</Link>}</div></div></header><div className="min-w-0">{children}</div></div></div>;
}
