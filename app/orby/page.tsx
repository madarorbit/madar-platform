import type { Metadata } from "next";
import OrbyShell from "@/components/orby/OrbyShell";
import OrbyChat from "@/components/orby/OrbyChat";
import OrbyConversationSidebar from "@/components/orby/OrbyConversationSidebar";
import {
  getOptionalShellIdentity,
  getShellServiceOptions,
} from "@/src/lib/shell/server";
import { supabaseFetch } from "@/src/lib/supabase/server";
import type { ShellContextDefinition } from "@/src/lib/ux/shell";
import { isServiceCode } from "@/src/lib/services/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "ORBY | مَدار",
  description: "تحدث مع ORBY، المساعد الذكي لمنصة مَدار.",
};

type Conversation = {
  id: string;
  title: string;
  last_message_at: string;
  organization_id: string | null;
  service_code: string | null;
};
type Message = { id: string; role: "user" | "assistant"; content: string; source?: string };
type Usage = { tier: "registered" | "customer" | "plus"; daily_limit: number; used: number; remaining: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function OrbyPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string; organization?: string; service?: string; starter?: string }>;
}) {
  const params = await searchParams;
  const identity = await getOptionalShellIdentity();
  if (!identity) {
    const guestKey = `guest:${params.starter || "chat"}`;
    return (
      <OrbyShell
        authenticated={false}
        plus={false}
        newChatHref="/orby"
        contextLabel="محادثة عامة"
        returnHref="/"
      >
        <OrbyChat
          key={guestKey}
          authenticated={false}
          organizationId={null}
          serviceCode={null}
          initialConversationId={null}
          initialMessages={[]}
          initialRemaining={5}
          initialLimit={5}
          tier="guest"
          starter={params.starter}
        />
      </OrbyShell>
    );
  }

  const user = identity.user;
  const [conversationRows, serviceOptions, usageRaw] = await Promise.all([
    supabaseFetch(
      `/rest/v1/orby_conversations?user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&select=id,title,last_message_at,organization_id,service_code&order=last_message_at.desc&limit=100`,
    ).catch(() => []),
    getShellServiceOptions(),
    supabaseFetch("/rest/v1/rpc/orby_usage_status", { method: "POST", body: "{}" }).catch(
      () => ({ tier: "registered", daily_limit: 5, used: 0, remaining: 5 }),
    ),
  ]);
  const conversations = (conversationRows || []) as Conversation[];
  const usage = (Array.isArray(usageRaw) ? usageRaw[0] : usageRaw) as Usage;
  const scopes = serviceOptions.map((item) => ({
    organizationId: item.organizationId,
    serviceCode: item.serviceCode,
    name: item.workspaceName,
  }));
  const requestedConversation = params.conversation && uuid.test(params.conversation)
    ? params.conversation
    : null;
  const selected = conversations.find((item) => item.id === requestedConversation) || null;
  const requestedOrganization = params.organization && uuid.test(params.organization)
    ? params.organization
    : null;
  const requestedService = params.service && isServiceCode(params.service.toUpperCase())
    ? params.service.toUpperCase()
    : null;
  const scopeFromQuery = scopes.find((item) =>
    item.organizationId === requestedOrganization && (!requestedService || item.serviceCode === requestedService),
  ) || null;
  const candidateOrganizationId = selected?.organization_id || scopeFromQuery?.organizationId || null;
  const candidateServiceCode = selected?.service_code || scopeFromQuery?.serviceCode || null;
  const activeOption = serviceOptions.find((item) =>
    item.organizationId === candidateOrganizationId && (!candidateServiceCode || item.serviceCode === candidateServiceCode),
  );
  const selectedOrganizationId = activeOption?.organizationId || null;
  const selectedServiceCode = activeOption?.serviceCode || null;
  let messages: Message[] = [];
  if (selected) {
    messages = (await supabaseFetch(
      `/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(selected.id)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,role,content,source&role=in.(user,assistant)&order=created_at.asc,id.asc`,
    ).catch(() => [])) as Message[];
  }
  const newChatHref = selectedOrganizationId
    ? `/orby?conversation=new&organization=${encodeURIComponent(selectedOrganizationId)}&service=${encodeURIComponent(selectedServiceCode || "")}`
    : "/orby?conversation=new";
  const contextLabel = activeOption
    ? `${activeOption.workspaceName} · ${activeOption.serviceName}`
    : "محادثة عامة";
  const returnHref = activeOption?.kind === "retail"
    ? "/retail/workspace"
    : activeOption
      ? "/workspace"
      : "/account";
  const shellContext: ShellContextDefinition = activeOption
    ? {
        kind: activeOption.kind === "retail" ? "retail" : "workspace",
        name: activeOption.workspaceName,
        detail: activeOption.serviceName,
        homeHref: returnHref,
        currentOrganizationId: activeOption.organizationId,
        options: serviceOptions,
      }
    : {
        kind: "account",
        name: identity.shell.displayName,
        detail: "حساب مَدار",
        homeHref: "/account",
        options: serviceOptions,
      };
  const sidebar = (
    <OrbyConversationSidebar
      conversations={conversations}
      selectedId={selected?.id || null}
      scopes={scopes}
      selectedOrganizationId={selectedOrganizationId}
      selectedServiceCode={selectedServiceCode}
      tier={usage.tier}
    />
  );
  const chatKey = [selected?.id || "new", selectedOrganizationId || "general", params.starter || "chat"].join(":");
  return (
    <OrbyShell
      authenticated
      plus={usage.tier === "plus"}
      newChatHref={newChatHref}
      sidebar={sidebar}
      contextLabel={contextLabel}
      returnHref={returnHref}
      identity={identity.shell}
      shellContext={shellContext}
    >
      <OrbyChat
        key={chatKey}
        authenticated
        organizationId={selectedOrganizationId}
        serviceCode={selectedServiceCode}
        initialConversationId={selected?.id || null}
        initialMessages={messages}
        initialRemaining={Number(usage.remaining ?? 5)}
        initialLimit={Number(usage.daily_limit ?? 5)}
        tier={usage.tier || "registered"}
        starter={params.starter}
      />
    </OrbyShell>
  );
}
