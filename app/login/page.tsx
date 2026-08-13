import PageShell from '@/components/ui/PageShell';
import { PageHero, Section } from '@/components/ui/Section';
import { AuthForm } from '@/components/auth/AuthForm';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { Notice, Panel } from '@/components/ui/Enterprise';
import { googleOAuthErrorMessage } from '@/src/lib/auth/google-oauth';

export const metadata = { title: 'تسجيل الدخول | مَدار | ORBIT' };

type SearchParams = { next?: string; registered?: string; error?: string };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const oauthError = googleOAuthErrorMessage(query.error);
  return (
    <PageShell>
      <PageHero
        eyebrow="حساب مَدار | ORBIT"
        title="تسجيل الدخول"
        description="ادخل إلى حسابك بأمان، وواصل من آخر صفحة كنت تعمل عليها."
      />
      <Section>
        <div className="mx-auto grid max-w-md gap-5">
          <Panel>
            <GoogleAuthButton next={query.next} />
            {oauthError ? (
              <div className="mt-4">
                <Notice title="تعذر تسجيل الدخول باستخدام Google" variant="danger">{oauthError}</Notice>
              </div>
            ) : null}
            <div className="md-auth-divider" aria-hidden="true">
              <span />
              <span>أو باستخدام البريد الإلكتروني</span>
              <span />
            </div>
            <p className="md-type-body-sm md-muted text-center">يبقى البريد الإلكتروني متاحًا كخيار ثانوي.</p>
          </Panel>
          <AuthForm
            kind="login"
            next={query.next}
            notice={query.registered === '1' ? 'تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.' : undefined}
          />
        </div>
      </Section>
    </PageShell>
  );
}
