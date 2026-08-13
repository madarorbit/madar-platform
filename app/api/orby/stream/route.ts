import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch,SupabaseRequestError} from '@/src/lib/supabase/server';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {IntegrationError} from '@/src/lib/integration/errors';
import {
 deterministicGeneralOrbyResponse,deterministicOrbyResponse,orbyModes,orbySystemPrompt,type OrbyContext,type OrbyMode,
} from '@/src/lib/orby';
import type {OrbyContextSource,OrbyKernelResponse} from '@/src/lib/orby/core/contracts';
import {isOrbyError,publicOrbyError} from '@/src/lib/orby/core/errors';
import {createAccountOrbyFoundation} from '@/src/lib/orby/account-runtime';
import {createServerOrbyFoundation} from '@/src/lib/orby/server';
import {mapBusinessSector,OrbyDialogueManager} from '@/src/lib/orby/personality';
import {createClient as createRetailServiceClient} from '@/src/lib/retail/supabase/server';
import {executeRetailRpc} from '@/src/lib/retail/server/rpc';
import {localDate} from '@/src/lib/retail/server/analytics/queries';
import {buildGroundedAnswer} from '@/src/lib/retail/server/orby/grounding';
import type {AnalyticsSnapshot} from '@/src/lib/retail/types';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ServiceCode='CONNECT_EXISTING'|'BUILD_ON_MADAR'|'MADAR_RETAIL';
type Usage={tier:'guest'|'registered'|'customer'|'plus';daily_limit:number;used:number;remaining:number;usage_date?:string;plus_ends_at?:string|null};
type Scope={organizationId:string;serviceCode:ServiceCode};
type ConversationScope={id:string;organization_id:string|null;service_code:ServiceCode|null};
type RetailEvidence={snapshot:AnalyticsSnapshot;customers:Array<{name:string;balance_due:number}>;suppliers:Array<{name:string;balance_due:number}>;workspace:{id:string;name:string;currency:string;timezone:string}};

