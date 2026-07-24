import PageShell from '@/components/ui/PageShell';
import {Section,PageHero} from '@/components/ui/Section';
import {Card,Grid} from '@/components/ui/Enterprise';
import {Icon,type IconName} from '@/components/ui/Icons';
import Link from 'next/link';
import {requireUser} from '@/src/lib/auth';
import {currentProfile,supabaseFetch} from '@/src/lib/supabase/server';
import {logout} from '@/app/actions/auth';
export const dynamic='force-dynamic';

type AccountCard={href:string;label:string;description:string;icon:IconName;featured?:boolean};
export default async function AccountPage(){
 await requireUser();const profile=await currentProfile(),isAdmin=['ADMIN','SUPER_ADMIN'].includes(profile?.role||''),isFounder=profile?.role==='SUPER_ADMIN',unread=(await supabaseFetch('/rest/v1/notifications?read_at=is.null&select=id'))?.length||0;
 const memberships=await supabaseFetch(`/rest/v1/organization_members?user_id=eq.${encodeURIComponent(profile?.id||'')}&select=organizations(type,status)`),hasBusiness=memberships?.some((membership:{organizations?:{type?:string}})=>membership.organizations?.type!=='STUDENT');
 const cards:AccountCard[]=[
  {href:'/student',label:'مساحة الطالب الجامعية',description:'المكتبة والمهام والملاحظات ومساعد أوربي.',icon:'document',featured:true},
  {href:'/dashboard',label:'لوحة العميل',description:'الوصول إلى مساحة العمل وخطوات التشغيل.',icon:'home'},
  {href:'/account/profile',label:'الملف الشخصي',description:'الاسم والهاتف وصورة الحساب.',icon:'user'},
  {href:'/account/orders',label:'طلبات متجر مَدار',description:'متابعة الدفع والتنفيذ والتسليم.',icon:'store'},
  {href:'/account/purchases',label:'المكتبة الرقمية',description:'الملفات والمنتجات الرقمية المملوكة.',icon:'layers'},
  {href:'/account/notifications',label:`الإشعارات${unread>0?` — ${unread} غير مقروءة`:''}`,description:'التحديثات والتنبيهات المهمة.',icon:'megaphone'},
  {href:'/account/support',label:'الدعم والملاحظات',description:'إرسال بلاغ أو اقتراح ومتابعته.',icon:'help'},
  {href:'/account/privacy',label:'الخصوصية والبيانات',description:'تصدير البيانات وطلبات الحذف.',icon:'shield'},
 ];
 if(hasBusiness)cards.splice(2,0,{href:'/account/subscription',label:'الاشتراك والفوترة',description:'حالة الخطة والتجديد ووسيلة الدفع.',icon:'chart'});
 if(isAdmin)cards.unshift({href:'/admin',label:'لوحة إدارة المنصة',description:'العملاء والمتجر والمساحات والتشغيل.',icon:'automation',featured:true});
 if(isFounder)cards.unshift({href:'/admin/founder',label:'مركز قيادة المؤسس',description:'التحكم الأعلى المحمي في جميع أجزاء مَدار.',icon:'sparkles',featured:true});
 return <PageShell><PageHero eyebrow="حسابي" title={profile?.full_name||'حساب مَدار'} description="إدارة بياناتك وطلباتك ومساحاتك ودعم النسخة التجريبية من مركز مؤسسي واحد."/><Section><Grid className="sm:grid-cols-2 xl:grid-cols-3" auto={false}>{cards.map(card=><Link href={card.href} key={card.href}><Card interactive className={`flex h-full items-start gap-4 ${card.featured?'border-violet-300/20 bg-gradient-to-l from-violet-400/10 to-emerald-400/5':''}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${card.featured?'bg-violet-300/15 text-violet-100':'bg-white/[.05] text-emerald-200'}`}><Icon name={card.icon}/></span><span><strong className="block text-lg">{card.label}</strong><span className="mt-2 block text-sm leading-6 text-slate-400">{card.description}</span></span><Icon name="arrow" className="mr-auto mt-2 h-4 w-4 shrink-0 text-slate-600"/></Card></Link>)}</Grid><form action={logout} className="mt-8"><button className="md-button md-button-danger">تسجيل الخروج</button></form></Section></PageShell>;
}
