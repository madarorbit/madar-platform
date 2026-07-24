import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import {AuthForm} from '@/components/auth/AuthForm';
export const metadata={title:'استعادة الحساب | مَدار | ORBIT'};
export default function Page(){return <PageShell><PageHero eyebrow="حساب مَدار | ORBIT" title="نسيت كلمة المرور؟" description="سنرسل رابطًا آمنًا إن كان البريد مسجلًا."/><Section><AuthForm kind="forgot"/></Section></PageShell>}
