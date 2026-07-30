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
type SearchParams=Promise<Record<string,string|string[]|undefined>>;

const modelLabels:Record<string,string>={
 'gemini-2.5-flash-lite':'Gemini 2.5 Flash Lite',
 'gpt-4.1-nano':'GPT-4.1 Nano',
 'deepseek-v3.2':'DeepSeek V3.2',
};

const activationMessages:Record<string,{title:string;body:string}>={
 'openrouter-key-missing':{title:'مفتاح OpenRouter غير موجود',body:'تأكد من إضافة ORBY_OPENROUTER_API_KEY إلى بيئة Production في Vercel ثم أعد النشر.'},
 'openrouter-key-invalid':{title:'مفتاح OpenRouter غير صالح',body:'المفتاح الموجود في Vercel مرفوض أو ملغى. استخدم مفتاح API عاديًا من صفحة API Keys، وليس مفتاح إدارة.'},
 'openrouter-management-key':{title:'المفتاح من نوع Management Key',body:'هذا المفتاح مخصص لإدارة المفاتيح فقط ولا يستطيع تشغيل النماذج. أنشئ مفتاحًا من OpenRouter → API Keys ثم استبدله في ORBY_OPENROUTER_API_KEY.'},
 'openrouter-provisioning-key':{title:'المفتاح من نوع Provisioning Key',body:'هذا المفتاح لا يصلح لطلبات النماذج. أنشئ مفتاح API عاديًا من صفحة API Keys في مساحة العمل نفسها.'},
 'openrouter-key-metadata-invalid':{title:'تعذر قراءة بيانات المفتاح',body:'استجاب OpenRouter للمفتاح لكن بيانات نوعه وحدوده لم تكن مكتملة. أنشئ مفتاح API عاديًا جديدًا ثم أعد النشر.'},
 'openrouter-credit-required':{title:'رصيد OpenRouter أو حد المفتاح غير كافٍ',body:'راجع الرصيد وحد الإنفاق الخاص بالمفتاح ومساحة العمل. يجب أن تكون قيمة Limit Remaining أكبر من صفر.'},
 'openrouter-guardrail-blocked':{title:'قيود OpenRouter تمنع النماذج',body:'المفتاح صحيح، لكن Guardrail أو Model Allowlist أو Provider Allowlist يمنع النماذج المرشحة. اجعل قائمة النماذج فارغة للسماح بالكل، أو اسمح بـGemini 2.5 Flash Lite وGPT-4.1 Nano وDeepSeek V3.2.'},
 'openrouter-no-eligible-provider':{title:'لا يوجد مزود مؤهل وفق سياسة الخصوصية',body:'لم يجد OpenRouter مسارًا متاحًا يطابق سياسة عدم جمع البيانات. راجع Privacy وGuardrails في مساحة العمل.'},
 'openrouter-no-working-model':{title:'لم ينجح أي نموذج منخفض التكلفة',body:'فحص أوربي النماذج المتاحة فعليًا وجرب Gemini Flash Lite وGPT-4.1 Nano وDeepSeek V3.2، لكن لم يعد أي منها جوابًا صالحًا. راجع Activity في OpenRouter لمعرفة قرار التوجيه.'},
 'openrouter-access-forbidden':{title:'صلاحية OpenRouter غير كافية',body:'المفتاح صحيح لكن إعداداته أو Guardrails الخاصة بمساحة العمل تمنع طلبات النماذج.'},
 'openrouter-rate-limited':{title:'حد OpenRouter المؤقت',body:'المفتاح يعمل، لكن المزود رفض الطلب مؤقتًا بسبب حدود الاستخدام. أعد المحاولة بعد قليل.'},
 'provider-reasoning-exhausted':{title:'استهلك النموذج الإخراج في الاستدلال',body:'لم ينتج النموذج جوابًا نهائيًا. الاختيار التلقائي يتجاوز نماذج reasoning-only ويختار مسارًا سريعًا صالحًا.'},
 'mistral-key-missing':{title:'مفتاح Mistral غير موجود',body:'تأكد من إضافة ORBY_MISTRAL_OCR_API_KEY واختيار ORBY_OCR_PROVIDER=mistral في Vercel.'},
 'mistral-key-invalid':{title:'مفتاح Mistral غير صالح',body:'مفتاح Mistral مرفوض أو انتهت صلاحيته. أنشئ مفتاحًا جديدًا داخل Workspace الصحيح.'},
 'mistral-payment-required':{title:'خطة Mistral لا تسمح بطلب OCR',body:'أضف وسيلة دفع وارفع الخطة إلى Scale أو تأكد من توفر OCR ضمن حدود حسابك، ثم أعد الفحص.'},
 'mistral-access-forbidden':{title:'Mistral يمنع الوصول',body:'المفتاح لا يملك صلاحية الوصول إلى OCR أو أنه تابع لـWorkspace مختلف.'},
 'mistral-rate-limited':{title:'حد Mistral المؤقت',body:'تم الوصول إلى حد Workspace. راجع صفحة Limits أو أعد المحاولة لاحقًا.'},
 'mistral-model-unavailable':{title:'نموذج OCR غير متاح للحساب',body:'الحساب يعمل، لكن نموذج Mistral OCR المحدد غير ظاهر ضمن النماذج المسموحة للخطة الحالية.'},
 'mistral-empty-response':{title:'استجابة Mistral فارغة',body:'وصل الطلب إلى Mistral لكنه لم يُرجع بيانات صالحة. لم يتم التفعيل.'},
 'mistral-probe-failed':{title:'اختبار OCR الفعلي لم ينجح',body:'اتصل أوربي بـMistral، لكن صورة الاختبار لم تُستخرج بالنص المتوقع. راجع خطة OCR والنموذج المحدد ثم أعد الفحص.'},
 'provider-timeout':{title:'انتهت مهلة الاتصال',body:'لم يستجب أحد المزودين خلال المهلة المحددة. أعد المحاولة دون تغيير المفاتيح.'},
 'provider-unavailable':{title:'المزود غير متاح مؤقتًا',body:'المفاتيح لم تُرفض، لكن الخدمة الخارجية غير متاحة حاليًا.'},
 'provider-empty-response':{title:'استجابة خارجية غير مكتملة',body:'أعاد المزود استجابة فارغة أو غير مكتملة. عالج النظام الخطأ بأمان ولم يفتح أي بوابة.'},
 'external-runtime-check-failed':{title:'لم يكتمل فحص التشغيل',body:'فشل أحد اختبارات المفتاح أو النموذج أو OCR. لم يتم تفعيل أي جزء بصورة جزئية.'},
};

