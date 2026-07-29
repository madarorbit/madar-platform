import {currentProfile} from '@/src/lib/supabase/server';
import {createServerOrbyOs} from '@/src/lib/orby/os/server';
import type {OrbyJsonObject} from '@/src/lib/orby/core/contracts';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{key:string}>}){
 const profile=await currentProfile();if(!profile||profile.status!=='active')return Response.json({ok:false,error:{code:'AUTH_REQUIRED',message:'يجب تسجيل الدخول بحساب نشط.'}},{status:401});
 let body:Record<string,unknown>;try{body=await request.json() as Record<string,unknown>;}catch{return Response.json({ok:false,error:{code:'INVALID_JSON',message:'بيانات الطلب غير صالحة.'}},{status:400});}
 const organizationId=String(body.organizationId||''),workspaceId=body.workspaceId?String(body.workspaceId):undefined,goal=body.goal?String(body.goal).trim():undefined,reason=body.reason?String(body.reason).trim():undefined,variables=body.variables&&typeof body.variables==='object'&&!Array.isArray(body.variables)?body.variables as OrbyJsonObject:{};
 if(!uuid.test(organizationId)||workspaceId&&!uuid.test(workspaceId))return Response.json({ok:false,error:{code:'INVALID_SCOPE',message:'معرّف المؤسسة أو مساحة العمل غير صالح.'}},{status:400});
 const key=decodeURIComponent((await params).key);if(!/^[a-z0-9][a-z0-9._-]{2,99}$/.test(key))return Response.json({ok:false,error:{code:'INVALID_WORKFLOW_KEY',message:'مفتاح Workflow غير صالح.'}},{status:400});
 try{const os=await createServerOrbyOs(),submitted=await os.workflows.submitTemplate({key,identity:{organizationId,userId:profile.id,workspaceId},goal,reason,variables,signal:request.signal});return Response.json({ok:true,workflow:{id:submitted.workflow.id,status:submitted.workflow.status},run:{id:submitted.run.id,status:submitted.run.status},templateKey:key},{status:202,headers:{'Cache-Control':'no-store'}});}catch(error){const message=error instanceof Error?error.message:'ORBY_WORKFLOW_SUBMISSION_FAILED';const status=message.includes('NOT_FOUND')?404:message.includes('FORBIDDEN')||message.includes('AUTHORIZED')?403:400;return Response.json({ok:false,error:{code:message.split(':')[0],message:'تعذر بدء Workflow وفق الصلاحيات والسياسات الحالية.'}},{status,headers:{'Cache-Control':'no-store'}});}
}
