import Link from 'next/link';
import ActivitySetupForm,{type ActivityQuestion} from '@/components/v2/ActivitySetupForm';
import {requireBusinessWorkspace} from '@/src/lib/business';
import {supabaseFetch} from '@/src/lib/supabase/server';
import {operatingModeLabels} from '@/src/lib/v2/account';

export const dynamic='force-dynamic';
export const metadata={title:'إعداد النشاط | مَدار'};

export default async function SetupPage(){
 const{workspace,sector}=await requireBusinessWorkspace(),id=encodeURIComponent(workspace.id);
 const profile=(await supabaseFetch(`/rest/v1/activity_profiles?organization_id=eq.${id}&status=eq.active&select=id,specialization_id&limit=1`))?.[0];
 const questions=profile?await supabaseFetch(`/rest/v1/activity_onboarding_questions?specialization_id=eq.${encodeURIComponent(profile.specialization_id)}&is_active=eq.true&select=key,label_ar,help_ar,field_type,options,condition,validation,is_required&order=sort_order`):[];
 const answers=profile?await supabaseFetch(`/rest/v1/activity_profile_answers?activity_profile_id=eq.${encodeURIComponent(profile.id)}&select=question_id,answer`):[];
 return <main className="mx-auto max-w-6xl p-5 py-10"><header><p className="font-bold text-emerald-300">MADAR Vertical Engine</p><h1 className="mt-2 text-4xl font-black">إعداد {sector.specializationName}</h1><p className="mt-3 max-w-3xl leading-8 text-slate-300">الحزمة القطاعية 2.0.0 مفعلة. نمط التشغيل: {operatingModeLabels[workspace.operating_mode]}، ومصدر الحقيقة: {workspace.source_of_truth==='MADAR'?'مَدار':'نظامك القائم'}.</p></header><section className="mt-8 grid gap-7 lg:grid-cols-[1fr_340px]"><ActivitySetupForm questions={(questions||[])as ActivityQuestion[]} currency={workspace.currency}/><aside className="md-panel h-fit"><h2 className="text-xl font-black">حالة التهيئة</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-slate-500">الحالة</dt><dd className="font-bold">{workspace.setup_status}</dd></div><div><dt className="text-slate-500">الوحدات المفعلة</dt><dd className="font-bold">{sector.enabledModules.length}</dd></div><div><dt className="text-slate-500">إجابات محفوظة</dt><dd className="font-bold">{answers?.length||0}</dd></div></dl>{workspace.operating_mode==='CONNECTED_EXTERNAL'?<Link href="/workspace/connect" className="md-button md-button-primary mt-6 w-full">الانتقال إلى مركز الربط</Link>:<Link href={sector.extension==='commerce'?'/workspace/procurement':sector.extension==='food_service'?'/workspace/restaurant':'/workspace/hotel'} className="md-button md-button-primary mt-6 w-full">بدء تشغيل النشاط</Link>}</aside></section></main>;
}
