import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import {AuthForm} from '@/components/auth/AuthForm';
export const metadata={title:'تسجيل الدخول | مَدار | ORBIT'};
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;registered?:string}>}){const q=await searchParams;return <PageShell><PageHero eyebrow="حساب مَدار | ORBIT" title="تسجيل الدخول" description="ادخل إلى حسابك بأمان، وواصل من آخر صفحة كنت تعمل عليها."/><Section><AuthForm kind="login" next={q.next} notice={q.registered==='1'?'تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.':undefined}/></Section></PageShell>}
