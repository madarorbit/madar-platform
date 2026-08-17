import { redirect } from "next/navigation";
import SessionRecoveryState from "@/components/auth/SessionRecoveryState";
import { getShellIdentityState } from "@/src/lib/shell/server";

const safeReturnPath = (value: string | undefined) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/account";

export const dynamic = "force-dynamic";

export default async function AuthRecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeReturnPath(params.next);
  const state = await getShellIdentityState();

  if (state.status === "authenticated") redirect(nextPath);
  if (state.status === "unauthenticated") {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return <SessionRecoveryState nextPath={nextPath} />;
}
