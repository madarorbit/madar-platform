"use client";

import { FormEvent, useState } from "react";
import type { OrbyEvidence } from "@/src/lib/retail/orby/types";

interface HistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence: OrbyEvidence[];
}

const PROMPTS = [
  "كيف كانت مبيعات اليوم؟", "ما المنتجات التي ستنفد؟",
  "من أكثر عميل عليه دين؟", "كم عليّ للموردين؟",
];

export function OrbyChat({
  workspaceId,
  today,
  initialConversationId,
  initialMessages,
}: {
  workspaceId: string;
  today: string;
  initialConversationId: string | null;
  initialMessages: HistoryMessage[];
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = question.trim();
    if (!clean || loading) return;
    const userMessage: HistoryMessage = { id: crypto.randomUUID(), role: "user", content: clean, evidence: [] };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", evidence: [] }]);
    setQuestion("");
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/retail/orby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: workspaceId, conversation_id: conversationId, question: clean, date_from: today, date_to: today }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "ORBY_UNAVAILABLE");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          const eventName = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
          const dataLine = block.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
          if (!dataLine) continue;
          const data = JSON.parse(dataLine) as { text?: string; conversation_id?: string; evidence?: OrbyEvidence[] };
          if (eventName === "meta") {
            if (data.conversation_id) setConversationId(data.conversation_id);
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, evidence: data.evidence ?? [] } : message));
          }
          if (eventName === "token" && data.text) {
            setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: message.content + data.text } : message));
          }
        }
      }
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "ORBY_UNAVAILABLE";
      setError(code === "ORBY_DAILY_LIMIT_REACHED" ? "وصلت إلى حد ORBY اليومي في خطتك." : "تعذر الوصول إلى ORBY الآن. لم تتغير أي بيانات في تجارتك.");
      setMessages((current) => current.filter((message) => message.id !== assistantId));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="surface flex min-h-[65vh] flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {!messages.length ? <div className="grid min-h-72 place-items-center text-center"><div><p className="text-mint text-3xl font-black">ORBY</p><h2 className="mt-3 text-2xl font-black">اسأل تجارتك</h2><p className="muted mx-auto mt-2 max-w-md">أقرأ التحليلات والسجلات المصرح بها فقط. لا أنشئ فواتير ولا أغيّر المخزون أو الأرصدة.</p></div></div> : null}
          {messages.map((message) => <article key={message.id} className={`max-w-3xl rounded-2xl p-4 ${message.role === "user" ? "mr-auto bg-violet-500/15" : "ml-auto border border-emerald-300/15 bg-emerald-300/5"}`}><p className="whitespace-pre-wrap leading-7">{message.content || "جارٍ التحليل…"}</p>{message.evidence.length ? <details className="mt-3"><summary className="text-mint cursor-pointer text-xs font-bold">مصادر هذه الإجابة ({message.evidence.length})</summary><div className="mt-2 grid gap-2">{message.evidence.map((item) => <div className="rounded-lg border border-slate-700 p-2 text-xs" key={item.id}><strong>{item.label}</strong><span className="muted mr-2">{String(item.value)} {item.unit ?? ""}</span><span className="block text-slate-500">{item.source} · {item.period?.from} → {item.period?.to}</span></div>)}</div></details> : null}</article>)}
        </div>
        <form onSubmit={ask} className="border-t border-slate-800 p-3 sm:p-4"><div className="flex gap-2"><label className="sr-only" htmlFor="orby-question">سؤالك إلى ORBY</label><input id="orby-question" className="input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="مثال: كيف كانت مبيعات اليوم؟" maxLength={1000} disabled={loading} /><button className="button-primary" type="submit" disabled={loading || question.trim().length < 2}>{loading ? "يفكر…" : "اسأل"}</button></div>{error ? <p className="mt-2 text-sm text-red-300" role="alert">{error}</p> : null}</form>
      </section>
      <aside className="surface h-fit p-5"><h2 className="font-black">أسئلة سريعة</h2><div className="mt-3 grid gap-2">{PROMPTS.map((prompt) => <button type="button" className="button-secondary justify-start text-right text-sm" onClick={() => setQuestion(prompt)} key={prompt}>{prompt}</button>)}</div><div className="mt-5 border-t border-slate-800 pt-4 text-xs leading-6 text-slate-500"><strong className="text-slate-300">حاجز V0</strong><p>ORBY للقراءة فقط. أي طلب تعديل يُرفض ويوجهك إلى القسم المناسب.</p></div></aside>
    </div>
  );
}
