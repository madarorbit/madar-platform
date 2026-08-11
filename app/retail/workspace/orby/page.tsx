import type { Metadata } from "next";
import { PageHeader } from "@/components/retail-v0/layout/page-header";
import { OrbyChat } from "@/components/retail-v0/retail/orby-chat";
import { createClient } from "@/src/lib/retail/supabase/server";
import type { OrbyEvidence } from "@/src/lib/retail/orby/types";
import { localDate } from "@/src/lib/retail/server/analytics/queries";
import { requireWorkspace } from "@/src/lib/retail/server/auth/context";

export const metadata: Metadata = { title: "ORBY Retail" };

export default async function OrbyPage() {
  const { workspace, user } = await requireWorkspace();
  const supabase = await createClient();
  const { data: conversation } = await supabase.from("orby_conversations").select("id").eq("workspace_id", workspace.id).eq("created_by", user.id).is("archived_at", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const { data: history } = conversation ? await supabase.from("orby_messages").select("id,role,content,evidence").eq("workspace_id", workspace.id).eq("conversation_id", conversation.id).order("created_at").limit(40) : { data: [] };
  const messages = (history ?? []).map((message) => ({ id: message.id, role: message.role as "user" | "assistant", content: message.content, evidence: (message.evidence ?? []) as unknown as OrbyEvidence[] }));
  return <div className="content-grid"><PageHeader eyebrow="READ ONLY" title="ORBY Retail" description="التحليل يأتي من Analytics Engine الحتمي، وكل إجابة مالية تحمل أدلتها وفترتها." /><OrbyChat workspaceId={workspace.id} today={localDate(workspace.timezone)} initialConversationId={conversation?.id ?? null} initialMessages={messages} /></div>;
}
