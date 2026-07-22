import {redirect} from 'next/navigation';
import {requireUser} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import BusinessForm from './form';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await requireUser();
 const rows=await supabaseFetch(`/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,slug,type,description,whatsapp,website,country,city)`);
 const membership=rows?.find((x:{organizations?:{type?:string}})=>x.organizations?.type!=='STUDENT');
 if(!membership?.organizations)redirect('/onboarding');
 return <main className="mx-auto max-w-xl p-6"><a className="text-[#00C292]" href="/account/business/members">إدارة الأعضاء</a><h1 className="text-3xl font-bold">إعدادات التجارة</h1><p className="mt-2 text-slate-300">يستطيع المالك فقط تعديل هذه البيانات.</p><BusinessForm workspace={membership.organizations} owner={membership.role==='OWNER'}/></main>;
}
