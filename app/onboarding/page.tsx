import Link from 'next/link';
import {redirect} from 'next/navigation';
import {requireUser} from '@/src/lib/auth';
import {currentProfile,supabaseFetch} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';
export default async function Page(){
 const user=await requireUser(),profile=await currentProfile();if(profile?.account_type==='PERSONAL')redirect('/student');
 const memberships=await supabaseFetch(`/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=organizations(type)`);if(memberships?.some((item:{organizations?:{type?:string}})=>item.organizations?.type!=='STUDENT'))redirect('/workspace');
 return <main className="mx-auto max-w-2xl p-6 py-16"><p className="font-bold text-amber-300">استعادة تهيئة الحساب</p><h1 className="mt-3 text-4xl font-black">حساب الأعمال لا يملك مساحة مرتبطة</h1><p className="mt-5 leading-8 text-slate-300">لا تسمح مَدار V2 بإنشاء مسار آخر أو مساحة طالب من هذا الحساب. يفترض أن تُنشأ مساحة العمل والحزمة والاشتراك التجريبي تلقائيًا عند التسجيل؛ لذلك يلزم إصلاح التهيئة الحالية مع الحفاظ على هوية الحساب.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/contact" className="md-button md-button-primary">طلب استعادة التهيئة</Link><Link href="/account" className="md-button md-button-secondary">العودة للحساب</Link></div></main>;
}
