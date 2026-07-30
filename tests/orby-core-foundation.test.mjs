import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

function runSmoke(){return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,['--import','tsx','scripts/run-orby-foundation-smoke.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error(`ORBY smoke exited ${code}\n${stderr}\n${stdout}`)));
 });}

test('ORBY stage-one core foundation passes executable acceptance',async()=>{
 const {stdout,stderr}=await runSmoke();assert.equal(stderr.trim(),'');const report=JSON.parse(stdout);assert.equal(report.status,'passed');assert.equal(report.failed,0);assert.ok(report.total>=10);assert.equal(report.passed,report.total);
 for(const key of ['provider-independence','kernel-routing-fallback','session-history-and-ownership','integration-layer-compatibility','prompt-compiler-boundary','streaming-through-kernel','central-configuration-scope','capability-guardrails','health-monitor','secret-redaction','environment-provider-composition','persistence-boundary'])assert.ok(report.checks.some(check=>check.key===key&&check.status==='passed'),`${key} must pass`);
});
