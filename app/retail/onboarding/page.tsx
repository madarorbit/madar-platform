import { redirect } from "next/navigation";

export default function RetailOnboardingRedirect() {
  redirect("/account/services/MADAR_RETAIL/setup");
}
