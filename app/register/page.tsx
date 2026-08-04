import PageShell from '@/components/ui/PageShell';
import { PageHero, Section } from '@/components/ui/Section';
import RegisterWizard from '@/components/auth/RegisterWizard';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { Panel } from '@/components/ui/Enterprise';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const metadata = { title: 'إنشاء حساب | مَدار | ORBIT' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const rows = await supabaseFetch('/rest/v1/activity_specializations?status=eq.approved&is_visible=eq.true&launch_enabled=eq.true&select=code,name_ar&order=sort_order').catch(() => []);
  return (
    <PageShell>
      <PageHero
        eyebrow="حساب مَدار | ORBIT"
        title="أنشئ تجربتك المناسبة من البداية"
        description="ابدأ مباشرة باستخدام Google، ثم اختر نوع حسابك وإعدادات مساحة العمل عند الدخول الأول فقط."
      />
      <Section>
        <div className="mx-auto grid max-w-3xl gap-6">
          <Panel className="mx-auto w-full max-w-md">
            <GoogleAuthButton next="/account" />
            <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-500" aria-hidden="true">
              <span className="h-px flex-1 bg-white/10" />
              <span>أو إنشاء الحساب بالبريد الإلكتروني</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <p className="text-center text-sm leading-6 text-slate-400">لن يُطلب منك تعيين كلمة مرور عند المتابعة باستخدام Google.</p>
          </Panel>
          <RegisterWizard specializations={rows.map((item: { code: string; name_ar: string }) => ({ code: item.code, nameAr: item.name_ar }))} />
        </div>
      </Section>
    </PageShell>
  );
}
