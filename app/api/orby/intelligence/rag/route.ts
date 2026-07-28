import {NextResponse} from 'next/server';
import {currentUser} from '@/src/lib/supabase/server';
import {createServerOrbyIntelligence} from '@/src/lib/orby/intelligence/server';
import {intelligenceErrorResponse,intelligenceIdentity,object,requiredString} from '@/src/lib/orby/intelligence/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){try{const user=await currentUser();if(!user)return NextResponse.json({ok:false},{status:401});const body=object(await request.json()),identity=await intelligenceIdentity(user,body),runtime=await createServerOrbyIntelligence(),answer=await runtime.rag.answer({identity,question:requiredString(body.question,'ORBY_RAG_QUESTION_REQUIRED',12000),sourceIds:Array.isArray(body.sourceIds)?body.sourceIds.map(String):undefined,maximumContextCharacters:Number(body.maximumContextCharacters||12000),signal:request.signal});return NextResponse.json({ok:true,...answer},{headers:{'Cache-Control':'no-store'}});}catch(error){return intelligenceErrorResponse(error);}}
