import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import RegisterWizard from '@/components/auth/RegisterWizard';
import {supabaseFetch} from '@/src/lib/supabase/server';
export const metadata={title:'إنشاء حساب | مَدار | ORBIT'};
export const dynamic='force-dynamic';
export default async function Page(){const rows=await supabaseFetch('/rest/v1/activity_specializations?status=eq.approved&is_visible=eq.true&launch_enabled=eq.true&select=code,name_ar&order=sort_order').catch(()=>[]);return <PageShell><PageHero eyebrow="حساب مَدار | ORBIT" title="أنشئ تجربتك المناسبة من البداية" description="الحساب الشخصي يفتح مساحة الطالب، والحساب التجاري يفتح مساحة عمل مهيأة لنشاطك مع تجربة مجانية لمدة 20 يومًا."/><Section><RegisterWizard specializations={rows.map((item:{code:string;name_ar:string})=>({code:item.code,nameAr:item.name_ar}))}/></Section></PageShell>}
