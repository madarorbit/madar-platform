'use client';

import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {OrbyMode} from '@/src/lib/orby';

type Citation={type:'citation';label:string;source:string;href?:string;lastSyncedAt?:string;certainty:'confirmed'|'estimated'};
type Dialogue={intent:string;operation:string;sector:string;sensitivity:string;confidence:number;strategy:string;requiresClarification:boolean;clarificationQuestion?:string;promptVersion:string};
type Message={id:string;role:'user'|'assistant';content:string;source:'ai'|'smart-fallback';created_at:string;status?:'sending'|'streaming'|'completed'|'failed'|'stopped';citations?:Citation[];dialogue?:Dialogue};
type StreamEvent={type:string;[key:string]:unknown};
const modeLabels:Record<OrbyMode,string>={ANALYZE:'تحليل البيانات',PLAN:'خطة عمل',REPORT:'تقرير تنفيذي',MARKETING:'أفكار تسويقية'};
const suggestions=[{mode:'ANALYZE' as const,text:'ما أهم مؤشر يحتاج انتباهي الآن؟'},{mode:'PLAN' as const,text:'جهز لي خطة عملية للأسبوع القادم.'},{mode:'REPORT' as const,text:'أنشئ ملخصًا تنفيذيًا لحالة النشاط.'}];

