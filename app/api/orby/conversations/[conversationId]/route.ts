import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenFrom=(request:Request)=>{const header=request.headers.get('authorization')||'';const[scheme,token]=header.split(/\s+/,2);return scheme?.toLowerCase()==='bearer'&&token?token:undefined;};

type StoredMessage={id:string;conversation_id:string;role:'user'|'assistant';content:string;source:'ai'|'smart-fallback';status:'sending'|'streaming'|'completed'|'failed'|'stopped';created_at:string;parent_message_id:string|null;content_parts:unknown[];metadata:Record<string,unknown>};

export async function GET(request:Request,{params}:{params:Promise<{conversationId:string}>}){
 const token=tokenFrom(request),user=await currentUser(token);if(!user)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
 const{conversationId}=await params,url=new URL(request.url),organizationId=String(url.searchParams.get('organizationId')||'');
 if(!uuid.test(conversationId)||!uuid.test(organizationId))return NextResponse.json({error:'معرّف المحادثة أو المساحة غير صالح.'},{status:400});
 try{
  const memberships=await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=organization_id,organizations(type,status)`,{},token) as Array<{organizations?:{type?:string;status?:string}}>;
  if(memberships[0]?.organizations?.status!=='active'||memberships[0]?.organizations?.type==='STUDENT')return NextResponse.json({error:'لا تملك صلاحية هذه المساحة.'},{status:403});
  const conversations=await supabaseFetch(`/rest/v1/orby_conversations?id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&deleted_at=is.null&select=id,organization_id,title,status,last_message_at,created_at&limit=1`,{},token) as Array<{id:string;organization_id:string;title:string;status:'active'|'archived';last_message_at:string;created_at:string}>;
  const conversation=conversations[0];if(!conversation)return NextResponse.json({error:'المحادثة غير موجودة أو لا تملك صلاحيتها.'},{status:404});
  const rows=await supabaseFetch(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,conversation_id,role,content,source,status,created_at,parent_message_id,content_parts,metadata&order=created_at.asc,id.asc&limit=200`,{},token) as StoredMessage[];
  const messages=rows.map(message=>{
   const observedAt=typeof message.metadata?.generated_at==='string'?message.metadata.generated_at:null,sourceOfTruth=message.metadata?.source_of_truth;
   return{...message,citations:message.role==='assistant'&&observedAt?[{id:`workspace-${message.id}`,label:'مؤشرات مساحة العمل',source:sourceOfTruth==='EXTERNAL'?'النظام المرتبط عبر MADAR Connect':'مَدار',href:'/workspace/analytics',observedAt,freshness:'recent',certainty:'confirmed'}]:[]};
  });
  return NextResponse.json({ok:true,conversation,messages},{headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('ORBY conversation detail failed',error instanceof Error?error.message:'unknown');return NextResponse.json({error:'تعذر تحميل المحادثة.'},{status:503});}
}
