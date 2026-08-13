import { currentProfile } from "@/src/lib/supabase/server";
import { requireUser } from "@/src/lib/auth";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import ProfileForm from "./form";

export const dynamic = "force-dynamic";
export default async function Page() {
  await requireUser();
  const profile = await currentProfile();
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
