import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenFrom=(request:Request)=>{const header=request.headers.get('authorization')||'';const[scheme,token]=header.split(/\s+/,2);return scheme?.toLowerCase()==='bearer'&&token?token:undefined;};

export async function POST(request:Request){
 try{
  const token=tokenFrom(request),user=await currentUser(token);if(!user)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
  const body=await request.json() as {organizationId?:string;conversationId?:string;rating?:'helpful'|'problem';issueType?:string;note?:string},organizationId=String(body.organizationId||''),conversationId=String(body.conversationId||''),rating=body.rating;
  if(!uuid.test(organizationId)||!uuid.test(conversationId)||!rating||!['helpful','problem'].includes(rating))return NextResponse.json({error:'بيانات التقييم غير صالحة.'},{status:400});
  const membership=await supabaseFetch(`/rest/v1/organization_members?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&select=organization_id`,{},token) as unknown[];if(!membership[0])return NextResponse.json({error:'لا تملك صلاحية تقييم رد في هذه المساحة.'},{status:403});
  const messages=await supabaseFetch(`/rest/v1/orby_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(user.id)}&role=eq.assistant&select=id&order=created_at.desc,id.desc&limit=1`,{},token) as Array<{id:string}>;if(!messages[0])return NextResponse.json({error:'لم يتم العثور على رد أوربي المقصود.'},{status:404});
  const payload={organization_id:organizationId,conversation_id:conversationId,message_id:messages[0].id,user_id:user.id,rating,issue_type:String(body.issueType||'').slice(0,120)||null,note:String(body.note||'').slice(0,2000)||null,metadata:{source:'orby-conversation-v2'},updated_at:new Date().toISOString()};
  await supabaseFetch('/rest/v1/orby_message_feedback?on_conflict=message_id,user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)},token);return NextResponse.json({saved:true});
 }catch(error){console.error('ORBY feedback failed',error instanceof Error?error.message:'unknown');return NextResponse.json({error:'تعذر حفظ تقييم الرد.'},{status:500});}
}
