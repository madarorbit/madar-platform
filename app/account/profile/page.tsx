import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { getOptionalShellIdentity } from "@/src/lib/shell/server";
import ProfileForm from "./form";

export const dynamic = "force-dynamic";
export default async function Page() {
  const identity = await getOptionalShellIdentity();
  if (!identity) throw new Error("AUTH_REQUIRED");
  const profile = identity.profile;
  return (
    <AccountPage size="narrow">
      <AccountPageHeader title="الملف الشخصي" description="حدّث الاسم ورقم التواصل وصورة الحساب التي تظهر في جميع طبقات مَدار." />
      <ProfileForm
        fullName={profile?.full_name || ""}
        phone={profile?.phone || ""}
        hasAvatar={Boolean(profile?.avatar_url)}
      />
    </AccountPage>
  );
}
