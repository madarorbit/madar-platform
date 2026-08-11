import { redirect } from "next/navigation";

export default function LegacyAccountSetupRedirect() {
  redirect("/account");
}
