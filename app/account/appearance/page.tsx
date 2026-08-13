import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import ThemePreferences from "@/components/theme/ThemePreferences";

export const metadata = { title: "المظهر واللغة | حساب مَدار" };

export default function AppearancePage() {
  return (
    <AccountPage size="narrow">
      <AccountPageHeader title="المظهر واللغة" description="اختيار صغير في إعدادات الحساب، محفوظ على هذا المتصفح ويعمل قبل ظهور الصفحة لتجنب الوميض." />
      <section className="md-account-section"><h2>مظهر المنصة</h2><p className="mt-2 text-sm leading-7 text-slate-400">اختر فاتحًا أو داكنًا، أو اترك مَدار تتبع إعداد النظام.</p><ThemePreferences /></section>
      <section className="md-account-section mt-5"><h2>اللغة والاتجاه</h2><p className="mt-2 text-sm leading-7 text-slate-400">العربية واتجاه RTL هما الأساس الحالي. النصوص الإنجليزية والأكواد والعملات تبقى باتجاهها الصحيح داخل الحقول والجداول.</p><button disabled className="md-button md-button-secondary mt-4">العربية · RTL</button></section>
    </AccountPage>
  );
}
