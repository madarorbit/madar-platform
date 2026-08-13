'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {IconButton} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';

type Message={id:string;role:'user'|'assistant';content:string;source?:string};
type Tier='guest'|'registered'|'customer'|'plus';
type Citation={label?:string;source?:string;certainty?:string};
type Props={authenticated:boolean;organizationId:string|null;serviceCode:string|null;initialConversationId:string|null;initialMessages:Message[];initialRemaining:number;initialLimit:number;tier:Tier;starter?:string|null};
type SseEvent={event:string;data:Record<string,unknown>};

export const starterText=(value?:string|null)=>value==='analysis'?'حلل البيانات المتاحة في هذا السياق وحدد أهم ما يحتاج انتباهي.':value==='plan'?'اعمل لي خطة عملية مرتبة للأسبوع القادم اعتمادًا على السياق المتاح.':value==='report'?'جهز لي تقريرًا تنفيذيًا موجزًا عن الوضع الحالي.':String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500);
function parseSse(buffer:string){const blocks=buffer.split('\n\n'),rest=blocks.pop()||'',events:SseEvent[]=[];for(const block of blocks){let event='message',data='';for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trim();}if(data)try{events.push({event,data:JSON.parse(data)});}catch{}}return{events,rest};}
function Inline({text}:{text:string}){const parts=text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);return <>{parts.map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part.startsWith('`')&&part.endsWith('`')?<code key={index} dir="ltr" className="md-orby-inline-code">{part.slice(1,-1)}</code>:part)}</>;}
function Markdown({content}:{content:string}){const chunks=content.split(/```/);return <div className="md-orby-markdown">{chunks.map((chunk,index)=>index%2?<pre key={index} dir="ltr" className="md-orby-code-block"><code>{chunk.replace(/^\w+\n/,'')}</code></pre>:<div key={index} className="whitespace-pre-wrap break-words">{chunk.split('\n').map((line,lineIndex)=>{const clean=line.trim();if(/^#{1,3}\s/.test(clean))return <strong key={lineIndex} className="md-orby-markdown-heading">{clean.replace(/^#{1,3}\s/,'')}</strong>;if(/^[-•]\s/.test(clean))return <div key={lineIndex} className="flex gap-2"><span aria-hidden="true">•</span><span><Inline text={clean.replace(/^[-•]\s/,'')}/></span></div>;return <span key={lineIndex}><Inline text={line}/>{lineIndex<chunk.split('\n').length-1?<br/>:null}</span>;})}</div>)}</div>;}

export default function OrbyChat({authenticated,organizationId,serviceCode,initialConversationId,initialMessages,initialRemaining,initialLimit,tier:initialTier,starter}:Props){
 const router=useRouter(),[messages,setMessages]=useState<Message[]>(initialMessages),[conversationId,setConversationId]=useState<string|null>(initialConversationId),[prompt,setPrompt]=useState(starterText(starter)),[remaining,setRemaining]=useState(initialRemaining),[limit,setLimit]=useState(initialLimit),[tier,setTier]=useState<Tier>(initialTier),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[copiedId,setCopiedId]=useState<string|null>(null),[citations,setCitations]=useState<Citation[]>([]),[generationState,setGenerationState]=useState<{status:'idle'|'streaming'|'stopped'}>({status:'idle'}),controllerRef=useRef<AbortController|null>(null),scrollRef=useRef<HTMLDivElement|null>(null),nearBottom=useRef(true),textareaRef=useRef<HTMLTextAreaElement|null>(null);
 useEffect(()=>{const element=scrollRef.current;if(!element||!nearBottom.current)return;const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;element.scrollTo({top:element.scrollHeight,behavior:reduceMotion?'auto':'smooth'});},[messages,status]);
 useEffect(()=>{const box=textareaRef.current;if(!box)return;box.style.height='auto';box.style.height=`${Math.min(box.scrollHeight,180)}px`;},[prompt]);
 const blocked=remaining===0&&tier!=='plus',usageLabel=useMemo(()=>tier==='plus'?'Plus · استخدام مرن':limit>0?`${Math.max(limit-remaining,0)} من ${limit} اليوم`:null,[tier,limit,remaining]);
 function scrollChanged(){const element=scrollRef.current;if(!element)return;nearBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<120;}
 async function send(text=prompt,options:{retry?:boolean}={}){
  const clean=text.trim();if(!clean||busy||blocked)return;
  setError('');setStatus('');setCitations([]);setBusy(true);setGenerationState({status:'streaming'});nearBottom.current=true;
  if(!options.retry){setMessages(current=>[...current,{id:crypto.randomUUID(),role:'user',content:clean}]);setPrompt('');}
  const assistantId=crypto.randomUUID();setMessages(current=>[...current,{id:assistantId,role:'assistant',content:''}]);
  const controller=new AbortController();controllerRef.current=controller;
  let preserveAssistant=false;
  try{
   const response=await fetch('/api/orby/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,conversationId,prompt:clean}),signal:controller.signal});
   if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(String(payload.error||'تعذر تشغيل أوربي.'));}
   if(!response.body)throw new Error('لم يبدأ بث أوربي.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const parsed=parseSse(buffer);buffer=parsed.rest;for(const item of parsed.events){
    if(item.event==='status')setStatus(String(item.data.label||''));
    else if(item.event==='delta'){const delta=String(item.data.text||'');if(delta)preserveAssistant=true;setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:message.content+delta}:message));}
    else if(item.event==='citations'&&Array.isArray(item.data.items))setCitations(item.data.items as Citation[]);
    else if(item.event==='error'){
     const message=String(item.data.message||'تعذر إكمال الرد.'),code=String(item.data.code||'');
     if(code==='SAVE_FAILED'){
      preserveAssistant=true;
      setError(`${message} سيبقى الرد ظاهرًا في هذه الجلسة، لكن قد لا يظهر بعد تحديث الصفحة.`);
      setStatus('');
      setGenerationState({status:'idle'});
     }else throw new Error(message);
    }
    else if(item.event==='complete'){
     const nextConversation=typeof item.data.conversationId==='string'?item.data.conversationId:null;
     if(nextConversation)setConversationId(nextConversation);
     if(typeof item.data.remaining==='number')setRemaining(item.data.remaining);
     if(typeof item.data.dailyLimit==='number')setLimit(item.data.dailyLimit);
     if(typeof item.data.tier==='string')setTier(item.data.tier as Tier);
     setStatus('');setGenerationState({status:'idle'});
     if(authenticated&&nextConversation&&!conversationId){window.history.replaceState(null,'',`/orby?conversation=${encodeURIComponent(nextConversation)}`);router.refresh();}
    }
   }}
  }catch(reason){if((reason as Error)?.name==='AbortError'){setStatus('تم إيقاف التوليد.');setGenerationState({status:'stopped'});}else{const message=reason instanceof Error?reason.message:'تعذر تشغيل أوربي.';setError(message);if(!preserveAssistant)setMessages(current=>current.filter(item=>item.id!==assistantId));setGenerationState({status:'idle'});}}
  finally{controllerRef.current=null;setBusy(false);setTimeout(()=>setStatus(''),1200);}
 }
 function stop(){controllerRef.current?.abort();controllerRef.current=null;setBusy(false);setGenerationState({status:'stopped'});}
 function retry(messageIndex:number){const previous=[...messages].slice(0,messageIndex).reverse().find(item=>item.role==='user');if(!previous)return;setMessages(current=>current.slice(0,messageIndex));void send(previous.content,{retry:true});}
 async function copyMessage(message:Message){await navigator.clipboard.writeText(message.content);setCopiedId(message.id);window.setTimeout(()=>setCopiedId(current=>current===message.id?null:current),1600)}
 return <div className="md-orby-chat">
  <div className="md-orby-context-bar"><span>{organizationId?`سياق خاص · ${serviceCode==='MADAR_RETAIL'?'MADAR Retail':serviceCode==='CONNECT_EXISTING'?'تجارة مرتبطة':'تجارة مَدار'}`:'محادثة عامة'}</span>{usageLabel?<span className={remaining<=2&&remaining>=0&&tier!=='plus'?'is-warning':''}>{usageLabel}</span>:null}</div>
  <div ref={scrollRef} onScroll={scrollChanged} className="md-orby-message-scroll">
   <div className="md-orby-message-list">{messages.length===0?<div className="md-orby-welcome"><div><Image src="/brand/orby-assistant.svg" width={80} height={80} alt="ORBY" className="md-orby-welcome-avatar"/><h1 className="md-type-h1 mt-5">كيف أقدر أساعدك؟</h1><p className="md-type-body-sm md-muted mx-auto mt-2 max-w-lg">اكتب بطريقتك الطبيعية. لا تحتاج اختيار تحليل أو خطة أو تقرير؛ أوربي يفهم نية طلبك من الرسالة نفسها.</p><div className="md-orby-suggestions">{(organizationId?['حلل مبيعات هذا الشهر.','اعمل لي خطة للشهر القادم.','جهز لي تقريرًا عن الوضع الحالي.']:['ما اسمك؟','ساعدني أرتب فكرة مشروع.','اشرح لي مفهومًا تقنيًا ببساطة.']).map(item=><button key={item} type="button" onClick={()=>setPrompt(item)}>{item}</button>)}</div></div></div>:messages.map((message,index)=><article key={message.id} className={message.role==='user'?'md-orby-message is-user':'md-orby-message is-assistant'}>{message.role==='assistant'?<div className="group"><div className="md-orby-message-author"><Image src="/brand/orby-assistant.svg" width={24} height={24} alt=""/>ORBY</div><Markdown content={message.content||(busy&&index===messages.length-1?'…':'')}/>{message.content?<div className="md-orby-message-actions"><IconButton label={copiedId===message.id?'تم النسخ':'نسخ الرد'} onClick={()=>void copyMessage(message)}><Icon name={copiedId===message.id?'check':'copy'} className="h-4 w-4"/></IconButton><IconButton label="إعادة المحاولة" onClick={()=>retry(index)} disabled={busy}><Icon name="refresh" className="h-4 w-4"/></IconButton></div>:null}</div>:<div className="whitespace-pre-wrap">{message.content}</div>}</article>)}{citations.length?<div className="md-orby-citations">{citations.map((citation,index)=><span key={`${citation.label}-${index}`}>{citation.label||'مصدر'}{citation.source?` · ${citation.source}`:''}</span>)}</div>:null}{generationState.status==='stopped'?<p className="md-type-caption md-muted">توقف الرد بناءً على طلبك.</p>:null}{status?<p className="md-type-body-sm md-muted" role="status">{status}</p>:null}{copiedId?<p className="sr-only" role="status">تم نسخ الرد</p>:null}{error?<div role="alert" className="md-orby-error"><p>{error}</p><button type="button" onClick={()=>setError('')}>إخفاء</button></div>:null}</div>
  </div>
  <div className="md-orby-composer-region"><div className="md-orby-composer-wrap">{blocked?<div className="md-orby-limit"><p>{authenticated?'استخدمت رسائل ORBY المتاحة اليوم. يمكنك الترقية إلى ORBY Plus للمتابعة.':'استخدمت 5 رسائل ORBY المتاحة للزائر اليوم.'}</p><Link href={authenticated?'/orby/plus':'/register?next=/orby'}>{authenticated?'الترقية إلى ORBY Plus':'أنشئ حسابًا للاستمرار'}</Link></div>:null}<form onSubmit={event=>{event.preventDefault();void send();}} className="md-orby-composer"><textarea ref={textareaRef} value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();void send();}}} disabled={blocked} rows={1} maxLength={12000} placeholder="اكتب لأوربي…" aria-label="رسالتك إلى ORBY"/><div className="md-orby-composer-actions"><span>Enter للإرسال · Shift+Enter لسطر جديد</span><div className="md-orby-composer-tools" data-voice-ready="true">{busy?<IconButton label="إيقاف التوليد" onClick={stop}><span className="md-orby-stop-icon"/></IconButton>:<button type="submit" disabled={!prompt.trim()||blocked} className="md-orby-send" aria-label="إرسال"><Icon name="send"/></button>}</div></div></form><p className="md-orby-disclaimer">قد يخطئ ORBY. راجع القرارات المهمة، ولا يملك وصولًا إلا للسياق المصرح به.</p></div></div>
 </div>;
}
