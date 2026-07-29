import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const BROKER_URL='https://rybzdpduwgnsjofolini.supabase.co/functions/v1/orby-stage-3-deployment-key';
const outputPath=fileURLToPath(new URL('../src/lib/integration/deployment-secrets.ts',import.meta.url));
const isVercel=process.env.VERCEL==='1';
const environment=(process.env.VERCEL_ENV||process.env.VERCEL_TARGET_ENV||'').trim();
const oidcToken=process.env.VERCEL_OIDC_TOKEN?.trim()||'';

console.log(`ORBY secure bootstrap: vercel=${isVercel}; environment=${environment||'none'}; oidc=${Boolean(oidcToken)}`);

if(!isVercel||environment!=='production'){
 console.log('ORBY secure bootstrap skipped outside a Vercel production build.');
 process.exit(0);
}

if(!oidcToken)throw new Error('VERCEL_OIDC_TOKEN is unavailable in the production build. Enable Vercel OIDC federation.');

const response=await fetch(BROKER_URL,{
 method:'POST',
 headers:{
  Authorization:`Bearer ${oidcToken}`,
  'x-madar-purpose':'vercel-oidc-build',
  'Content-Type':'application/json',
 },
 body:'{}',
});
if(!response.ok)throw new Error(`ORBY deployment key broker rejected the Vercel identity with HTTP ${response.status}.`);
const payload=await response.json();
const serviceRoleKey=typeof payload?.serviceRoleKey==='string'?payload.serviceRoleKey.trim():'';
if(!payload?.ok||serviceRoleKey.length<40||/\s/.test(serviceRoleKey))throw new Error('ORBY deployment key broker returned no usable backend key.');

await writeFile(
 outputPath,
 `/** Generated only inside the isolated Vercel production build. */\nexport const deploymentSupabaseServiceRoleKey=${JSON.stringify(serviceRoleKey)};\n`,
 {encoding:'utf8',mode:0o600},
);
console.log('ORBY backend access was injected into the isolated server build.');
