import { redirect } from "next/navigation";

export default function LegacySubscriptionRedirect() {
  redirect("/account/subscriptions");
}
