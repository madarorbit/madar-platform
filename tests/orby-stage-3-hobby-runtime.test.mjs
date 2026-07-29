import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const worker=await read('app/api/orby/intelligence/worker/route.ts');
const vercel=JSON.parse(await read('vercel.json'));
const scheduler=await read('supabase/migrations/20260729001500_orby_stage_3_supabase_worker_scheduler.sql');

test('Stage 3 scheduling is independent from Vercel Hobby Cron limits',()=>{
 assert.deepEqual(vercel,{});
 assert.match(scheduler,/create extension if not exists pg_cron/);
 assert.match(scheduler,/create extension if not exists pg_net/);
 assert.match(scheduler,/orby-stage3-worker-hourly/);
 assert.match(scheduler,/'7 \* \* \* \*'/);
 assert.match(scheduler,/vault\.decrypted_secrets/);
 assert.match(scheduler,/x-madar-cron-token/);
 assert.doesNotMatch(scheduler,/dsSWVIwS-ibToX2bOqeGuHJxx8Rxi2JDgYTIHtR663p3XVIZVCkk9TTl8bMBMhru/);
});

test('Stage 3 worker drains more than the legacy five-job batch safely',()=>{
 assert.match(worker,/const BATCH_SIZE=10/);
 assert.match(worker,/const MAX_JOBS_PER_INVOCATION=100/);
 assert.match(worker,/const TIME_BUDGET_MS=45_000/);
 assert.match(worker,/while\s*\(/);
 assert.match(worker,/processed\.push\(\.\.\.next\.processed\)/);
 assert.match(worker,/budgetExhausted/);
 assert.match(worker,/jobLimitReached/);
 assert.doesNotMatch(worker,/runCycle\(workerId,5\)/);
});

test('Stage 3 worker supports configured secrets and a deployment-only token digest',()=>{
 assert.match(worker,/orbyAgentWorkerConfig\(\)\.secret/);
 assert.match(worker,/authorization\.startsWith\('Bearer '\)/);
 assert.match(worker,/DEPLOYMENT_CRON_TOKEN_SHA256='[0-9a-f]{64}'/);
 assert.match(worker,/createHash\('sha256'\)/);
 assert.match(worker,/headers\.get\('x-madar-cron-token'\)/);
 assert.match(worker,/searchParams\.get\('cron_token'\)/);
 assert.match(worker,/status:401/);
 assert.doesNotMatch(worker,/dsSWVIwS-ibToX2bOqeGuHJxx8Rxi2JDgYTIHtR663p3XVIZVCkk9TTl8bMBMhru/);
});
