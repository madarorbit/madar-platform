import {generateText} from 'ai';
import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';
import {deterministicOrbyResponse,orbyModes,orbySystemPrompt,type OrbyContext,type OrbyMode} from '@/src/lib/orby';

export const runtime='nodejs';
const scalar=<T,>(value:unknown)=>Array.isArray(value)?value[0] as T:value as T;

export async function POST(request:Request){
 try{
  const user=await currentUser();if(!user)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
  const body=await request.json() as {organizationId?:string;conversationId?:string|null;mode?:OrbyMode;prompt?:string};
  const organizationId=String(body.organizationId||''),conversationId=body.conversationId?String(body.conversationId):null,mode=body.mode&&orbyModes[body.mode]?body.mode:null,prompt=String(body.prompt||'').trim();
  if(!organizationId||!mode||prompt.length<5||prompt.length>12000)return NextResponse.json({error:'اكتب طلبًا واضحًا بين 5 و12000 حرف.'},{status:400});
  const membership=await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=organization_id,organizations(type,status)`);
  if(!membership?.[0]?.organizations||membership[0].organizations.type==='STUDENT'||membership[0].organizations.status!=='active')return NextResponse.json({error:'لا تملك صلاحية استخدام أوربي في هذه المساحة.'},{status:403});
  const usage=scalar<{requests:number;remaining:number}>(await supabaseFetch('/rest/v1/rpc/consume_orby_quota',{method:'POST',body:JSON.stringify({target_organization:organizationId,submitted_characters:prompt.length})}));
  const context=scalar<OrbyContext>(await supabaseFetch('/rest/v1/rpc/orby_business_context',{method:'POST',body:JSON.stringify({target_organization:organizationId})}));
  let text:string,source:'ai'|'smart-fallback'='ai',providerError:string|undefined;
  try{
   const result=await generateText({
    model:'google/gemini-3-flash',
    system:orbySystemPrompt(),
    prompt:`المهمة: ${orbyModes[mode]}\n\nسؤال المستخدم:\n${prompt}\n\nسياق مساحة العمل الموثوق بصيغة JSON:\n${JSON.stringify(context)}`,
    maxOutputTokens:1800,
    providerOptions:{gateway:{user:user.id,tags:['feature:orby-business','product:madar',`mode:${mode.toLowerCase()}`]}},
   });
   text=result.text.trim();if(!text)throw new Error('EMPTY_AI_RESPONSE');
  }catch(error){
   providerError=error instanceof Error?error.message:'AI_PROVIDER_UNAVAILABLE';
   source='smart-fallback';text=deterministicOrbyResponse(mode,context,prompt);
  }
  const saved=await supabaseFetch('/rest/v1/rpc/save_orby_exchange',{method:'POST',body:JSON.stringify({target_organization:organizationId,target_conversation:conversationId,conversation_title:prompt.slice(0,120),conversation_mode:mode,user_prompt:prompt,assistant_response:text,response_source:source,response_metadata:{provider_error:providerError?providerError.slice(0,300):null}})});
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
