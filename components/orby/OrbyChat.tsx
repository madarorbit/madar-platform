'use client';

import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {IconButton} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';
import OrbyMarkdown from '@/components/orby/OrbyMarkdown';

type Citation={label?:string;source?:string;certainty?:string;href?:string};
type Message={id:string;role:'user'|'assistant';content:string;source?:string;citations?:Citation[]};
type Tier='guest'|'registered'|'customer'|'plus';
type ErrorKind='offline'|'network'|'provider'|'context'|'limit'|'save';
type ChatError={kind:ErrorKind;message:string;retryPrompt?:string};
type Props={authenticated:boolean;organizationId:string|null;serviceCode:string|null;contextLabel:string;initialConversationId:string|null;initialMessages:Message[];initialRemaining:number;initialLimit:number;tier:Tier;starter?:string|null;historyLimited?:boolean};
type SseEvent={event:string;data:Record<string,unknown>};

export const starterText=(value?:string|null)=>value==='analysis'?'حلل البيانات المتاحة في هذا السياق وحدد أهم ما يحتاج انتباهي.':value==='plan'?'اعمل لي خطة عملية مرتبة للأسبوع القادم اعتمادًا على السياق المتاح.':value==='report'?'جهز لي تقريرًا تنفيذيًا موجزًا عن الوضع الحالي.':String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500);
function parseSse(buffer:string){const blocks=buffer.split('\n\n'),rest=blocks.pop()||'',events:SseEvent[]=[];for(const block of blocks){let event='message',data='';for(const line of block.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trim();}if(data)try{events.push({event,data:JSON.parse(data)});}catch{}}return{events,rest};}

function errorFrom(status:number,code:string,message:string,prompt:string):ChatError{
 if(typeof navigator!=='undefined'&&!navigator.onLine)return{kind:'offline',message:'لا يوجد اتصال بالإنترنت. ستبقى رسالتك هنا حتى يعود الاتصال.',retryPrompt:prompt};
 if(status===429||/LIMIT|QUOTA|USAGE/.test(code))return{kind:'limit',message};
 if([401,403,404].includes(status)||/سياق|الخدمة|المحادثة|صلاحية/.test(message))return{kind:'context',message};
 if(status>=500)return{kind:'provider',message,retryPrompt:prompt};
 return{kind:'network',message,retryPrompt:prompt};
}
const safeCitationHref=(value?:string)=>{if(!value)return null;try{const url=new URL(value,'https://madar.local');return ['http:','https:'].includes(url.protocol)?value:null;}catch{return null;}};

function CitationList({items}:{items:Citation[]}){
 if(!items.length)return null;
 return <aside className="md-orby-citations" aria-label="مصادر الرد">{items.map((citation,index)=>{const href=safeCitationHref(citation.href);return href?<a key={`${citation.label}-${index}`} href={href} target="_blank" rel="noreferrer"><strong>{citation.label||'مصدر'}</strong>{citation.source?<span>{citation.source}</span>:null}</a>:<span key={`${citation.label}-${index}`}><strong>{citation.label||'مصدر'}</strong>{citation.source?<small>{citation.source}</small>:null}</span>;})}</aside>;
}

