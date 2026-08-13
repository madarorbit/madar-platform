import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import ServiceCards from "@/components/account/ServiceCards";
import { getAccountServices } from "@/src/lib/services/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "خدماتي | مَدار" };

export default async function AccountServicesPage() {
  const services = await getAccountServices();
  return (
    <AccountPage>
      <AccountPageHeader title="خدماتي" description="كل خدمة مستقلة بحالتها الفعلية وإجرائها الصحيح: تفعيل، دفع، مراجعة، فتح أو تجديد." />
      <ServiceCards services={services} />
    </AccountPage>
  );
}
