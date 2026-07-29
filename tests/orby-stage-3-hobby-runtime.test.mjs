import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const worker=await readFile(new URL('../app/api/orby/intelligence/worker/route.ts',import.meta.url),'utf8');
const vercel=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));

test('Stage 3 worker uses a Hobby-compatible daily Cron schedule',()=>{
 assert.deepEqual(vercel.crons,[{
  path:'/api/orby/intelligence/worker',
  schedule:'15 0 * * *',
 }]);
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

test('Stage 3 worker remains protected by an explicit secret',()=>{
 assert.match(worker,/orbyAgentWorkerConfig\(\)\.secret/);
 assert.match(worker,/authorization\.startsWith\('Bearer '\)/);
 assert.match(worker,/status:401/);
});