export default function OrbyChat({authenticated,organizationId,contextLabel,initialConversationId,initialMessages,initialRemaining,initialLimit,tier:initialTier,starter,historyLimited=false}:Props){
 const router=useRouter(),[messages,setMessages]=useState<Message[]>(initialMessages),[conversationId,setConversationId]=useState<string|null>(initialConversationId),[prompt,setPrompt]=useState(starterText(starter)),[remaining,setRemaining]=useState(initialRemaining),[limit,setLimit]=useState(initialLimit),[tier,setTier]=useState<Tier>(initialTier),[busy,setBusy]=useState(false),[error,setError]=useState<ChatError|null>(null),[status,setStatus]=useState(''),[copiedId,setCopiedId]=useState<string|null>(null),[generationState,setGenerationState]=useState<{status:'idle'|'streaming'|'stopped'}>({status:'idle'}),[online,setOnline]=useState(()=>typeof navigator==='undefined'?true:navigator.onLine),[showLatest,setShowLatest]=useState(false),controllerRef=useRef<AbortController|null>(null),scrollRef=useRef<HTMLDivElement|null>(null),nearBottom=useRef(true),textareaRef=useRef<HTMLTextAreaElement|null>(null);
 useEffect(()=>{const up=()=>setOnline(true),down=()=>setOnline(false);window.addEventListener('online',up);window.addEventListener('offline',down);return()=>{window.removeEventListener('online',up);window.removeEventListener('offline',down);};},[]);
 useEffect(()=>{const element=scrollRef.current;if(!element||!nearBottom.current)return;const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;element.scrollTo({top:element.scrollHeight,behavior:reduceMotion?'auto':'smooth'});},[messages,status]);
 useEffect(()=>{const box=textareaRef.current;if(!box)return;box.style.height='auto';box.style.height=`${Math.min(box.scrollHeight,180)}px`;},[prompt]);
 const blocked=remaining===0&&tier!=='plus',usageLabel=tier==='plus'?'Plus · استخدام مرن':limit>0?`${Math.max(limit-remaining,0)} من ${limit} اليوم`:null;
 function scrollChanged(){const element=scrollRef.current;if(!element)return;nearBottom.current=element.scrollHeight-element.scrollTop-element.clientHeight<120;setShowLatest(!nearBottom.current);}
 function scrollToLatest(){const element=scrollRef.current;if(!element)return;nearBottom.current=true;element.scrollTo({top:element.scrollHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});setShowLatest(false);}
 async function send(text=prompt,options:{retry?:boolean}={}){
  const clean=text.trim();if(!clean||busy||blocked)return;
  if(!navigator.onLine){setError({kind:'offline',message:'لا يوجد اتصال بالإنترنت. ستبقى رسالتك في المحرر حتى يعود الاتصال.'});return;}
  setError(null);setStatus('');setBusy(true);setGenerationState({status:'streaming'});setShowLatest(false);nearBottom.current=true;
  if(!options.retry){setMessages(current=>[...current,{id:crypto.randomUUID(),role:'user',content:clean}]);setPrompt('');}
  const assistantId=crypto.randomUUID();setMessages(current=>[...current,{id:assistantId,role:'assistant',content:''}]);
  const controller=new AbortController();controllerRef.current=controller;
  let preserveAssistant=false;
  try{
   const response=await fetch('/api/orby/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId,conversationId,prompt:clean}),signal:controller.signal});
   if(!response.ok){const payload=await response.json().catch(()=>({})) as{error?:string;code?:string};throw Object.assign(new Error(String(payload.error||'تعذر تشغيل أوربي.')),{chatError:errorFrom(response.status,String(payload.code||''),String(payload.error||'تعذر تشغيل أوربي.'),clean)});}
   if(!response.body)throw new Error('لم يبدأ بث أوربي.');
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
   while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const parsed=parseSse(buffer);buffer=parsed.rest;for(const item of parsed.events){
    if(item.event==='status')setStatus(String(item.data.label||''));
    else if(item.event==='delta'){const delta=String(item.data.text||'');if(delta)preserveAssistant=true;setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:message.content+delta}:message));}
    else if(item.event==='citations'&&Array.isArray(item.data.items))setMessages(current=>current.map(message=>message.id===assistantId?{...message,citations:item.data.items as Citation[]}:message));
    else if(item.event==='error'){
     const message=String(item.data.message||'تعذر إكمال الرد.'),code=String(item.data.code||'');
     if(code==='SAVE_FAILED'){
      preserveAssistant=true;
      setError({kind:'save',message:`${message} سيبقى الرد ظاهرًا في هذه الجلسة، لكن قد لا يظهر بعد تحديث الصفحة.`});
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
  }catch(reason){if((reason as Error)?.name==='AbortError'){setStatus('تم إيقاف التوليد.');setGenerationState({status:'stopped'});}else{const candidate=reason as Error&{chatError?:ChatError},message=reason instanceof Error?reason.message:'تعذر تشغيل أوربي.';setError(candidate.chatError||{kind:navigator.onLine?'network':'offline',message,retryPrompt:clean});if(!preserveAssistant)setMessages(current=>current.filter(item=>item.id!==assistantId));setGenerationState({status:'idle'});}}
  finally{controllerRef.current=null;setBusy(false);setTimeout(()=>setStatus(''),1200);}
 }
 function stop(){controllerRef.current?.abort();controllerRef.current=null;setBusy(false);setGenerationState({status:'stopped'});}
 function retry(messageIndex:number){const previous=[...messages].slice(0,messageIndex).reverse().find(item=>item.role==='user');if(!previous)return;setMessages(current=>current.slice(0,messageIndex));void send(previous.content,{retry:true});}
 async function copyMessage(message:Message){await navigator.clipboard.writeText(message.content);setCopiedId(message.id);window.setTimeout(()=>setCopiedId(current=>current===message.id?null:current),1600)}
 return <div className="md-orby-chat" aria-busy={busy}>
  <div className="md-orby-context-bar"><span><Icon name={organizationId?'briefcase':'user'} className="h-4 w-4"/>{contextLabel}</span>{usageLabel?<span className={remaining<=2&&remaining>=0&&tier!=='plus'?'is-warning':''}>{usageLabel}</span>:null}</div>
  <div ref={scrollRef} onScroll={scrollChanged} className="md-orby-message-scroll">
   <div className="md-orby-message-list" role="log" aria-label="رسائل المحادثة">{historyLimited?<p className="md-orby-history-note">تُعرض أحدث 200 رسالة للحفاظ على سرعة المحادثة.</p>:null}{messages.length===0?<div className="md-orby-welcome"><div><Image src="/brand/orby-assistant.svg" width={80} height={80} alt="ORBY" className="md-orby-welcome-avatar"/><h1 className="md-type-h1 mt-5">كيف أقدر أساعدك؟</h1><p className="md-type-body-sm md-muted mx-auto mt-2 max-w-lg">اكتب بطريقتك الطبيعية. يفهم ORBY نية طلبك من الرسالة نفسها، سواء كان سؤالًا عامًا أو طلبًا مرتبطًا بخدمتك.</p><div className="md-orby-suggestions">{(organizationId?['كيف حال نشاطي اليوم؟','اعمل لي خطة للأسبوع القادم.','ما الذي يحتاج انتباهي؟']:['ما اسمك؟','ساعدني أرتب فكرة مشروع.','اشرح لي مفهومًا تقنيًا ببساطة.']).map(item=><button key={item} type="button" onClick={()=>{setPrompt(item);textareaRef.current?.focus();}}>{item}</button>)}</div></div></div>:messages.map((message,index)=><article key={message.id} aria-label={message.role==='user'?'رسالتك':'رد ORBY'} className={message.role==='user'?'md-orby-message is-user':'md-orby-message is-assistant'}>{message.role==='assistant'?<div><div className="md-orby-message-author"><Image src="/brand/orby-assistant.svg" width={24} height={24} alt=""/>ORBY</div><OrbyMarkdown content={message.content||(busy&&index===messages.length-1?'…':'')}/><CitationList items={message.citations||[]}/>{message.content?<div className="md-orby-message-actions"><IconButton label={copiedId===message.id?'تم النسخ':'نسخ الرد'} onClick={()=>void copyMessage(message)}><Icon name={copiedId===message.id?'check':'copy'} className="h-4 w-4"/></IconButton><IconButton label="إعادة إنشاء الرد" onClick={()=>retry(index)} disabled={busy}><Icon name="refresh" className="h-4 w-4"/></IconButton></div>:null}</div>:<div className="whitespace-pre-wrap">{message.content}</div>}</article>)}{generationState.status==='stopped'?<p className="md-type-caption md-muted">توقف الرد بناءً على طلبك.</p>:null}{status?<p className="md-orby-stream-status" role="status"><span aria-hidden="true"/>{status}</p>:null}{copiedId?<p className="sr-only" role="status">تم نسخ الرد</p>:null}{error?<div role="alert" className={`md-orby-error is-${error.kind}`}><div><strong>{error.kind==='offline'?'أنت غير متصل':error.kind==='limit'?'وصلت إلى حد الاستخدام':error.kind==='context'?'تعذر استخدام السياق':error.kind==='save'?'تعذر حفظ المحادثة':'تعذر إكمال الرد'}</strong><p>{error.message}</p></div><div>{error.retryPrompt&&online&&!blocked?<button type="button" onClick={()=>{const retryPrompt=error.retryPrompt||'';setError(null);void send(retryPrompt,{retry:true});}}>إعادة المحاولة</button>:null}<button type="button" onClick={()=>setError(null)}>إخفاء</button></div></div>:null}</div>
  </div>
  {showLatest?<button type="button" className="md-orby-latest" onClick={scrollToLatest}><Icon name="arrow" className="h-4 w-4 rotate-90"/>العودة لآخر رسالة</button>:null}
  <div className="md-orby-composer-region"><div className="md-orby-composer-wrap">{!online?<div className="md-orby-offline" role="status"><Icon name="warning"/>لا يوجد اتصال. لن تُرسل الرسالة حتى يعود الإنترنت.</div>:null}{blocked?<div className="md-orby-limit"><p>{authenticated?'استخدمت رسائل ORBY المتاحة اليوم. يمكنك الترقية إلى ORBY Plus للمتابعة.':'استخدمت 5 رسائل ORBY المتاحة للزائر اليوم.'}</p><Link href={authenticated?'/orby/plus':'/register?next=/orby'}>{authenticated?'الترقية إلى ORBY Plus':'أنشئ حسابًا للاستمرار'}</Link></div>:null}<form onSubmit={event=>{event.preventDefault();void send();}} className="md-orby-composer"><textarea ref={textareaRef} value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}} disabled={blocked||!online} rows={1} maxLength={12000} placeholder={online?'اكتب لأوربي…':'بانتظار عودة الاتصال…'} aria-label="رسالتك إلى ORBY" aria-describedby="orby-composer-help"/><div className="md-orby-composer-actions"><span id="orby-composer-help">Enter للإرسال · Shift+Enter لسطر جديد</span><div className="md-orby-composer-tools" data-voice-ready="true">{busy?<IconButton label="إيقاف التوليد" onClick={stop}><span className="md-orby-stop-icon"/></IconButton>:<button type="submit" disabled={!prompt.trim()||blocked||!online} className="md-orby-send" aria-label="إرسال"><Icon name="send"/></button>}</div></div></form><p className="md-orby-disclaimer">قد يخطئ ORBY. راجع القرارات المهمة، ولا يملك وصولًا إلا للسياق المصرح به.</p></div></div>
 </div>;
}
