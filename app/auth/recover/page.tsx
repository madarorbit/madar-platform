import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SessionRecoveryState from "@/components/auth/SessionRecoveryState";

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
  const jar = await cookies();
  if (!jar.get("madar-refresh-token")?.value) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  return <SessionRecoveryState nextPath={nextPath} />;
}
