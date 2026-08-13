import type { ReactNode } from "react";
import MadarGlobalShell from "@/components/shell/MadarGlobalShell";
import {
  accountMobileNavigation,
  accountNavigationGroups,
} from "@/src/lib/ux/platform-navigation";
import type { ShellIdentity, ShellServiceOption } from "@/src/lib/ux/shell";

/** Account adapter for the canonical MADAR Global Shell. */
export default function AccountShell({
  children,
  identity,
  serviceOptions,
}: {
  children: ReactNode;
  identity: ShellIdentity;
  serviceOptions: ShellServiceOption[];
}) {
  return (
    <MadarGlobalShell
      identity={identity}
      context={{
        kind: "account",
        name: identity.displayName,
        detail: "حساب مَدار",
        meta: identity.email,
        homeHref: "/account",
        options: serviceOptions,
      }}
      navigationGroups={accountNavigationGroups}
      mobileItems={accountMobileNavigation}
      orbyHref="/orby"
      footerNote="حساب واحد · خدمات مستقلة · ORBY موحّد"
    >
      {children}
    </MadarGlobalShell>
  );
}
