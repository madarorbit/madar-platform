import PageShell from '@/components/ui/PageShell';
import { PageHero, Section } from '@/components/ui/Section';
import RegisterWizard from '@/components/auth/RegisterWizard';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { Panel } from '@/components/ui/Enterprise';

export const metadata = { title: 'إنشاء حساب | مَدار | ORBIT' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  return (
    <PageShell>
      <PageHero
        eyebrow="حساب مَدار | ORBIT"
        title="حساب واحد لكل خدمات مَدار"
        description="سجّل بالبريد أو Google، ثم اختر الخدمات التي تحتاجها من حسابك. لا مساحة ولا اشتراك قبل اختيارك وموافقة الإدارة."
      />
      <Section>
        <div className="mx-auto grid max-w-3xl gap-6">
          <Panel className="mx-auto w-full max-w-md">
            <GoogleAuthButton next="/account" />
            <div className="md-auth-divider" aria-hidden="true">
              <span />
              <span>أو إنشاء الحساب بالبريد الإلكتروني</span>
              <span />
            </div>
            <p className="md-type-body-sm md-muted text-center">لن يُطلب منك تعيين كلمة مرور عند المتابعة باستخدام Google.</p>
          </Panel>
          <RegisterWizard />
        </div>
      </Section>
    </PageShell>
  );
}