function updateMessage(messages:Message[],id:string,patch:Partial<Message>|((message:Message)=>Partial<Message>)){return messages.map(message=>message.id===id?{...message,...(typeof patch==='function'?patch(message):patch)}:message);}
async function readSse(response:Response,onEvent:(event:StreamEvent)=>void){
 if(!response.body)throw new Error('تعذر بدء بث الرد.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
 while(true){const{value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const blocks=buffer.split('\n\n');buffer=blocks.pop()||'';for(const block of blocks){const data=block.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).join('\n');if(!data)continue;onEvent(JSON.parse(data) as StreamEvent);}}
}

export default function OrbyChat({organizationId,initialConversationId,initialMessages,initialRemaining}:{organizationId:string;initialConversationId:string|null;initialMessages:Message[];initialRemaining:number}){
 const router=useRouter(),abortRef=useRef<AbortController|null>(null),textareaRef=useRef<HTMLTextAreaElement|null>(null),scrollRef=useRef<HTMLDivElement|null>(null);
 const[conversationId,setConversationId]=useState(initialConversationId),[messages,setMessages]=useState(initialMessages.map(message=>({...message,status:'completed' as const}))),[mode,setMode]=useState<OrbyMode>('ANALYZE'),[prompt,setPrompt]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[remaining,setRemaining]=useState(initialRemaining),[stage,setStage]=useState('جاهز'),[lastPrompt,setLastPrompt]=useState(''),[copied,setCopied]=useState<string|null>(null),[ratings,setRatings]=useState<Record<string,'up'|'down'>>({});
 useEffect(()=>{const area=textareaRef.current;if(!area)return;area.style.height='auto';area.style.height=`${Math.min(220,Math.max(72,area.scrollHeight))}px`;},[prompt]);
 useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'});},[messages,stage]);
 useEffect(()=>()=>abortRef.current?.abort(),[]);

 async function send(raw:string){
  const clean=raw.trim();if(clean.length<5||pending||remaining<=0)return;
  const now=new Date().toISOString(),userId=`user-${crypto.randomUUID()}`,assistantId=`assistant-${crypto.randomUUID()}`,controller=new AbortController();abortRef.current=controller;setLastPrompt(clean);setMessages(current=>[...current,{id:userId,role:'user',content:clean,source:'ai',created_at:now,status:'completed'},{id:assistantId,role:'assistant',content:'',source:'ai',created_at:now,status:'streaming'}]);setPrompt('');setPending(true);setStage('تم استلام طلبك');setError('');
  try{
   const response=await fetch('/api/orby/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,conversationId,mode,prompt:clean}),signal:controller.signal});
   if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'تعذر تشغيل أوربي.');}
   await readSse(response,event=>{
    if(event.type==='status'){setStage(String(event.label||'جارٍ العمل'));return;}
    if(event.type==='delta'){const text=String(event.text||'');setMessages(current=>updateMessage(current,assistantId,message=>({content:message.content+text,status:'streaming'})));return;}
    if(event.type==='dialogue'){const dialogue=event.decision as Dialogue;setMessages(current=>updateMessage(current,assistantId,{dialogue}));return;}
    if(event.type==='citations'){setMessages(current=>updateMessage(current,assistantId,{citations:(event.items||[]) as Citation[]}));return;}
    if(event.type==='complete'){setConversationId(String(event.conversationId));setRemaining(Number(event.remaining||0));setMessages(current=>updateMessage(current,assistantId,{status:'completed',source:event.source==='smart-fallback'?'smart-fallback':'ai'}));setStage('اكتمل الرد');return;}
    if(event.type==='error')throw new Error(String(event.message||'تعذر إكمال الرد.'));
   });
   router.refresh();
  }catch(reason){
   if(controller.signal.aborted){setMessages(current=>updateMessage(current,assistantId,{status:'stopped'}));setStage('تم إيقاف الرد');}
   else{const message=reason instanceof Error?reason.message:'تعذر تشغيل أوربي.';setMessages(current=>updateMessage(current,assistantId,currentMessage=>({status:'failed',content:currentMessage.content||'لم يكتمل الرد.'})));setError(message);setStage('تعذر إكمال الطلب');}
  }finally{if(abortRef.current===controller)abortRef.current=null;setPending(false);}
 }
 function submit(event:React.FormEvent){event.preventDefault();void send(prompt);}
 function stop(){abortRef.current?.abort();}
 function retry(){if(lastPrompt&&!pending)void send(lastPrompt);}
 async function copy(message:Message){await navigator.clipboard.writeText(message.content);setCopied(message.id);window.setTimeout(()=>setCopied(null),1500);}
 function editAndResend(message:Message){setPrompt(message.content);textareaRef.current?.focus();}
 function keyDown(event:React.KeyboardEvent<HTMLTextAreaElement>){if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(prompt.trim().length>=5)void send(prompt);}}
 return <section className="rounded-3xl border border-violet-300/20 bg-gradient-to-b from-violet-400/[.06] to-emerald-300/[.03] p-4 sm:p-6" aria-label="محادثة أوربي">
  <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-bold text-[#70E4D4]">أوربي | ORBY</p><h2 className="mt-1 text-2xl font-black">اسأل بيانات نشاطك</h2><p className="mt-2 text-sm leading-7 text-slate-400">نواة أوربي واحدة للمحادثة والتحليل. لا يُنفذ أي تعديل حساس دون معاينة وموافقة صريحة.</p></div><div className="flex flex-col items-end gap-2"><span className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300">متبقي اليوم: {remaining}</span><span className="text-[11px] text-emerald-200" role="status" aria-live="polite">{stage}</span></div></div>
  <div ref={scrollRef} className="mt-6 max-h-[620px] min-h-[360px] space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/50 p-3 sm:p-4" aria-live="polite">
   {messages.length?messages.map(message=><article key={message.id} className={`group max-w-[96%] rounded-2xl p-4 sm:max-w-[88%] ${message.role==='user'?'mr-auto bg-white text-slate-950':'ml-auto border border-violet-300/15 bg-violet-300/[.07] text-slate-100'}`}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3 text-xs opacity-70"><strong>{message.role==='user'?'أنت':'أوربي'}</strong><div className="flex items-center gap-2">{message.role==='assistant'&&<span>{message.source==='ai'?'ORBY Core':'تحليل محلي آمن'}</span>}{message.status&&message.status!=='completed'&&<span className="rounded-full border border-current/20 px-2 py-1">{message.status==='streaming'?'جارٍ البث':message.status==='stopped'?'متوقف':message.status==='failed'?'فشل':'جارٍ الإرسال'}</span>}</div></div>
    {message.content?<p className="whitespace-pre-wrap leading-8">{message.content}</p>:<div className="space-y-2 py-2"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-300"/><span className="mr-2 text-sm text-slate-400">أوربي يجهز الرد…</span></div>}
    {message.role==='assistant'&&message.dialogue?.operation==='write'&&<div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/[.07] p-3"><strong className="text-sm text-amber-100">معاينة إجراء مطلوبة</strong><p className="mt-1 text-xs leading-6 text-amber-50/80">فهم أوربي الطلب كإجراء كتابة بدرجة حساسية {message.dialogue.sensitivity}. لن يُنفذ شيء من الرد وحده؛ يجب إنشاء مسودة وعرض التغييرات ثم تأكيدها.</p></div>}
    {message.citations?.length?<div className="mt-4 grid gap-2">{message.citations.map((citation,index)=><a key={`${citation.label}-${index}`} href={citation.href||'#'} className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs hover:bg-white/[.06]"><strong className="text-emerald-200">المصدر: {citation.label}</strong><span className="mt-1 block text-slate-400">{citation.source} · {citation.certainty==='confirmed'?'بيانات مؤكدة':'بيانات تقديرية'}{citation.lastSyncedAt?` · آخر تحديث ${new Date(citation.lastSyncedAt).toLocaleString('ar-YE')}`:''}</span></a>)}</div>:null}
    <div className={`mt-3 flex flex-wrap gap-2 text-[11px] ${message.role==='user'?'text-slate-600':'text-slate-400'}`}>{message.role==='assistant'?<><button type="button" onClick={()=>void copy(message)} className="rounded-lg border border-current/15 px-2 py-1">{copied===message.id?'تم النسخ':'نسخ'}</button><button type="button" onClick={retry} disabled={pending} className="rounded-lg border border-current/15 px-2 py-1 disabled:opacity-40">إعادة التوليد</button><button type="button" onClick={()=>setRatings(current=>({...current,[message.id]:'up'}))} className={`rounded-lg border px-2 py-1 ${ratings[message.id]==='up'?'border-emerald-300 text-emerald-200':'border-current/15'}`} aria-label="رد مفيد">مفيد</button><button type="button" onClick={()=>setRatings(current=>({...current,[message.id]:'down'}))} className={`rounded-lg border px-2 py-1 ${ratings[message.id]==='down'?'border-red-300 text-red-200':'border-current/15'}`} aria-label="الإبلاغ عن مشكلة في الرد">مشكلة</button></>:<button type="button" onClick={()=>editAndResend(message)} className="rounded-lg border border-current/15 px-2 py-1">تعديل وإعادة الإرسال</button>}</div>
   </article>):<div className="py-16 text-center text-slate-500"><p className="text-lg font-bold text-slate-300">ابدأ بسؤال واضح</p><p className="mt-2">جرّب تحليل مؤشر، إعداد تقرير، أو طلب خطة عملية.</p><div className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-2">{suggestions.map(item=><button key={item.text} type="button" onClick={()=>{setMode(item.mode);setPrompt(item.text);textareaRef.current?.focus();}} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/[.05]">{item.text}</button>)}</div></div>}
  </div>
  <form onSubmit={submit} className="sticky bottom-3 mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-xl"><div className="flex flex-wrap gap-2">{(Object.keys(modeLabels) as OrbyMode[]).map(value=><button type="button" key={value} onClick={()=>setMode(value)} aria-pressed={mode===value} className={`rounded-xl px-3 py-2 text-sm font-bold ${mode===value?'bg-white text-slate-950':'border border-white/10 text-slate-300'}`}>{modeLabels[value]}</button>)}</div><textarea ref={textareaRef} value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={keyDown} minLength={5} maxLength={12000} required rows={3} className="field resize-none rounded-2xl p-4" placeholder="اكتب طلبك… Enter للإرسال وShift+Enter لسطر جديد" aria-label="رسالة إلى أوربي"/><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-6 text-slate-500">المساحة الحالية معزولة. لا تضع كلمات مرور أو مفاتيح أو بيانات دفع حساسة.</p><div className="flex gap-2">{pending&&<button type="button" onClick={stop} className="rounded-xl border border-red-300/30 px-4 py-3 font-bold text-red-100">إيقاف</button>}{!pending&&lastPrompt&&error&&<button type="button" onClick={retry} className="rounded-xl border border-white/10 px-4 py-3 font-bold">إعادة المحاولة</button>}<button disabled={pending||remaining<=0||prompt.trim().length<5} className="rounded-xl bg-gradient-to-l from-violet-500 to-emerald-400 px-6 py-3 font-black disabled:cursor-not-allowed disabled:opacity-50">{pending?'جارٍ العمل…':'إرسال'}</button></div></div>{error&&<p role="alert" className="rounded-xl border border-red-300/20 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}</form>
 </section>;
}
