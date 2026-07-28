import {NextResponse} from 'next/server';
import {currentUser} from '@/src/lib/supabase/server';
import type {OrbyInsight} from '@/src/lib/orby/intelligence/contracts';
import {createServerOrbyIntelligence} from '@/src/lib/orby/intelligence/server';
import {intelligenceErrorResponse,intelligenceIdentity} from '@/src/lib/orby/intelligence/http';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request){try{const user=await currentUser();if(!user)return NextResponse.json({ok:false},{status:401});const url=new URL(request.url),identity=await intelligenceIdentity(user,{organizationId:url.searchParams.get('organizationId'),workspaceId:url.searchParams.get('workspaceId')}),runtime=await createServerOrbyIntelligence(),insights=await runtime.repository.listInsights({identity,status:(url.searchParams.get('status')||undefined) as OrbyInsight['status']|undefined,limit:Math.min(100,Math.max(1,Number(url.searchParams.get('limit')||50)))});return NextResponse.json({ok:true,insights},{headers:{'Cache-Control':'no-store'}});}catch(error){return intelligenceErrorResponse(error);}}
