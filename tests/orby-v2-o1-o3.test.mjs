import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

function runSmoke(){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','scripts/run-orby-v2-o1-o3-smoke.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',code=>code===0?resolve({stdout,stderr}):reject(new Error(`ORBY V2 O1-O3 smoke exited ${code}\n${stderr}\n${stdout}`)));});}

test('ORBY V2 O1-O3 acceptance gate passes',async()=>{const{stdout,stderr}=await runSmoke();assert.equal(stderr.trim(),'');const report=JSON.parse(stdout);assert.equal(report.status,'passed');assert.equal(report.failed,0);assert.ok(report.total>=8);for(const key of ['constitution-owned-by-madar','intent-information-vs-execution','personality-provider-independence','sector-terminology-isolation','core-capabilities-and-provider-contract','conversation-protocol','all-orby-chat-paths-use-core','modern-conversation-cycle','prompt-built-outside-ui'])assert.ok(report.checks.some(check=>check.key===key&&check.status==='passed'),`${key} must pass`);});
