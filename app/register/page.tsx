import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import {AuthForm} from '@/components/auth/AuthForm';
export const metadata={title:'إنشاء حساب | مَدار | ORBIT'};
export default function Page(){return <PageShell><PageHero eyebrow="حساب مَدار | ORBIT" title="إنشاء حساب" description="أنشئ حسابك ثم أكد بريدك الإلكتروني للبدء."/><Section><AuthForm kind="register"/></Section></PageShell>}
