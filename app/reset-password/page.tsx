import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import ResetForm from './form';
export const metadata={title:'تعيين كلمة مرور | مَدار | ORBIT'};
export default function Page(){return <PageShell><PageHero eyebrow="حساب مَدار | ORBIT" title="تعيين كلمة مرور جديدة" description="أدخل كلمة مرور آمنة لإتمام الاستعادة."/><Section><ResetForm/></Section></PageShell>}
