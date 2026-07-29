import {requireSuperAdmin} from '@/src/lib/auth';
import {supabaseFetch} from '@/src/lib/supabase/server';
import OrbyOsSubnav from '@/components/admin/OrbyOsSubnav';
import {activateOrbyExternalRuntime,deactivateOrbyExternalRuntime} from '../actions';

export const dynamic='force-dynamic';
export const metadata={title:'Models & Tools | ORBY OS'};
type Provider={id:string;display_name:string;enabled:boolean;priority:number;capabilities:Record<string,boolean>;metadata:Record<string,unknown>};
type Model={id:string;provider_id:string;display_name:string;provider_model:string;enabled:boolean;priority:number;capabilities:Record<string,boolean>;pricing:Record<string,unknown>;metadata:Record<string,unknown>};
type Health={provider_id:string;ok:boolean;latency_ms:number;message:string|null;checked_at:string};
type Tool={name:string;version:string;category:string;status:string;enabled:boolean;manifest:Record<string,unknown>};
type Flag={key:string;enabled:boolean;rollout_percentage:number;configuration:Record<string,unknown>};

export default async function Page(){
 await requireSuperAdmin();
 const [providers,models,health,tools,flags]=await Promise.all([
  supabaseFetch('/rest/v1/orby_provider_registry?select=id,display_name,enabled,priority,capabilities,metadata&order=priority.asc'),
  supabaseFetch('/rest/v1/orby_model_registry?select=id,provider_id,display_name,provider_model,enabled,priority,capabilities,pricing,metadata&order=priority.asc'),
  supabaseFetch('/rest/v1/orby_provider_health?select=provider_id,ok,latency_ms,message,checked_at&order=checked_at.desc'),
  supabaseFetch('/rest/v1/orby_tool_catalog?select=name,version,category,status,enabled,manifest&order=category.asc,name.asc'),
  supabaseFetch('/rest/v1/orby_feature_flags?key=in.(orby_provider_execution_enabled,orby_ocr_enabled)&select=key,enabled,rollout_percentage,configuration&order=key.asc'),
 ]) as [Provider[],Model[],Health[],Tool[],Flag[]];
 const providerActive=flags.find(item=>item.key==='orby_provider_execution_enabled')?.enabled===true;
 const ocrActive=flags.find(item=>item.key==='orby_ocr_enabled')?.enabled===true;
 const fullyActive=providerActive&&ocrActive;
 return <main className="mx-auto max-w-[1400px] p-5 py-8 sm:p-8">
  <p className="font-bold text-violet-200">ORBY OS · External Runtime</p>
  <h1 className="mt-2 text-3xl font-black">المزودات والنماذج وOCR</h1>
  <p className="mt-3 max-w-4xl leading-8 text-slate-400">المفاتيح تبقى داخل متغيرات Vercel المشفرة ولا تحفظها هذه الصفحة أو قاعدة البيانات. التفعيل يفحص OpenRouter ونموذج DeepSeek وMistral OCR فعليًا قبل فتح بوابات التشغيل.</p>
  <OrbyOsSubnav/>
  <section className="mt-8 rounded-3xl border border-violet-300/20 bg-violet-300/[.04] p-6">
   <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
    <div>
     <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">حزمة التشغيل المختارة</h2><Status active={fullyActive} label={fullyActive?'نشطة بالكامل':'بانتظار المفاتيح والتفعيل'}/></div>
     <p className="mt-3 leading-7 text-slate-300"><strong>OpenRouter</strong> للتوجيه، <strong>DeepSeek V4 Flash</strong> كنموذج أساسي سريع ومنخفض التكلفة، و<strong>Mistral OCR 3</strong> لاستخراج النص والجداول من الصور وPDF الممسوح.</p>
     <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><Tag>1M Context</Tag><Tag>Streaming</Tag><Tag>JSON</Tag><Tag>Arabic</Tag><Tag>OCR + Tables</Tag><Tag>External channels remain off</Tag></div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
     <form action={activateOrbyExternalRuntime}><button className="md-button md-button-primary" type="submit">فحص المفاتيح وتفعيل التشغيل</button></form>
     <form action={deactivateOrbyExternalRuntime}><button className="md-button md-button-secondary" type="submit">إيقاف التشغيل الخارجي</button></form>
    </div>
   </div>
   <div className="mt-6 grid gap-3 sm:grid-cols-2">
    <Gate title="النموذج الخارجي" active={providerActive} detail="OpenRouter · DeepSeek V4 Flash"/>
    <Gate title="استخراج المستندات" active={ocrActive} detail="Mistral OCR 3 · الصور وPDF الممسوح"/>
   </div>
  </section>
  <section className="mt-8 grid gap-6 lg:grid-cols-3">
   <Panel title="Provider Registry">{providers.length?providers.map(item=><Card key={item.id} title={item.display_name} meta={`${item.id} · أولوية ${item.priority}`} active={item.enabled}/>):<Empty text="سيظهر OpenRouter بعد تطبيق مهاجرة التشغيل الخارجي."/>}</Panel>
   <Panel title="Model Registry">{models.length?models.map(item=><Card key={item.id} title={item.display_name} meta={`${item.provider_id} · ${item.provider_model} · أولوية ${item.priority}`} active={item.enabled}/>):<Empty text="ستظهر نماذج DeepSeek بعد تطبيق المهاجرة."/>}</Panel>
   <Panel title="Provider Health">{health.length?health.map(item=><Card key={`${item.provider_id}-${item.checked_at}`} title={item.provider_id} meta={`${item.latency_ms}ms · ${item.message||'بدون رسالة'}`} active={item.ok}/>):<Empty text="سيظهر أول فحص بعد إضافة المفتاح والضغط على التفعيل."/>}</Panel>
  </section>
  <Panel title="Tool Catalog" wide>{tools.map(item=><Card key={item.name} title={item.name} meta={`${item.category} · v${item.version} · ${item.status}`} active={item.enabled}/>)}</Panel>
 </main>;
}
function Panel({title,children,wide=false}:{title:string;children:React.ReactNode;wide?:boolean}){return <section className={`${wide?'mt-6':''} rounded-3xl border border-white/10 bg-white/[.02] p-6`}><h2 className="text-xl font-black">{title}</h2><div className={`mt-4 ${wide?'grid gap-3 sm:grid-cols-2 lg:grid-cols-3':'space-y-3'}`}>{children}</div></section>}
function Card({title,meta,active}:{title:string;meta:string;active:boolean}){return <div className="rounded-2xl border border-white/10 p-4"><div className="flex justify-between gap-3"><strong>{title}</strong><Status active={active} label={active?'مفعّل':'متوقف'}/></div><p className="mt-2 break-all text-xs text-slate-500">{meta}</p></div>}
function Empty({text}:{text:string}){return <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">{text}</p>}
function Status({active,label}:{active:boolean;label:string}){return <span className={`rounded-full px-2 py-1 text-xs ${active?'bg-emerald-300/10 text-emerald-200':'bg-slate-500/10 text-slate-400'}`}>{label}</span>}
function Gate({title,active,detail}:{title:string;active:boolean;detail:string}){return <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><strong>{title}</strong><Status active={active} label={active?'نشط':'مغلق'}/></div><p className="mt-2 text-sm text-slate-400">{detail}</p></div>}
function Tag({children}:{children:React.ReactNode}){return <span className="rounded-full border border-white/10 px-3 py-1">{children}</span>}
