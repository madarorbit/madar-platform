import type { ReactNode } from "react";
import AccountShell from "@/components/account/AccountShell";
import GuidedLearningBoundary from "@/components/guided-learning/GuidedLearningBoundary";
import {
  getShellServiceOptions,
  requireShellIdentity,
} from "@/src/lib/shell/server";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const identity = await requireShellIdentity("/account");
  const serviceOptions = await getShellServiceOptions();
  return (
    <GuidedLearningBoundary accountId={identity.userId}>
      <AccountShell identity={identity.shell} serviceOptions={serviceOptions}>
        {children}
      </AccountShell>
    </GuidedLearningBoundary>
  );
}
