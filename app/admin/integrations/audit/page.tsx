import Link from 'next/link';
import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';
export const metadata={title:'مركز تدقيق التكاملات | مَدار'};

type AuditEvent={id:string;organization_id:string;connection_id:string|null;actor_id:string|null;event_type:string;entity_type:string|null;entity_id:string|null;severity:string;metadata:Record<string,unknown>;occurred_at:string};
type QualityHistory={id:string;severity:string;category:string;rule_key:string;status:string;resolution_note:string|null;resolved_by:string|null;resolved_at:string|null;created_at:string};

const date=(value:string|null)=>value?new Date(value).toLocaleString('ar-EG'):'—';
const severityClass=(value:string)=>['error','critical'].includes(value)?'bg-rose-300/10 text-rose-200':value==='warning'?'bg-amber-300/10 text-amber-200':'bg-emerald-300/10 text-emerald-200';

export default async function IntegrationAuditPage(){
 await requireSuperAdmin();
 const [eventsRaw,qualityRaw]=await Promise.all([
  supabaseFetch('/rest/v1/integration_audit_events?select=id,organization_id,connection_id,actor_id,event_type,entity_type,entity_id,severity,metadata,occurred_at&order=occurred_at.desc&limit=150'),
  supabaseFetch('/rest/v1/integration_quality_issues?status=in.(resolved,ignored)&select=id,severity,category,rule_key,status,resolution_note,resolved_by,resolved_at,created_at&order=resolved_at.desc.nullslast&limit=80'),
 ]),events=(eventsRaw||[]) as AuditEvent[],quality=(qualityRaw||[]) as QualityHistory[];
 return <main className="mx-auto max-w-[1450px] p-5 py-8 sm:p-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold text-violet-200">Integration Audit Center</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">مركز تدقيق التكاملات والبيانات</h1><p className="mt-3 max-w-3xl leading-8 text-slate-400">سجل غير قابل للتحرير لنتائج المزامنة وخط الجودة، مع توثيق قرارات معالجة مشكلات البيانات. لا تُحفظ الأسرار أو محتويات المصادقة داخل هذا السجل.</p></div><Link href="/admin/integrations" className="md-button md-button-secondary">العودة إلى مركز الاتصالات</Link></div>
 <section className="mt-8 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="rounded-3xl border border-white/10 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">الأحداث التشغيلية</h2><span className="md-badge">{events.length.toLocaleString('ar-EG')} حدث</span></div><div className="mt-5 space-y-3">{events.map(event=><article key={event.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClass(event.severity)}`}>{event.severity}</span><strong className="font-mono text-sm text-violet-100">{event.event_type}</strong></div><span className="text-xs text-slate-500">{date(event.occurred_at)}</span></div><div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-3"><span>المؤسسة: {event.organization_id.slice(0,8)}</span><span>الاتصال: {event.connection_id?.slice(0,8)||'—'}</span><span>الكيان: {event.entity_type||'—'}</span></div><pre className="mt-3 max-h-44 overflow-auto rounded-xl bg-black/20 p-3 text-left text-[11px] leading-5 text-slate-400" dir="ltr">{JSON.stringify(event.metadata,null,2)}</pre></article>)}{!events.length&&<Empty text="لا توجد أحداث تدقيق مسجلة حتى الآن."/>}</div></div>
 <div className="rounded-3xl border border-white/10 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black">قرارات الجودة</h2><span className="md-badge">{quality.length.toLocaleString('ar-EG')}</span></div><div className="mt-5 space-y-3">{quality.map(issue=><article key={issue.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4"><div className="flex items-center justify-between gap-3"><strong>{issue.rule_key}</strong><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${issue.status==='resolved'?'bg-emerald-300/10 text-emerald-200':'bg-slate-500/10 text-slate-300'}`}>{issue.status==='resolved'?'تمت المعالجة':'تم التجاهل'}</span></div><p className="mt-2 text-xs text-violet-200">{issue.category} · {issue.severity}</p><p className="mt-3 leading-7 text-slate-300">{issue.resolution_note||'لا توجد ملاحظة قرار.'}</p><p className="mt-3 text-xs text-slate-500">القرار: {date(issue.resolved_at)}</p></article>)}{!quality.length&&<Empty text="لا توجد قرارات جودة مغلقة حتى الآن."/>}</div></div></section></main>;
}

function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{text}</div>}