const scalar=<T,>(value:unknown)=>Array.isArray(value)?value[0] as T:value as T;
const tokenFrom=(request:Request)=>{const header=request.headers.get('authorization')||'';const[scheme,token]=header.split(/\s+/,2);return scheme?.toLowerCase()==='bearer'&&token?token:undefined;};
const encode=(event:string,data:unknown)=>`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const guestCookie=(request:Request)=>request.headers.get('cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith('madar-orby-guest='))?.slice('madar-orby-guest='.length)||'';
const normalizedNumbers=(text:string)=>new Set((text.match(/[\d٠-٩۰-۹]+(?:[.,٬٫][\d٠-٩۰-۹]+)*/g)??[]).map(value=>value.replace(/[٬,]/g,'')));
const answerUsesOnlyEvidence=(answer:string,evidence:unknown)=>{const allowed=normalizedNumbers(JSON.stringify(evidence));return [...normalizedNumbers(answer)].every(value=>allowed.has(value));};

function internalMode(intent:string):OrbyMode{
 if(intent==='report')return'REPORT';
 if(intent==='analysis')return'ANALYZE';
 if(intent==='task'||intent==='monitoring'||intent==='execution')return'PLAN';
 return'GENERAL';
}
function currentTimeSource():OrbyContextSource{
 return{key:'madar.current-time',priority:20,async load(){const now=new Date();return{key:'madar.current-time',title:'وقت الخادم الحالي',content:JSON.stringify({utc:now.toISOString(),aden:new Intl.DateTimeFormat('ar-YE',{timeZone:'Asia/Aden',dateStyle:'full',timeStyle:'long'}).format(now)}),priority:20,trusted:true,sensitive:false,metadata:{source:'server-clock'}};}};
}
function businessSource(mode:OrbyMode,context:OrbyContext):OrbyContextSource{
 return{key:'madar.business-context',priority:1000,async load(){return{key:'madar.business-context',title:'سياق الأعمال المصرح به من مَدار',content:JSON.stringify({task:orbyModes[mode],businessContext:context,sourceOfTruth:context.activity?.source_of_truth||'MADAR',generatedAt:context.analytics.generated_at}),priority:1000,trusted:false,sensitive:true,metadata:{source:'madar-workspace',generatedAt:context.analytics.generated_at,mode}};}};
}
function retailSource(evidence:RetailEvidence):OrbyContextSource{
 return{key:'madar.retail-context',priority:1100,async load(){return{key:'madar.retail-context',title:'سياق MADAR Retail المصرح به',content:JSON.stringify({evidence,readOnly:true}),priority:1100,trusted:false,sensitive:true,metadata:{source:'madar-retail',readOnly:true}};}};
}
function historySource(messages:Array<{role:string;content:string}>):OrbyContextSource{
 return{key:'madar.account-history',priority:100,async load(){return{key:'madar.account-history',title:'سياق المحادثة السابقة للمستخدم',content:JSON.stringify(messages.slice(-24)),priority:100,trusted:false,sensitive:true,metadata:{source:'account-conversation'}};}};
}
function rawIntegrationReason(error:unknown){
 if(error instanceof IntegrationError&&error.cause&&typeof error.cause==='object'){
  const value=error.cause as{message?:unknown};return typeof value.message==='string'?value.message:'';
 }
 return'';
}
function usageErrorResponse(error:unknown,authenticated:boolean){
 if(error instanceof Error&&(error.message.includes('ORBY_GUEST_DAILY_LIMIT')||error.message.includes('ORBY_DAILY_LIMIT')))return NextResponse.json({error:authenticated?'وصلت إلى حد أوربي اليومي. يمكنك الترقية إلى ORBY Plus للمتابعة.':'وصلت إلى 5 رسائل اليوم. أنشئ حسابًا للاستمرار مع ORBY.',code:authenticated?'ORBY_DAILY_LIMIT':'ORBY_GUEST_DAILY_LIMIT'},{status:429});
 if(error instanceof SupabaseRequestError&&error.code==='P0001')return NextResponse.json({error:'وصلت إلى حد الاستخدام الحالي أو طبقة الحماية من الإساءة. حاول لاحقًا أو راجع خطتك.',code:'ORBY_USAGE_LIMIT'},{status:429});
 console.error('ORBY usage reservation failed',{name:error instanceof Error?error.name:'unknown'});
 return NextResponse.json({error:'تعذر التحقق من استخدام أوربي الآن.',code:'ORBY_USAGE_UNAVAILABLE'},{status:503});
}
async function reserveGuest(request:Request,promptLength:number){
 const existing=guestCookie(request),id=uuidPattern.test(existing)?existing:crypto.randomUUID(),ip=(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim(),ua=request.headers.get('user-agent')||'unknown';
 const visitorHash=createHash('sha256').update(`${id}|${ip}|${ua}`).digest('hex');
 try{
  const usage=await new IntegrationDatabase().rpc<Usage>('reserve_orby_guest_request',{visitor_hash:visitorHash,submitted_characters:promptLength} as never);
  return{usage,id,isNew:id!==existing};
 }catch(error){
  if(rawIntegrationReason(error).includes('ORBY_GUEST_DAILY_LIMIT'))throw new Error('ORBY_GUEST_DAILY_LIMIT');
  throw error;
 }
}
async function resolveConversationScope(fetcher:(path:string,init?:RequestInit)=>Promise<unknown>,conversationId:string,userId:string){
 if(!uuidPattern.test(conversationId))return null;
 const rows=await fetcher(`/rest/v1/orby_conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&select=id,organization_id,service_code&limit=1`) as ConversationScope[];
 return rows[0]||null;
}
async function activeScope(fetcher:(path:string,init?:RequestInit)=>Promise<unknown>,organizationId:string,userId:string):Promise<Scope|null>{
 if(!uuidPattern.test(organizationId))return null;
 const rows=await fetcher(`/rest/v1/workspace_subscriptions?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&status=eq.active&activation_state=eq.ACTIVE&ends_at=gt.${encodeURIComponent(new Date().toISOString())}&select=organization_id,service_code&limit=1`) as Array<{organization_id:string;service_code:ServiceCode}>;
 return rows[0]?{organizationId:rows[0].organization_id,serviceCode:rows[0].service_code}:null;
}
async function retailEvidence(userId:string,organizationId:string):Promise<RetailEvidence>{
 const client=createRetailServiceClient();
 const{data,error}=await client.from('retail_workspaces').select('id,name,currency,timezone,status').eq('platform_organization_id',organizationId).eq('status','active').maybeSingle();
 if(error||!data)throw new Error('RETAIL_WORKSPACE_NOT_READY');
 const today=localDate(String(data.timezone||'Asia/Aden'));
 const[snapshot,customers,suppliers]=await Promise.all([
  executeRetailRpc<AnalyticsSnapshot>(userId,'retail_analytics_snapshot',{target_workspace:data.id,date_from:today,date_to:today}),
  executeRetailRpc<Array<{name:string;balance_due:number}>>(userId,'retail_customer_summaries',{target_workspace:data.id}),
  executeRetailRpc<Array<{name:string;balance_due:number}>>(userId,'retail_supplier_summaries',{target_workspace:data.id}),
 ]);
 return{snapshot,customers,suppliers,workspace:{id:data.id,name:data.name,currency:data.currency,timezone:data.timezone}};
}

export async function POST(request:Request){
 const accessToken=tokenFrom(request),user=await currentUser(accessToken),fetcher=(path:string,init:RequestInit={})=>supabaseFetch(path,init,accessToken);
 let body:{organizationId?:string|null;conversationId?:string|null;prompt?:string};
 try{body=await request.json();}catch{return NextResponse.json({error:'صيغة الطلب غير صالحة.'},{status:400});}
 const prompt=String(body.prompt||'').trim();
 if(prompt.length<1||prompt.length>12000)return NextResponse.json({error:'اكتب رسالة بين حرف واحد و12000 حرف.'},{status:400});
 if(!user&&(body.organizationId||body.conversationId))return NextResponse.json({error:'سجّل الدخول للوصول إلى محادثات أو بيانات خاصة.'},{status:401});

 let conversationId=body.conversationId&&uuidPattern.test(String(body.conversationId))?String(body.conversationId):null;
 let scope:Scope|null=null,usage:Usage|null=null,guestId:string|null=null,guestIsNew=false;
 try{
  if(user){
   if(conversationId){
    const stored=await resolveConversationScope(fetcher,conversationId,user.id);
    if(!stored)return NextResponse.json({error:'المحادثة غير موجودة أو لا تملك صلاحيتها.'},{status:404});
    if(stored.organization_id){scope=await activeScope(fetcher,stored.organization_id,user.id);if(!scope)return NextResponse.json({error:'الخدمة المرتبطة بهذه المحادثة ليست فعالة حاليًا.'},{status:403});}
   }else if(body.organizationId){scope=await activeScope(fetcher,String(body.organizationId),user.id);if(!scope)return NextResponse.json({error:'لا تملك خدمة فعالة في هذه المساحة.'},{status:403});}
  }else{
   const reserved=await reserveGuest(request,prompt.length);usage=reserved.usage;guestId=reserved.id;guestIsNew=reserved.isNew;
  }
 }catch(error){
  return usageErrorResponse(error,Boolean(user));
 }

 let businessContext:OrbyContext|undefined,retailContext:RetailEvidence|undefined;
 try{
  if(user&&scope?.serviceCode==='MADAR_RETAIL')retailContext=await retailEvidence(user.id,scope.organizationId);
  else if(user&&scope)businessContext=scalar<OrbyContext>(await fetcher('/rest/v1/rpc/orby_business_context',{method:'POST',body:JSON.stringify({target_organization:scope.organizationId})}));
 }catch(error){
  console.error('ORBY scoped context failed',{service:scope?.serviceCode||null,name:error instanceof Error?error.name:'unknown'});
  return NextResponse.json({error:'تعذر تحميل بيانات الخدمة المصرح بها. لم يتم خلطها بسياق آخر.',code:'ORBY_CONTEXT_UNAVAILABLE'},{status:503});
 }
 if(user){
  try{usage=scalar<Usage>(await fetcher('/rest/v1/rpc/consume_orby_account_quota',{method:'POST',body:JSON.stringify({submitted_characters:prompt.length})}));}
  catch(error){return usageErrorResponse(error,true);}
 }
 if(!usage)return NextResponse.json({error:'تعذر التحقق من استخدام أوربي الآن.',code:'ORBY_USAGE_UNAVAILABLE'},{status:503});

 const sector=retailContext?'commerce':businessContext?mapBusinessSector(businessContext.activity?.family||businessContext.activity?.type):'general';
 const dialogue=new OrbyDialogueManager().decide({message:prompt,sector,hasWorkspaceContext:Boolean(scope),hasTargetEntity:Boolean(scope)}),mode=internalMode(dialogue.classification.intent);
 const contextSources:OrbyContextSource[]=[currentTimeSource()];
 if(businessContext)contextSources.push(businessSource(mode,businessContext));
 if(retailContext)contextSources.push(retailSource(retailContext));
 if(user&&!scope&&conversationId){
  const rows=await fetcher(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=role,content&order=created_at.desc,id.desc&limit=24`) as Array<{role:string;content:string}>;
  if(rows.length)contextSources.push(historySource(rows.reverse()));
 }

 const encoder=new TextEncoder(),headers:Record<string,string>={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'};
 if(!user&&guestId&&guestIsNew)headers['Set-Cookie']=`madar-orby-guest=${guestId}; Path=/; Max-Age=2592000; SameSite=Lax; Secure; HttpOnly`;
 const stream=new ReadableStream<Uint8Array>({async start(controller){
  let closed=false,hasDelta=false,finalText='',kernelResponse:OrbyKernelResponse|undefined,source:'ai'|'smart-fallback'='ai';
  const send=(event:string,data:unknown)=>{if(closed)return;try{controller.enqueue(encoder.encode(encode(event,data)));}catch{closed=true;}};
  const close=()=>{if(closed)return;closed=true;try{controller.close();}catch{}};
  send('status',{stage:'accepted',label:'تم استلام رسالتك'});send('dialogue',{intent:dialogue.classification.intent,strategy:dialogue.strategy,sector:dialogue.classification.sector,sensitivity:dialogue.classification.sensitivity});
  try{
   const policies=[...dialogue.systemPolicies,orbySystemPrompt({hasWorkspaceContext:Boolean(scope),serviceCode:scope?.serviceCode})];
   const foundation=scope&&user?await createServerOrbyFoundation({contextSources,configuration:{systemPolicies:policies}}):await createAccountOrbyFoundation({contextSources,configuration:{systemPolicies:policies}});
   const identity={organizationId:scope?.organizationId||user?.id||guestId||'guest',userId:user?.id||guestId||'guest',workspaceId:retailContext?.workspace.id||scope?.organizationId};
   const kernelRequest={identity,message:`استراتيجية الرد: ${dialogue.strategy}.\nنية الطلب المكتشفة تلقائيًا: ${dialogue.classification.intent}.\n\nرسالة المستخدم:\n${prompt}`,requiredCapabilities:['text'] as const,metadata:{purpose:scope?'orby-scoped-chat':'orby-general-chat',mode,intent:dialogue.classification.intent,serviceCode:scope?.serviceCode||null},signal:request.signal};
   if(retailContext){
    send('status',{stage:'context',label:'أراجع بيانات Retail المصرح بها'});
    const grounded=buildGroundedAnswer(prompt,retailContext.snapshot,retailContext.customers,retailContext.suppliers),generated=await foundation.kernel.execute(kernelRequest),candidate=generated.text.trim();
    kernelResponse=generated;finalText=candidate&&answerUsesOnlyEvidence(candidate,retailContext)?candidate:grounded.fallbackAnswer;
    for(let index=0;index<finalText.length;index+=36){hasDelta=true;send('delta',{text:finalText.slice(index,index+36)});}
   }else{
    send('status',{stage:'routing',label:scope?'أستخدم سياق خدمتك الحالية':'أجهز الإجابة'});
    for await(const event of foundation.kernel.stream(kernelRequest)){
     if(request.signal.aborted){close();return;}
     if(event.type==='start')send('start',{requestId:event.requestId,sessionId:event.sessionId,providerId:event.providerId,modelId:event.modelId});
     else if(event.type==='delta'){hasDelta=true;finalText+=event.text;send('delta',{text:event.text});}
     else if(event.type==='usage')send('usage',{usage:event.usage});
     else if(event.type==='end'){kernelResponse=event.response;finalText=event.response.text;}
    }
   }
  }catch(error){
   if(request.signal.aborted){close();return;}
   if(hasDelta){send('error',publicOrbyError(error));close();return;}
   console.warn('ORBY provider unavailable; using safe fallback',{code:isOrbyError(error)?error.code:error instanceof Error?error.name:'unknown'});source='smart-fallback';
   if(retailContext)finalText=buildGroundedAnswer(prompt,retailContext.snapshot,retailContext.customers,retailContext.suppliers).fallbackAnswer;
   else if(businessContext)finalText=deterministicOrbyResponse(mode==='GENERAL'?'ANALYZE':mode,businessContext,prompt);
   else finalText=deterministicGeneralOrbyResponse(prompt);
   send('status',{stage:'responding',label:'أستخدم الاستجابة الآمنة المتاحة'});send('delta',{text:finalText});
  }
  try{
   if(user){
    const saved=await fetcher('/rest/v1/rpc/save_orby_exchange',{method:'POST',body:JSON.stringify({target_organization:scope?.organizationId||null,target_conversation:conversationId,conversation_title:prompt.slice(0,120),conversation_mode:mode,user_prompt:prompt,assistant_response:finalText,response_source:source,response_metadata:{runtime:kernelResponse?'orby-core-unified':'safe-fallback',kernel_session_id:kernelResponse?.sessionId||null,provider_id:kernelResponse?.providerId||null,model_id:kernelResponse?.modelId||null,prompt_version:dialogue.promptVersion,intent:dialogue.classification.intent,sector:dialogue.classification.sector,strategy:dialogue.strategy,service_code:scope?.serviceCode||null,workspace_id:retailContext?.workspace.id||scope?.organizationId||null}})});
    conversationId=scalar<string>(saved);
   }
   if(scope)send('citations',{items:[{label:scope.serviceCode==='MADAR_RETAIL'?'بيانات MADAR Retail':'بيانات مساحة العمل',source:scope.serviceCode==='CONNECT_EXISTING'?'النظام المرتبط عبر مَدار':'مَدار',certainty:'confirmed'}]});
   send('status',{stage:'completed',label:'اكتمل الرد'});send('complete',{conversationId:user?conversationId:null,remaining:usage.remaining,used:usage.used,dailyLimit:usage.daily_limit,tier:usage.tier,plusEndsAt:usage.plus_ends_at||null,source,requestId:kernelResponse?.requestId,sessionId:kernelResponse?.sessionId});close();
  }catch(error){console.error('ORBY conversation save failed',{name:error instanceof Error?error.name:'unknown'});send('error',{code:'SAVE_FAILED',message:'تم إنشاء الرد لكن تعذر حفظ المحادثة. أعد المحاولة.'});close();}
 }});
 return new Response(stream,{headers});
}
