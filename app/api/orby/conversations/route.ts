import {NextResponse} from 'next/server';
import {currentUser,supabaseFetch} from '@/src/lib/supabase/server';

export const runtime='nodejs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenFrom=(request:Request)=>{const header=request.headers.get('authorization')||'';const[scheme,token]=header.split(/\s+/,2);return scheme?.toLowerCase()==='bearer'&&token?token:undefined;};
async function actor(request:Request){const token=tokenFrom(request),user=await currentUser(token);return user?{token,user}:null;}

export async function PATCH(request:Request){
 try{
  const auth=await actor(request);if(!auth)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
  const body=await request.json() as{conversationId?:string;action?:'rename'|'archive'|'restore';title?:string},conversationId=String(body.conversationId||'');
  if(!uuid.test(conversationId))return NextResponse.json({error:'معرّف المحادثة غير صالح.'},{status:400});
  const patch:Record<string,unknown>={updated_at:new Date().toISOString()};
  if(body.action==='rename'){const title=String(body.title||'').trim();if(title.length<2||title.length>120)return NextResponse.json({error:'عنوان المحادثة يجب أن يكون بين حرفين و120 حرفًا.'},{status:400});patch.title=title;}
  else if(body.action==='archive')patch.status='archived';else if(body.action==='restore')patch.status='active';else return NextResponse.json({error:'الإجراء غير مدعوم.'},{status:400});
  const rows=await supabaseFetch(`/rest/v1/orby_conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)},auth.token) as Array<{id:string;title:string;status:string}>;
  if(!rows[0])return NextResponse.json({error:'المحادثة غير موجودة أو لا تملك صلاحيتها.'},{status:404});
  return NextResponse.json({conversation:rows[0]});
 }catch(error){console.error('ORBY conversation update failed',{name:error instanceof Error?error.name:'unknown'});return NextResponse.json({error:'تعذر تحديث المحادثة.'},{status:500});}
}

export async function DELETE(request:Request){
 try{
  const auth=await actor(request);if(!auth)return NextResponse.json({error:'يجب تسجيل الدخول أولًا.'},{status:401});
  const conversationId=String(new URL(request.url).searchParams.get('conversationId')||'');if(!uuid.test(conversationId))return NextResponse.json({error:'معرّف المحادثة غير صالح.'},{status:400});
  const rows=await supabaseFetch(`/rest/v1/orby_conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(auth.user.id)}&select=id`,{},auth.token) as Array<{id:string}>;
  if(!rows[0])return NextResponse.json({error:'المحادثة غير موجودة أو لا تملك صلاحيتها.'},{status:404});
  await supabaseFetch(`/rest/v1/orby_conversations?id=eq.${encodeURIComponent(conversationId)}&user_id=eq.${encodeURIComponent(auth.user.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}},auth.token);
  return NextResponse.json({deleted:true});
 }catch(error){console.error('ORBY conversation delete failed',{name:error instanceof Error?error.name:'unknown'});return NextResponse.json({error:'تعذر حذف المحادثة وفق سياسة البيانات الحالية.'},{status:500});}
}
