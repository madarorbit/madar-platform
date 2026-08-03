import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';
import {deterministicOrbyResponse,orbyModes,orbySystemPrompt,type OrbyContext,type OrbyMode} from '@/src/lib/orby';
import type {OrbyContextSource,OrbyKernelResponse} from '@/src/lib/orby/core/contracts';
import type {OrbyConversationStreamEvent} from '@/src/lib/orby/conversation';
import {isOrbyError,publicOrbyError} from '@/src/lib/orby/core/errors';
import {createServerOrbyFoundation} from '@/src/lib/orby/server';
import {mapBusinessSector,OrbyDialogueManager} from '@/src/lib/orby/personality';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const scalar=<T,>(value:unknown)=>Array.isArray(value)?value[0] as T:value as T;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SupabaseFetcher=(path:string,init?:RequestInit)=>Promise<unknown>;
type LegacyMessageMetadata={metadata?:{kernel_session_id?:unknown}};
const accessTokenFrom=(request:Request)=>{const header=request.headers.get('authorization')||'';const[scheme,token]=header.split(/\s+/,2);return scheme?.toLowerCase()==='bearer'&&token?token:undefined;};
const eventName=(type:OrbyConversationStreamEvent['type'])=>type;
const encodeEvent=(event:OrbyConversationStreamEvent)=>`event: ${eventName(event.type)}\ndata: ${JSON.stringify(event)}\n\n`;

