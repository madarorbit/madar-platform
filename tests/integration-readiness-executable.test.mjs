import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

function runReadinessSmoke(){return new Promise((resolve,reject)=>{
 const child=spawn(process.platform==='win32'?'npx.cmd':'npx',['tsx','scripts/run-integration-readiness-smoke.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
 child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error(`Readiness smoke exited ${code}\n${stderr}\n${stdout}`)));
 });}

test('executable integration readiness suite passes against synthetic connectors',async()=>{
 const {stdout,stderr}=await runReadinessSmoke();assert.equal(stderr.trim(),'');const report=JSON.parse(stdout);assert.equal(report.status,'passed');assert.equal(report.failed,0);assert.ok(report.total>=14);assert.equal(report.passed,report.total);
 for(const key of ['workspace-isolation','secret-encryption','historical-sync','incremental-only','resume-after-failure','deduplication','udm-quality-isolation','technical-rest-webhook','technical-csv-excel','technical-database-readonly','technical-local-bridge-resume','key-and-oauth-expiry','connection-observability','read-only-and-extensibility'])assert.ok(report.checks.some(check=>check.key===key&&check.status==='passed'),`${key} must pass`);
});
