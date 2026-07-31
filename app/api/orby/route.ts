import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';
import {deterministicOrbyResponse,orbyModes,orbySystemPrompt,type OrbyContext,type OrbyMode} from '@/src/lib/orby';
import type {OrbyContextSource,OrbyKernelResponse} from '@/src/lib/orby/core/contracts';
import {isOrbyError} from '@/src/lib/orby/core/errors';
import {createServerOrbyFoundation} from '@/src/lib/orby/server';

export const runtime='nodejs';
const scalar=<T,>(value:unknown)=>Array.isArray(value)?value[0] as T:value as T;
const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SupabaseFetcher=(path:string,init?:RequestInit)=>Promise<unknown>;
type LegacyMessageMetadata={metadata?:{kernel_session_id?:unknown}};

const requestAccessToken=(request:Request)=>{
 const header=request.headers.get('authorization')||'';
 const[scheme,token]=header.split(/\s+/,2);
 return scheme?.toLowerCase()==='bearer'&&token?token:undefined;
};

function businessContextSource(mode:OrbyMode,context:OrbyContext):OrbyContextSource{
 return{
  key:'madar.business-context',
  priority:100,
  async load(){
   return{
    key:'madar.business-context',
    title:'سياق الأعمال الموثق من مَدار',
    content:JSON.stringify({task:orbyModes[mode],businessContext:context}),
    priority:100,
    trusted:false,
    sensitive:true,
    metadata:{source:'madar-read-only-analytics',mode},
   };
  },
 };
}

async function legacyKernelSession(fetcher:SupabaseFetcher,organizationId:string,userId:string,conversationId:string|null){
 if(!conversationId||!uuidPattern.test(conversationId))return undefined;
 const rows=await fetcher(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}&role=eq.assistant&select=metadata&order=created_at.desc,id.desc&limit=20`) as LegacyMessageMetadata[];
 const value=rows.map(row=>row.metadata?.kernel_session_id).find(item=>typeof item==='string'&&uuidPattern.test(item));
 return typeof value==='string'&&uuidPattern.test(value)?value:undefined;
}

async function executeOrbyCore(input:{organizationId:string;userId:string;sessionId?:string;mode:OrbyMode;prompt:string;context:OrbyContext}):Promise<OrbyKernelResponse>{
 const foundation=await createServerOrbyFoundation({
  contextSources:[businessContextSource(input.mode,input.context)],
  configuration:{systemPolicies:[orbySystemPrompt()]},
 });
 const request={
  identity:{organizationId:input.organizationId,userId:input.userId,workspaceId:input.organizationId},
  sessionId:input.sessionId,
  message:`المهمة المطلوبة: ${orbyModes[input.mode]}\n\nطلب المستخدم:\n${input.prompt}`,
  requiredCapabilities:['text'] as const,
  metadata:{purpose:'orby-business',mode:input.mode},
 };
 try{return await foundation.kernel.execute(request);}
 catch(error){
  if(input.sessionId&&isOrbyError(error)&&(error.code==='SESSION_NOT_FOUND'||error.code==='SESSION_CLOSED'))return foundation.kernel.execute({...request,sessionId:undefined});
  throw error;
 }
}

export async function POST(request:Request){
 try{
  const accessToken=requestAccessToken(request);
  const fetcher:SupabaseFetcher=(path,init={})=>supabaseFetch(path,init,accessToken);
  const user=await currentUser(accessToken);if(!user)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
  const body=await request.json() as {organizationId?:string;conversationId?:string|null;mode?:OrbyMode;prompt?:string};
  const organizationId=String(body.organizationId||''),conversationId=body.conversationId?String(body.conversationId):null,mode=body.mode&&orbyModes[body.mode]?body.mode:null,prompt=String(body.prompt||'').trim();
  if(!organizationId||!mode||prompt.length<5||prompt.length>12000)return NextResponse.json({error:'اكتب طلبًا واضحًا بين 5 و12000 حرف.'},{status:400});
  const membership=await fetcher(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=organization_id,organizations(type,status)`) as Array<{organizations?:{type?:string;status?:string}}>;
  if(!membership?.[0]?.organizations||membership[0].organizations.type==='STUDENT'||membership[0].organizations.status!=='active')return NextResponse.json({error:'لا تملك صلاحية استخدام أوربي في هذه المساحة.'},{status:403});
  const usage=scalar<{requests:number;remaining:number}>(await fetcher('/rest/v1/rpc/consume_orby_quota',{method:'POST',body:JSON.stringify({target_organization:organizationId,submitted_characters:prompt.length})}));
  const context=scalar<OrbyContext>(await fetcher('/rest/v1/rpc/orby_business_context',{method:'POST',body:JSON.stringify({target_organization:organizationId})}));
  let text:string,source:'ai'|'smart-fallback'='ai',providerUnavailable=false,kernelResponse:OrbyKernelResponse|undefined;
  try{
   const sessionId=await legacyKernelSession(fetcher,organizationId,user.id,conversationId);
   kernelResponse=await executeOrbyCore({organizationId,userId:user.id,sessionId,mode,prompt,context});
   text=kernelResponse.text.trim();if(!text)throw new Error('EMPTY_ORBY_RESPONSE');
  }catch(error){
   providerUnavailable=true;
   console.warn('ORBY provider unavailable; using deterministic fallback',{code:isOrbyError(error)?error.code:error instanceof Error?error.name:'unknown'});
   source='smart-fallback';text=deterministicOrbyResponse(mode,context,prompt);
  }
  const saved=await fetcher('/rest/v1/rpc/save_orby_exchange',{method:'POST',body:JSON.stringify({target_organization:organizationId,target_conversation:conversationId,conversation_title:prompt.slice(0,120),conversation_mode:mode,user_prompt:prompt,assistant_response:text,response_source:source,response_metadata:{provider_unavailable:providerUnavailable,runtime:kernelResponse?'orby-core':'deterministic-fallback',kernel_session_id:kernelResponse?.sessionId||null,provider_id:kernelResponse?.providerId||null,model_id:kernelResponse?.modelId||null}})});
  const savedConversationId=scalar<string>(saved);
  return NextResponse.json({text,source,conversationId:savedConversationId,remaining:usage?.remaining??0});
 }catch(error){
  const message=error instanceof Error?error.message:'unknown';
  console.error('ORBY business assistant failed',message);
  if(message.includes('ORBY_DAILY_LIMIT'))return NextResponse.json({error:'وصلت إلى حد أوربي اليومي. يمكنك استخدامه مجددًا غدًا.'},{status:429});
  if(message.includes('NOT_AUTHORIZED'))return NextResponse.json({error:'لا تملك صلاحية الوصول إلى هذه البيانات.'},{status:403});
  return NextResponse.json({error:'تعذر تشغيل أوربي الآن. أعد المحاولة دون مشاركة معلومات حساسة.'},{status:503});
 }
}
