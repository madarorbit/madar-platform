import {redirect} from 'next/navigation';
import ExistingAccountWizard from '@/components/auth/ExistingAccountWizard';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';
import type {AccountType,OperatingMode,PlanLevel,PlanTerm,SupportedCurrency} from '@/src/lib/v2/account';

export const dynamic='force-dynamic';
export const metadata={title:'تخصيص الحساب | مَدار | ORBIT'};

type Organization={id:string;name:string;type:string;operating_mode?:OperatingMode;currency?:SupportedCurrency};
type Membership={role:string;organizations:Organization|Organization[]|null};
const organizationOf=(value:Membership['organizations'])=>Array.isArray(value)?value[0]:value;

export default async function Page(){
 const user=await currentUser();if(!user)redirect('/login?next=/account/setup');
 const profile=(await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,role,account_type,reonboarding_required&limit=1`))?.[0] as {role:string;account_type?:AccountType;reonboarding_required?:boolean}|undefined;
 if(!profile||profile.role==='SUPER_ADMIN'||!profile.reonboarding_required)redirect('/account');
 const memberships=(await supabaseFetch(`/rest/v1/organization_members?user_id=eq.${encodeURIComponent(user.id)}&select=role,organizations(id,name,type,operating_mode,currency)`)) as Membership[];
 const commercial=memberships.map(item=>organizationOf(item.organizations)).find(org=>org&&org.type!=='STUDENT')||null;
 const student=memberships.map(item=>organizationOf(item.organizations)).find(org=>org?.type==='STUDENT')||null;
 const lockedAccountType:AccountType|null=commercial?'BUSINESS':student?'PERSONAL':null;
 const specializations=await supabaseFetch('/rest/v1/activity_specializations?status=eq.approved&is_visible=eq.true&launch_enabled=eq.true&select=code,name_ar&order=sort_order');
 return <main className="min-h-screen px-4 py-12 sm:px-6"><ExistingAccountWizard
  specializations={(specializations||[]).map((item:{code:string;name_ar:string})=>({code:item.code,nameAr:item.name_ar}))}
  lockedAccountType={lockedAccountType}
  initialAccountType={lockedAccountType||profile.account_type||'PERSONAL'}
  initialBusinessName={commercial?.name||''}
  initialMode={(commercial?.operating_mode||'MADAR_NATIVE') as OperatingMode}
  initialLevel={'BASIC' as PlanLevel}
  initialTerm={1 as PlanTerm}
  initialCurrency={(commercial?.currency||'SAR') as SupportedCurrency}
 /></main>;
}