function contextSource(mode:OrbyMode,context:OrbyContext):OrbyContextSource{return{key:'madar.business-context',priority:100,async load(){return{key:'madar.business-context',title:'سياق الأعمال الموثق من مَدار',content:JSON.stringify({task:orbyModes[mode],businessContext:context,sourceOfTruth:context.activity?.source_of_truth||'MADAR',generatedAt:context.analytics.generated_at}),priority:100,trusted:false,sensitive:true,metadata:{source:'madar-read-only-analytics',generatedAt:context.analytics.generated_at,mode}};}};}
async function legacySession(fetcher:SupabaseFetcher,organizationId:string,userId:string,conversationId:string|null){if(!conversationId||!uuidPattern.test(conversationId))return undefined;const rows=await fetcher(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&role=eq.assistant&select=metadata&order=created_at.desc,id.desc&limit=20`) as LegacyMessageMetadata[];const value=rows.map(row=>row.metadata?.kernel_session_id).find(item=>typeof item==='string'&&uuidPattern.test(item));return typeof value==='string'&&uuidPattern.test(value)?value:undefined;}

export async function POST(request:Request){
 const accessToken=accessTokenFrom(request),fetcher:SupabaseFetcher=(path,init={})=>supabaseFetch(path,init,accessToken),user=await currentUser(accessToken);
 if(!user)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
 let body:{organizationId?:string;conversationId?:string|null;mode?:OrbyMode;prompt?:string};try{body=await request.json();}catch{return NextResponse.json({error:'صيغة الطلب غير صالحة.'},{status:400});}
 const organizationId=String(body.organizationId||''),conversationId=body.conversationId?String(body.conversationId):null,mode=body.mode&&orbyModes[body.mode]?body.mode:null,prompt=String(body.prompt||'').trim();
 if(!organizationId||!mode||prompt.length<5||prompt.length>12000)return NextResponse.json({error:'اكتب طلبًا واضحًا بين 5 و12000 حرف.'},{status:400});
 try{
  const membership=await fetcher(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=organization_id,organizations(type,status)`) as Array<{organizations?:{type?:string;status?:string}}>;
  if(!membership?.[0]?.organizations||membership[0].organizations.type==='STUDENT'||membership[0].organizations.status!=='active')return NextResponse.json({error:'لا تملك صلاحية استخدام أوربي في هذه المساحة.'},{status:403});
  const usage=scalar<{requests:number;remaining:number}>(await fetcher('/rest/v1/rpc/consume_orby_quota',{method:'POST',body:JSON.stringify({target_organization:organizationId,submitted_characters:prompt.length})})),context=scalar<OrbyContext>(await fetcher('/rest/v1/rpc/orby_business_context',{method:'POST',body:JSON.stringify({target_organization:organizationId})}));
  const dialogue=new OrbyDialogueManager().decide({message:prompt,sector:mapBusinessSector(context.activity?.family||context.activity?.type),hasWorkspaceContext:true,hasTargetEntity:true}),kernelSessionId=await legacySession(fetcher,organizationId,user.id,conversationId),foundation=await createServerOrbyFoundation({contextSources:[contextSource(mode,context)],configuration:{systemPolicies:[...dialogue.systemPolicies,orbySystemPrompt()]}});
  const kernelRequest={identity:{organizationId,userId:user.id,workspaceId:organizationId},sessionId:kernelSessionId,message:`استراتيجية الرد: ${dialogue.strategy}.\nنية الطلب: ${dialogue.classification.intent}.\nالمهمة المطلوبة: ${orbyModes[mode]}\n\nطلب المستخدم:\n${prompt}`,requiredCapabilities:['text'] as const,metadata:{purpose:'orby-business',mode,promptVersion:dialogue.promptVersion,intent:dialogue.classification.intent,sector:dialogue.classification.sector,sensitivity:dialogue.classification.sensitivity},signal:request.signal};
  const encoder=new TextEncoder(),stream=new ReadableStream<Uint8Array>({async start(controller){
   let hasDelta=false,finalText='',kernelResponse:OrbyKernelResponse|undefined,closed=false;
   const send=(event:OrbyConversationStreamEvent)=>{if(closed)return;try{controller.enqueue(encoder.encode(encodeEvent(event)));}catch{closed=true;}};
   const close=()=>{if(closed)return;closed=true;try{controller.close();}catch{}};
   send({type:'status',stage:'accepted',label:'تم استلام طلبك'});
   send({type:'dialogue',decision:{intent:dialogue.classification.intent,operation:dialogue.classification.operation,sector:dialogue.classification.sector,sensitivity:dialogue.classification.sensitivity,confidence:dialogue.classification.confidence,strategy:dialogue.strategy,requiresClarification:dialogue.requiresClarification,clarificationQuestion:dialogue.clarificationQuestion,promptVersion:dialogue.promptVersion}});
   send({type:'status',stage:'context',label:'أراجع بيانات مساحة العمل المصرح بها'});
   try{
    send({type:'status',stage:'routing',label:'أختار المسار الأنسب للطلب'});
    for await(const event of foundation.kernel.stream(kernelRequest)){
     if(request.signal.aborted){close();return;}
     if(event.type==='start')send({type:'start',requestId:event.requestId,sessionId:event.sessionId,providerId:event.providerId,modelId:event.modelId});
     else if(event.type==='delta'){if(!hasDelta)send({type:'status',stage:'responding',label:'أجهز الإجابة'});hasDelta=true;finalText+=event.text;send({type:'delta',text:event.text});}
     else if(event.type==='usage')send({type:'usage',usage:event.usage});
     else if(event.type==='end'){kernelResponse=event.response;finalText=event.response.text;}
    }
   }catch(error){
    if(request.signal.aborted){close();return;}
    if(hasDelta){const publicError=publicOrbyError(error);send({type:'error',...publicError});close();return;}
    console.warn('ORBY streaming provider unavailable; using deterministic fallback',{code:isOrbyError(error)?error.code:error instanceof Error?error.name:'unknown'});finalText=deterministicOrbyResponse(mode,context,prompt);send({type:'status',stage:'responding',label:'أستخدم التحليل المحلي الآمن'});send({type:'delta',text:finalText});
   }
   try{
    send({type:'status',stage:'saving',label:'أحفظ المحادثة بأمان'});
    const source:'ai'|'smart-fallback'=kernelResponse?'ai':'smart-fallback',saved=await fetcher('/rest/v1/rpc/save_orby_exchange',{method:'POST',body:JSON.stringify({target_organization:organizationId,target_conversation:conversationId,conversation_title:prompt.slice(0,120),conversation_mode:mode,user_prompt:prompt,assistant_response:finalText,response_source:source,response_metadata:{runtime:kernelResponse?'orby-core-stream':'deterministic-fallback',kernel_session_id:kernelResponse?.sessionId||null,provider_id:kernelResponse?.providerId||null,model_id:kernelResponse?.modelId||null,prompt_version:dialogue.promptVersion,intent:dialogue.classification.intent,operation:dialogue.classification.operation,sector:dialogue.classification.sector,sensitivity:dialogue.classification.sensitivity,strategy:dialogue.strategy,generated_at:context.analytics.generated_at,source_of_truth:context.activity?.source_of_truth||'MADAR'}})}),savedConversationId=scalar<string>(saved);
    send({type:'citations',items:[{type:'citation',label:'مؤشرات مساحة العمل',source:context.activity?.source_of_truth==='EXTERNAL'?'النظام المرتبط عبر MADAR Connect':'مَدار',lastSyncedAt:context.analytics.generated_at,certainty:'confirmed',href:'/workspace/analytics'}]});
    send({type:'status',stage:'completed',label:'اكتمل الرد'});send({type:'complete',conversationId:savedConversationId,remaining:usage?.remaining??0,source,requestId:kernelResponse?.requestId,sessionId:kernelResponse?.sessionId});close();
   }catch(error){const publicError=publicOrbyError(error);send({type:'error',...publicError});close();}
  }});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
 }catch(error){const message=error instanceof Error?error.message:'unknown';console.error('ORBY stream initialization failed',message);if(message.includes('ORBY_DAILY_LIMIT'))return NextResponse.json({error:'وصلت إلى حد أوربي اليومي. يمكنك استخدامه مجددًا غدًا.'},{status:429});return NextResponse.json({error:'تعذر تشغيل أوربي الآن. أعد المحاولة دون مشاركة معلومات حساسة.'},{status:503});}
}
