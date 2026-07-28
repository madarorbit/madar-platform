import {NextResponse} from 'next/server';
import {currentUser} from '@/src/lib/supabase/server';
import {createServerOrbyIntelligence} from '@/src/lib/orby/intelligence/server';
import {intelligenceErrorResponse,intelligenceIdentity,object} from '@/src/lib/orby/intelligence/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request,context:{params:Promise<{insightId:string}>}){try{const user=await currentUser();if(!user)return NextResponse.json({ok:false},{status:401});const body=object(await request.json().catch(()=>({}))),identity=await intelligenceIdentity(user,body,{admin:true}),runtime=await createServerOrbyIntelligence(),{insightId}=await context.params,result=await runtime.actions.prepare({identity,insightId,signal:request.signal});return NextResponse.json({ok:true,...result},{status:202,headers:{'Cache-Control':'no-store'}});}catch(error){return intelligenceErrorResponse(error);}}