export default async function Page({searchParams}:{searchParams:SearchParams}){
 await requireSuperAdmin();
 const params=await searchParams;
 const activation=typeof params.activation==='string'?params.activation:'';
 const code=typeof params.code==='string'?params.code:'';
 const selectedFromQuery=typeof params.model==='string'?params.model:'';
 const notice=activation==='error'?activationMessages[code]||activationMessages['external-runtime-check-failed']:null;
 const [providers,models,health,tools,flags]=await Promise.all([
  supabaseFetch('/rest/v1/orby_provider_registry?select=id,display_name,enabled,priority,capabilities,metadata&order=priority.asc'),
  supabaseFetch('/rest/v1/orby_model_registry?select=id,provider_id,display_name,provider_model,enabled,priority,capabilities,pricing,metadata&order=priority.asc'),
  supabaseFetch('/rest/v1/orby_provider_health?select=provider_id,ok,latency_ms,message,checked_at&order=checked_at.desc'),
  supabaseFetch('/rest/v1/orby_tool_catalog?select=name,version,category,status,enabled,manifest&order=category.asc,name.asc'),
  supabaseFetch('/rest/v1/orby_feature_flags?key=in.(orby_provider_execution_enabled,orby_ocr_enabled)&select=key,enabled,rollout_percentage,configuration&order=key.asc'),
 ]) as [Provider[],Model[],Health[],Tool[],Flag[]];
 const providerFlag=flags.find(item=>item.key==='orby_provider_execution_enabled');
 const providerActive=providerFlag?.enabled===true;
 const ocrActive=flags.find(item=>item.key==='orby_ocr_enabled')?.enabled===true;
 const fullyActive=providerActive&&ocrActive;
 const configuredModel=typeof providerFlag?.configuration?.model==='string'?providerFlag.configuration.model:'';
 const selectedModel=selectedFromQuery||configuredModel;
 const selectedLabel=modelLabels[selectedModel]||selectedModel||'سيُختار تلقائيًا عند الفحص';
 return <main className="mx-auto max-w-[1400px] p-5 py-8 sm:p-8">
  <p className="font-bold text-violet-200">ORBY OS · External Runtime</p>
  <h1 className="mt-2 text-3xl font-black">المزودات والنماذج وOCR</h1>
  <p className="mt-3 max-w-4xl leading-8 text-slate-400">المفاتيح تبقى داخل متغيرات Vercel المشفرة. يفحص أوربي نوع مفتاح OpenRouter ورصيده وقيوده، ثم يجرّب مجموعة نماذج منخفضة التكلفة ويختار أول مسار ناجح، ويستخرج صورة OCR تجريبية فعلية قبل فتح البوابات.</p>
  <OrbyOsSubnav/>
  {activation==='success'?<Notice kind="success" title="اكتمل التفعيل" body={`نجح OpenRouter عبر ${selectedLabel}، ونجح استخراج صورة OCR التجريبية عبر Mistral، وفُتحت بوابات التشغيل الخارجي.`}/>:null}
  {activation==='stopped'?<Notice kind="neutral" title="تم إيقاف التشغيل الخارجي" body="أُغلقت بوابات المزود وOCR مع الاحتفاظ بالمفاتيح داخل Vercel."/>:null}
  {notice?<Notice kind="error" title={notice.title} body={notice.body}/>:null}
  <section className="mt-8 rounded-3xl border border-violet-300/20 bg-violet-300/[.04] p-6">
   <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
    <div>
     <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">حزمة التشغيل التلقائية</h2><Status active={fullyActive} label={fullyActive?'نشطة بالكامل':'بانتظار نجاح الفحص والتفعيل'}/></div>
     <p className="mt-3 leading-7 text-slate-300"><strong>OpenRouter</strong> للتوجيه، مع اختيار تلقائي بين <strong>Gemini 2.5 Flash Lite</strong> و<strong>GPT-4.1 Nano</strong> و<strong>DeepSeek V3.2</strong> حسب الإتاحة الفعلية، و<strong>Mistral OCR 3</strong> للصور وPDF الممسوح.</p>
     <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400"><Tag>Low Cost</Tag><Tag>Automatic Fallback</Tag><Tag>Streaming</Tag><Tag>JSON</Tag><Tag>Arabic</Tag><Tag>Real OCR Probe</Tag><Tag>Privacy Routing</Tag></div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row">
     <form action={activateOrbyExternalRuntime}><button className="md-button md-button-primary" type="submit">فحص شامل واختيار النموذج والتفعيل</button></form>
     <form action={deactivateOrbyExternalRuntime}><button className="md-button md-button-secondary" type="submit">إيقاف التشغيل الخارجي</button></form>
    </div>
   </div>
   <div className="mt-6 grid gap-3 sm:grid-cols-2">
    <Gate title="النموذج الخارجي" active={providerActive} detail={`OpenRouter · ${selectedLabel}`}/>
    <Gate title="استخراج المستندات" active={ocrActive} detail="Mistral OCR 3 · الصور وPDF الممسوح"/>
   </div>
  </section>
  <section className="mt-8 grid gap-6 lg:grid-cols-3">
   <Panel title="Provider Registry">{providers.length?providers.map(item=><Card key={item.id} title={item.display_name} meta={`${item.id} · أولوية ${item.priority}`} active={item.enabled}/>):<Empty text="سيظهر OpenRouter بعد تطبيق مهاجرة التشغيل الخارجي."/>}</Panel>
   <Panel title="Model Registry">{models.length?models.map(item=><Card key={item.id} title={item.display_name} meta={`${item.provider_id} · ${item.provider_model} · أولوية ${item.priority}`} active={item.enabled}/>):<Empty text="ستظهر النماذج المرشحة بعد تطبيق المهاجرة."/>}</Panel>
   <Panel title="Provider Health">{health.length?health.map(item=><Card key={`${item.provider_id}-${item.checked_at}`} title={item.provider_id} meta={`${item.latency_ms}ms · ${item.message||'بدون رسالة'}`} active={item.ok}/>):<Empty text="سيظهر أول فحص بعد الضغط على زر التفعيل."/>}</Panel>
  </section>
  <Panel title="Tool Catalog" wide>{tools.map(item=><Card key={item.name} title={item.name} meta={`${item.category} · v${item.version} · ${item.status}`} active={item.enabled}/>)}</Panel>
 </main>;
}
function Notice({kind,title,body}:{kind:'success'|'error'|'neutral';title:string;body:string}){const style=kind==='success'?'border-emerald-300/30 bg-emerald-300/[.08] text-emerald-100':kind==='error'?'border-amber-300/30 bg-amber-300/[.08] text-amber-100':'border-white/10 bg-white/[.03] text-slate-200';return <section role="status" className={`mt-6 rounded-2xl border p-5 ${style}`}><strong>{title}</strong><p className="mt-2 text-sm leading-7 opacity-90">{body}</p></section>}
function Panel({title,children,wide=false}:{title:string;children:React.ReactNode;wide?:boolean}){return <section className={`${wide?'mt-6':''} rounded-3xl border border-white/10 bg-white/[.02] p-6`}><h2 className="text-xl font-black">{title}</h2><div className={`mt-4 ${wide?'grid gap-3 sm:grid-cols-2 lg:grid-cols-3':'space-y-3'}`}>{children}</div></section>}
function Card({title,meta,active}:{title:string;meta:string;active:boolean}){return <div className="rounded-2xl border border-white/10 p-4"><div className="flex justify-between gap-3"><strong>{title}</strong><Status active={active} label={active?'مفعّل':'متوقف'}/></div><p className="mt-2 break-all text-xs text-slate-500">{meta}</p></div>}
function Empty({text}:{text:string}){return <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">{text}</p>}
function Status({active,label}:{active:boolean;label:string}){return <span className={`rounded-full px-2 py-1 text-xs ${active?'bg-emerald-300/10 text-emerald-200':'bg-slate-500/10 text-slate-400'}`}>{label}</span>}
function Gate({title,active,detail}:{title:string;active:boolean;detail:string}){return <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><div className="flex items-center justify-between gap-3"><strong>{title}</strong><Status active={active} label={active?'نشط':'مغلق'}/></div><p className="mt-2 text-sm text-slate-400">{detail}</p></div>}
function Tag({children}:{children:React.ReactNode}){return <span className="rounded-full border border-white/10 px-3 py-1">{children}</span>}
