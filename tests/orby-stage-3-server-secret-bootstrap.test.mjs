import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('deployment database secret placeholder stays empty in GitHub and out of client code',async()=>{
 const [value,platform]=await Promise.all([
  read('src/lib/integration/deployment-secrets.ts'),
  read('src/lib/integration/platform.ts'),
 ]);
 assert.match(value,/deploymentSupabaseServiceRoleKey=''/);
 assert.match(value,/imported only by the Node\.js integration database adapter/);
 assert.match(platform,/from '\.\/deployment-secrets'/);
 assert.doesNotMatch(value,/sb_secret_|eyJ[a-zA-Z0-9_-]{20,}/);
});

test('integration database accepts only an explicit backend fallback',async()=>{
 const [env,platform]=await Promise.all([
  read('src/lib/env.ts'),
  read('src/lib/integration/platform.ts'),
 ]);
 assert.match(env,/integrationDatabaseConfig\(fallbackServiceRoleKey\?:string\)/);
 assert.match(env,/process\.env\.SUPABASE_SERVICE_ROLE_KEY\|\|fallbackServiceRoleKey/);
 assert.match(platform,/deploymentSupabaseServiceRoleKey/);
 assert.match(platform,/integrationDatabaseConfig\(deploymentSupabaseServiceRoleKey\)/);
 assert.match(platform,/from 'node:crypto'/);
});

test('Vercel production bootstrap uses a short-lived OIDC token',async()=>{
 const [bootstrap,packageJson]=await Promise.all([
  read('scripts/bootstrap-orby-vercel-secrets.mjs'),
  read('package.json'),
 ]);
 assert.match(bootstrap,/process\.env\.VERCEL_OIDC_TOKEN/);
 assert.match(bootstrap,/environment!=='production'/);
 assert.match(bootstrap,/x-madar-purpose':'vercel-oidc-build/);
 assert.match(bootstrap,/deployment-secrets\.ts/);
 assert.match(packageJson,/"prebuild": "node scripts\/bootstrap-orby-vercel-secrets\.mjs"/);
 assert.doesNotMatch(bootstrap,/olwKmVWgaLFiKwG7uCysSibmbICEyVyVakU5Ds4W2E6_V_Xtd13BQT4I0-aKCtSx/);
});

test('deployment key broker verifies signed Vercel production identity',async()=>{
 const broker=await read('supabase/functions/orby-stage-3-deployment-key/index.ts');
 assert.match(broker,/EXPECTED_BUILD_TOKEN_SHA256='[0-9a-f]{64}'/);
 assert.match(broker,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(broker,/ALLOWED_ISSUERS/);
 assert.match(broker,/EXPECTED_AUDIENCE/);
 assert.match(broker,/EXPECTED_SUBJECT/);
 assert.match(broker,/project_id/);
 assert.match(broker,/environment!=='production'/);
 assert.match(broker,/\.well-known\/jwks/);
 assert.match(broker,/crypto\.subtle\.verify/);
 assert.match(broker,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(broker,/SUPABASE_SECRET_KEYS/);
 assert.doesNotMatch(broker,/olwKmVWgaLFiKwG7uCysSibmbICEyVyVakU5Ds4W2E6_V_Xtd13BQT4I0-aKCtSx/);
});
