import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AccountShell from "@/components/account/AccountShell";
import {
  getOptionalShellIdentity,
  getShellServiceOptions,
} from "@/src/lib/shell/server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const [identity, serviceOptions] = await Promise.all([
    getOptionalShellIdentity(),
    getShellServiceOptions(),
  ]);
  if (!identity) redirect("/login?next=/account");
  return (
    <AccountShell identity={identity.shell} serviceOptions={serviceOptions}>
      {children}
    </AccountShell>
  );
}
