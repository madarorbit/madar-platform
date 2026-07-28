import {currentUser} from '@/src/lib/supabase/server';
import {createServerOrbyAgentRuntime} from '@/src/lib/orby/execution/server';
import {agentErrorResponse,agentIdentity} from '@/src/lib/orby/execution/http';

export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{runId:string}>};
export async function GET(request:Request,{params}:Context){try{const user=await currentUser();if(!user)return Response.json({ok:false,error:{code:'AUTH_REQUIRED',message:'يجب تسجيل الدخول أولًا.'}},{status:401});const url=new URL(request.url),identity=agentIdentity(user,{organizationId:url.searchParams.get('organizationId'),workspaceId:url.searchParams.get('workspaceId')}),{runId}=await params,{runtime:agent}=await createServerOrbyAgentRuntime(),status=await agent.status(runId,identity);return Response.json({ok:true,...status},{headers:{'Cache-Control':'no-store'}});}catch(error){return agentErrorResponse(error);}}
export async function DELETE(request:Request,{params}:Context){try{const user=await currentUser();if(!user)return Response.json({ok:false,error:{code:'AUTH_REQUIRED',message:'يجب تسجيل الدخول أولًا.'}},{status:401});const body=await request.json().catch(()=>({})) as Record<string,unknown>,identity=agentIdentity(user,body),{runId}=await params,{runtime:agent}=await createServerOrbyAgentRuntime(),run=await agent.cancel(runId,identity);return Response.json({ok:true,run},{headers:{'Cache-Control':'no-store'}});}catch(error){return agentErrorResponse(error);}}
