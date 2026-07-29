import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('deployment database secret placeholder is server-only and empty in GitHub',async()=>{
 const value=await read('src/lib/integration/deployment-secrets.ts');
 assert.match(value,/import 'server-only'/);
 assert.match(value,/deploymentSupabaseServiceRoleKey=''/);
 assert.doesNotMatch(value,/sb_secret_|eyJ[a-zA-Z0-9_-]{20,}/);
});

test('integration database accepts only an explicit server fallback',async()=>{
 const [env,platform]=await Promise.all([
  read('src/lib/env.ts'),
  read('src/lib/integration/platform.ts'),
 ]);
 assert.match(env,/integrationDatabaseConfig\(fallbackServiceRoleKey\?:string\)/);
 assert.match(env,/process\.env\.SUPABASE_SERVICE_ROLE_KEY\|\|fallbackServiceRoleKey/);
 assert.match(platform,/import 'server-only'/);
 assert.match(platform,/deploymentSupabaseServiceRoleKey/);
 assert.match(platform,/integrationDatabaseConfig\(deploymentSupabaseServiceRoleKey\)/);
});

test('deployment key broker uses a digest and never stores the raw build token',async()=>{
 const broker=await read('supabase/functions/orby-stage-3-deployment-key/index.ts');
 assert.match(broker,/EXPECTED_BUILD_TOKEN_SHA256='[0-9a-f]{64}'/);
 assert.match(broker,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(broker,/x-madar-purpose/);
 assert.match(broker,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(broker,/SUPABASE_SECRET_KEYS/);
 assert.doesNotMatch(broker,/olwKmVWgaLFiKwG7uCysSibmbICEyVyVakU5Ds4W2E6_V_Xtd13BQT4I0-aKCtSx/);
});
