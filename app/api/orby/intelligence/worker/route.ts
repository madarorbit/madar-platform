import {randomUUID,timingSafeEqual} from 'node:crypto';
import {orbyAgentWorkerConfig} from '@/src/lib/env';
import {createServerOrbyIntelligence} from '@/src/lib/orby/intelligence/server';
import {intelligenceErrorResponse} from '@/src/lib/orby/intelligence/http';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=60;
function equal(left:string,right:string){const a=Buffer.from(left),b=Buffer.from(right);return a.length===b.length&&timingSafeEqual(a,b);}
function authorized(request:Request){const expected=orbyAgentWorkerConfig().secret,authorization=request.headers.get('authorization')||'',provided=authorization.startsWith('Bearer ')?authorization.slice(7):request.headers.get('x-madar-worker-secret')||'';return Boolean(provided)&&equal(provided,expected);}
async function execute(request:Request){try{if(!authorized(request))return Response.json({ok:false,error:{code:'UNAUTHORIZED',message:'غير مصرح بتشغيل عامل ORBY.'}},{status:401,headers:{'Cache-Control':'no-store'}});const runtime=await createServerOrbyIntelligence(),workerId=`vercel:${request.headers.get('x-vercel-id')||randomUUID()}`,result=await runtime.proactive.runCycle(workerId,5);return Response.json({ok:true,...result,timestamp:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}catch(error){return intelligenceErrorResponse(error);}}
export const GET=execute;export const POST=execute;
