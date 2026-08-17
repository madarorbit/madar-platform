import { ConnectedDecisionOverview } from "@/components/connected/ConnectedDecisionOverview";
import { NativeDecisionOverview } from "@/components/native/NativeDecisionOverview";
import { requireBusinessWorkspace } from "@/src/lib/business";

export const dynamic = "force-dynamic";
export const metadata = { title: "نظرة عامة | مساحة مَدار" };

export default async function WorkspaceHome({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const [context, params] = await Promise.all([requireBusinessWorkspace(), searchParams]);
  return context.workspace.operating_mode === "CONNECTED_EXTERNAL"
    ? <ConnectedDecisionOverview workspace={context.workspace} sector={context.sector} />
    : <NativeDecisionOverview
        workspace={context.workspace}
        sector={context.sector}
        moduleUnavailable={params.module === "unavailable"}
      />;
}
