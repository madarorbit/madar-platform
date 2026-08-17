import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Badge } from "@/components/ui/Enterprise";
import { requireUser } from "@/src/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "الحساب والأمان | مَدار" };

export default async function SecurityPage() {
  const user = await requireUser("/account/security");
  const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email";
  return (
    <AccountPage size="narrow">
      <AccountPageHeader title="الحساب والأمان" description="البريد وطريقة الدخول وإدارة الجلسة، دون خلطها ببيانات الملف الشخصي أو إعدادات الخدمات." />
      <section className="md-account-section">
        <div className="md-security-row"><div><span>البريد الإلكتروني</span><strong dir="ltr">{user.email || "—"}</strong></div><Badge variant={user.email_confirmed_at ? "success" : "warning"}>{user.email_confirmed_at ? "موثّق" : "بانتظار التحقق"}</Badge></div>
        <div className="md-security-row"><div><span>طريقة الدخول</span><strong>{provider === "google" ? "المتابعة باستخدام Google" : "البريد وكلمة المرور"}</strong></div></div>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/forgot-password" className="md-button md-button-secondary">تغيير كلمة المرور</Link><form action={logout}><button className="md-button md-button-danger">تسجيل الخروج</button></form></div>
      </section>
    </AccountPage>
  );
}
