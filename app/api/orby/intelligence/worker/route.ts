import {randomUUID,timingSafeEqual} from 'node:crypto';
import {orbyAgentWorkerConfig} from '@/src/lib/env';
import {createServerOrbyIntelligence} from '@/src/lib/orby/intelligence/server';
import {intelligenceErrorResponse} from '@/src/lib/orby/intelligence/http';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

const BATCH_SIZE=10;
const MAX_JOBS_PER_INVOCATION=100;
const TIME_BUDGET_MS=45_000;

function equal(left:string,right:string){
 const a=Buffer.from(left),b=Buffer.from(right);
 return a.length===b.length&&timingSafeEqual(a,b);
}

function authorized(request:Request){
 const expected=orbyAgentWorkerConfig().secret;
 const authorization=request.headers.get('authorization')||'';
 const provided=authorization.startsWith('Bearer ')
  ?authorization.slice(7)
  :request.headers.get('x-madar-worker-secret')||'';
 return Boolean(provided)&&equal(provided,expected);
}

async function execute(request:Request){
 try{
  if(!authorized(request)){
   return Response.json(
    {ok:false,error:{code:'UNAUTHORIZED',message:'غير مصرح بتشغيل عامل ORBY.'}},
    {status:401,headers:{'Cache-Control':'no-store'}},
   );
  }

  const intelligence=await createServerOrbyIntelligence();
  const workerId=`vercel:${request.headers.get('x-vercel-id')||randomUUID()}`;
  const startedAt=Date.now();
  const first=await intelligence.proactive.runCycle(workerId,BATCH_SIZE);
  let cycles=1;
  let scheduled=first.scheduled;
  let routedEvents=first.routedEvents;
  const processed=[...first.processed];
  let lastBatchSize=first.processed.length;

  while(
   lastBatchSize===BATCH_SIZE&&
   processed.length<MAX_JOBS_PER_INVOCATION&&
   Date.now()-startedAt<TIME_BUDGET_MS
  ){
   const limit=Math.min(BATCH_SIZE,MAX_JOBS_PER_INVOCATION-processed.length);
   const next=await intelligence.proactive.runCycle(workerId,limit);
   cycles+=1;
   scheduled+=next.scheduled;
   routedEvents+=next.routedEvents;
   processed.push(...next.processed);
   lastBatchSize=next.processed.length;
  }

  const elapsedMs=Date.now()-startedAt;
  const budgetExhausted=lastBatchSize===BATCH_SIZE&&elapsedMs>=TIME_BUDGET_MS;
  const jobLimitReached=processed.length>=MAX_JOBS_PER_INVOCATION;

  return Response.json({
   ok:true,
   scheduled,
   routedEvents,
   processed,
   cycles,
   elapsedMs,
   budgetExhausted,
   jobLimitReached,
   timestamp:new Date().toISOString(),
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return intelligenceErrorResponse(error);
 }
}

export const GET=execute;
export const POST=execute;
