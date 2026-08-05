import Image from "next/image";
import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import OrbyChat from "@/components/orby/OrbyChat";
import OrbyConversationSidebar from "@/components/orby/OrbyConversationSidebar";
import { confirmOrbyAction, createOrbyTaskDraft, dismissOrbyInsight, refreshOrbyInsights } from "@/app/actions/orby";
import { adenToday } from "@/src/lib/analytics";
import { requireBusinessWorkspace } from "@/src/lib/business";
import { supabaseFetch } from "@/src/lib/supabase/server";
import { siteConfig } from "@/src/config/site";
import { Icon } from "@/components/ui/Icons";
import { WorkspaceModule, WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";

export const dynamic = "force-dynamic";
export const metadata = { title: "أوربي | مَدار | ORBIT" };
const severityClasses: Record<string, string> = { critical: "border-red-300/25 bg-red-300/[.07]", warning: "border-amber-300/25 bg-amber-300/[.07]", info: "border-sky-300/20 bg-sky-300/[.06]" };
const priorityLabels: Record<string, string> = { low: "منخفضة", medium: "متوسطة", high: "عالية", urgent: "عاجلة" };
type Conversation = { id: string; title: string; last_message_at: string };
type OrbyMessage = { id: string; role: "user" | "assistant"; content: string; source: "ai" | "smart-fallback"; created_at: string };
type Insight = { id: string; severity: string; title: string; body: string; action_path: string | null; generated_at: string };
type Draft = { id: string; payload: { title: string; description?: string | null; priority: string; due_at?: string | null }; created_at: string };

export default async function OrbyPage({ searchParams }: { searchParams: Promise<{ conversation?: string; success?: string; error?: string }> }) {
  const { workspace, user } = await requireBusinessWorkspace();
  const params = await searchParams;
  const org = encodeURIComponent(workspace.id), uid = encodeURIComponent(user.id);
  const [conversations, insights, usage, drafts] = await Promise.all([
    supabaseFetch(`/rest/v1/orby_conversations?organization_id=eq.${org}&user_id=eq.${uid}&status=eq.active&select=id,title,last_message_at&order=last_message_at.desc&limit=100`).catch(() => []),
    supabaseFetch(`/rest/v1/orby_insights?organization_id=eq.${org}&status=eq.active&select=id,severity,title,body,action_path,generated_at&order=severity.asc,generated_at.desc`).catch(() => []),
    supabaseFetch(`/rest/v1/orby_usage_daily?organization_id=eq.${org}&user_id=eq.${uid}&usage_date=eq.${adenToday()}&select=requests&limit=1`).catch(() => []),
    supabaseFetch(`/rest/v1/orby_action_drafts?organization_id=eq.${org}&user_id=eq.${uid}&status=eq.draft&select=id,payload,created_at&order=created_at.desc&limit=20`).catch(() => []),
  ]);
  const available = conversations as Conversation[];
  const requested = params.conversation;
  const selected = available.find((item) => item.id === requested) || available[0] || null;
  const messages: OrbyMessage[] = selected ? await supabaseFetch(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(selected.id)}&organization_id=eq.${org}&user_id=eq.${uid}&select=id,role,content,source,created_at&order=created_at.asc&limit=100`).catch(() => []) : [];
  const remaining = Math.max(0, 20 - Number(usage?.[0]?.requests || 0));

  return <WorkspaceModule className="max-w-none px-3 sm:px-4">
    <WorkspaceModuleHeader eyebrow="ORBY Business Copilot" title="أوربي" description="محادثة أعمال مرتبطة ببيانات المساحة، مع التنبيهات والمصادر ومسودات التنفيذ في السياق نفسه." icon="sparkles" actions={<form action={refreshOrbyInsights}><button className="md-button md-button-secondary md-button-sm"><Icon name="sparkles" />تحديث التنبيهات الذكية</button></form>} tabs={[
      { label: "المحادثة", href: "/workspace/orby", active: true }, { label: "التحليلات", href: "/workspace/analytics" }, { label: "المهام", href: "/workspace/tasks" },
    ]} />
    <ActionFeedback success={params.success} error={params.error} />
    <div className="mt-3 grid min-h-[calc(100vh-10rem)] gap-3 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <div className="min-w-0"><OrbyConversationSidebar organizationId={workspace.id} conversations={available} selectedId={requested === "new" ? null : selected?.id || null} /></div>
      <div className="min-w-0"><OrbyChat key={selected?.id || "new"} organizationId={workspace.id} initialConversationId={requested === "new" ? null : selected?.id || null} initialMessages={requested === "new" ? [] : messages} initialRemaining={remaining} /></div>
      <aside className="grid content-start gap-3">
        <section className="md-panel p-4"><div className="flex items-center gap-3"><Image src={siteConfig.assets.orby} alt="أوربي" width={46} height={46} unoptimized className="h-11 w-11 rounded-xl object-cover" /><div><strong className="text-sm">سياق العمل</strong><p className="text-xs text-slate-500">المساحة: {workspace.name}</p></div></div><div className="mt-3 grid gap-2 text-xs"><span className="md-badge">المصدر: {workspace.source_of_truth === "EXTERNAL" ? "النظام المرتبط" : "بيانات مَدار"}</span><span className="md-badge">متبقي اليوم: {remaining}</span></div></section>
        <section className="md-panel p-4"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-black">التنبيهات والفرص</h2><p className="mt-1 text-[11px] text-slate-500">تنبيهات أوربي الاستباقية للمخاطر والفرص تظل بجانب المحادثة.</p></div><span className="md-badge">{insights.length}</span></div><div className="mt-3 grid max-h-80 gap-2 overflow-y-auto">{insights.length ? (insights as Insight[]).map((insight) => <article key={insight.id} className={`rounded-xl border p-3 ${severityClasses[insight.severity] || severityClasses.info}`}><h3 className="text-xs font-black">{insight.title}</h3><p className="mt-1 text-xs leading-6 text-slate-300">{insight.body}</p><div className="mt-2 flex gap-2">{insight.action_path && <Link href={insight.action_path} className="md-button md-button-secondary md-button-sm">فتح</Link>}<form action={dismissOrbyInsight}><input type="hidden" name="insight_id" value={insight.id} /><button className="md-button md-button-ghost md-button-sm">إخفاء</button></form></div></article>) : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">لا توجد تنبيهات نشطة.</p>}</div></section>
        <section className="md-panel p-4"><h2 className="text-sm font-black">إجراء بموافقتك</h2><p className="mt-1 text-[11px] leading-5 text-slate-500">ينشئ أوربي مسودة فقط. لن تظهر المهمة في مساحة العمل إلا بعد تأكيدك.</p><form action={createOrbyTaskDraft} className="mt-3 grid gap-2"><input name="title" required maxLength={220} className="field" placeholder="عنوان المهمة" /><textarea name="description" maxLength={2000} rows={2} className="field" placeholder="تفاصيل اختيارية" /><div className="grid grid-cols-2 gap-2"><select name="priority" defaultValue="medium" className="field"><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="urgent">عاجلة</option></select><input name="due_at" type="datetime-local" className="field" /></div><button className="md-button md-button-primary md-button-sm">إنشاء مسودة</button></form><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">{drafts.length ? (drafts as Draft[]).map((draft) => <article key={draft.id} className="rounded-xl border border-white/10 p-3"><strong className="text-xs">{draft.payload.title}</strong><p className="mt-1 text-[11px] text-slate-500">{priorityLabels[draft.payload.priority] || draft.payload.priority}</p><form action={confirmOrbyAction} className="mt-2"><input type="hidden" name="draft_id" value={draft.id} /><button className="md-button md-button-secondary md-button-sm">تأكيد التنفيذ</button></form></article>) : <p className="text-center text-xs text-slate-500">لا توجد مسودات.</p>}</div></section>
      </aside>
    </div>
  </WorkspaceModule>;
}
