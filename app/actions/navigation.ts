"use server";

import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";

export async function saveWorkspaceNavigationState(compact: boolean) {
  const { workspace } = await requireBusinessWorkspace();
  await supabaseFetch("/rest/v1/rpc/save_workspace_navigation", {
    method: "POST",
    body: JSON.stringify({
      target_organization: workspace.id,
      compact: Boolean(compact),
    }),
  });
}
