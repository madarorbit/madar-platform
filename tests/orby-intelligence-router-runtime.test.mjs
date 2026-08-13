import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('ORBY intelligence router can switch models inside one kernel session',()=>{
 const result=spawnSync(process.execPath,['--import','tsx','scripts/run-orby-intelligence-router-smoke.ts'],{cwd:root,encoding:'utf8',env:{...process.env}});
 assert.equal(result.status,0,`router smoke failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
 assert.match(result.stdout,/ORBY_INTELLIGENCE_ROUTER_OK/);
 assert.match(result.stdout,/firstModel:\s*'fast'/);
 assert.match(result.stdout,/secondModel:\s*'deep'/);
 assert.match(result.stdout,/historyMessages:\s*4/);
});
