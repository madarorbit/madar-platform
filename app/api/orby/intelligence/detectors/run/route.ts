import {NextResponse} from 'next/server';
import {currentUser} from '@/src/lib/supabase/server';
import type {OrbyDetectorKey} from '@/src/lib/orby/intelligence/contracts';
import {createServerOrbyIntelligence} from '@/src/lib/orby/intelligence/server';
import {intelligenceErrorResponse,intelligenceIdentity,object} from '@/src/lib/orby/intelligence/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
export async function POST(request:Request){try{const user=await currentUser();if(!user)return NextResponse.json({ok:false},{status:401});const body=object(await request.json()),identity=await intelligenceIdentity(user,body,{admin:true}),runtime=await createServerOrbyIntelligence(),windowEnd=typeof body.windowEnd==='string'?body.windowEnd:new Date().toISOString(),windowStart=typeof body.windowStart==='string'?body.windowStart:new Date(Date.parse(windowEnd)-86400000).toISOString(),results=await runtime.proactive.runDetectors({identity,keys:Array.isArray(body.detectors)?body.detectors.map(String) as OrbyDetectorKey[]:undefined,windowStart,windowEnd,configuration:object(body.configuration)});return NextResponse.json({ok:true,results},{headers:{'Cache-Control':'no-store'}});}catch(error){return intelligenceErrorResponse(error);}}
