'use client';

import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {Icon} from '@/components/ui/Icons';
import {cx} from '@/components/ui/Enterprise';

const labels:Record<string,string>={
 admin:'الإدارة',founder:'مركز المؤسس',users:'المستخدمون',workspaces:'المساحات',settings:'الإعدادات',audit:'سجل القرارات',orders:'الطلبات',reports:'التقارير',products:'المنتجات',services:'الخدمات',categories:'التصنيفات',coupons:'القسائم',applications:'طلبات التوظيف','workspace-requests':'طلبات المساحات','local-payments':'الدفع والاشتراكات','beta-operations':'الدعم التجريبي','system-health':'صحة المنصة',
 workspace:'مساحة العمل',orby:'أوربي',analytics:'التحليلات',setup:'إعداد المساحة',imports:'استيراد البيانات',inventory:'المخزون',customers:'العملاء',sales:'المبيعات',expenses:'المصروفات',suppliers:'الموردون',tasks:'المهام',activity:'سجل النشاط',
 student:'مساحة الطالب',account:'الحساب',subscription:'الاشتراك والفوترة',support:'الدعم والملاحظات',profile:'الملف الشخصي',dashboard:'لوحة المعلومات',store:'المتجر',about:'المنصة',blog:'المدونة',help:'المساعدة',search:'البحث'
};

export default function NavigationControls({className,showBreadcrumbs=true}:{className?:string;showBreadcrumbs?:boolean}){
 const pathname=usePathname()||'/';const router=useRouter();
 const parts=pathname.split('/').filter(Boolean);
 const crumbs=parts.map((part,index)=>({label:labels[part]||decodeURIComponent(part).replaceAll('-',' '),href:`/${parts.slice(0,index+1).join('/')}`}));
 return <div className={cx('md-navigation-controls',className)}>
  <div className="flex shrink-0 items-center gap-1" aria-label="التنقل في سجل الصفحات">
   <button type="button" onClick={()=>router.back()} className="md-history-button" aria-label="العودة إلى الصفحة السابقة" title="رجوع"><Icon name="back" className="h-4 w-4"/></button>
   <button type="button" onClick={()=>window.history.forward()} className="md-history-button" aria-label="الانتقال إلى الصفحة التالية" title="تقدم"><Icon name="forward" className="h-4 w-4"/></button>
  </div>
  {showBreadcrumbs&&<nav className="min-w-0" aria-label="مسار الصفحة"><ol className="md-breadcrumbs"><li><Link href="/" className="md-breadcrumb-link" aria-label="الرئيسية"><Icon name="home" className="h-3.5 w-3.5"/></Link></li>{crumbs.map((crumb,index)=><li key={crumb.href} className="flex min-w-0 items-center gap-1.5"><span className="text-slate-500" aria-hidden="true">/</span>{index===crumbs.length-1?<span className="truncate font-bold text-[var(--md-color-text)]" aria-current="page">{crumb.label}</span>:<Link href={crumb.href} className="md-breadcrumb-link truncate">{crumb.label}</Link>}</li>)}</ol></nav>}
 </div>;
}
