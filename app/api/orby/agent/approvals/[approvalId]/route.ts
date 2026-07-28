import {currentUser} from '@/src/lib/supabase/server';
import {createServerOrbyAgentRuntime} from '@/src/lib/orby/execution/server';
import {agentErrorResponse,agentIdentity} from '@/src/lib/orby/execution/http';

export const runtime='nodejs';export const dynamic='force-dynamic';
type Context={params:Promise<{approvalId:string}>};
export async function POST(request:Request,{params}:Context){try{const user=await currentUser();if(!user)return Response.json({ok:false,error:{code:'AUTH_REQUIRED',message:'يجب تسجيل الدخول أولًا.'}},{status:401});const body=await request.json() as Record<string,unknown>,decision=body.decision==='approved'?'approved':body.decision==='rejected'?'rejected':null;if(!decision)return Response.json({ok:false,error:{code:'APPROVAL_REQUIRED',message:'قرار الموافقة يجب أن يكون approved أو rejected.'}},{status:400});const identity=agentIdentity(user,body),{approvalId}=await params,{runtime:agent}=await createServerOrbyAgentRuntime(),approval=await agent.decideApproval({approvalId,identity,decision,reason:String(body.reason||'')||undefined});return Response.json({ok:true,approval},{headers:{'Cache-Control':'no-store'}});}catch(error){return agentErrorResponse(error);}}
