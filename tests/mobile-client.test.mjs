import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);const read=path=>readFile(new URL(path,root),'utf8');

test('mobile client is an Expo TypeScript APK project with no privileged secret',async()=>{
 const[packageFile,app,eas,env,readme]=await Promise.all([read('mobile/package.json'),read('mobile/app.json'),read('mobile/eas.json'),read('mobile/.env.example'),read('mobile/README.md')]);
 assert.match(packageFile,/"expo": "~57\.0\.1"/);
 assert.match(packageFile,/"version": "2\.1\.0"/);
 assert.match(packageFile,/"main": "expo-router\/entry"/);
 assert.match(packageFile,/@supabase\/supabase-js/);
 assert.match(packageFile,/expo-build-properties/);
 assert.match(app,/com\.orbitmadar\.mobile/);
 assert.match(app,/adaptiveIcon/);
 assert.match(app,/expo-splash-screen/);
 assert.match(app,/enableMinifyInReleaseBuilds/);
 assert.match(app,/enableShrinkResourcesInReleaseBuilds/);
 assert.match(eas,/"buildType": "apk"/);
 assert.match(eas,/"buildType": "app-bundle"/);
 assert.match(env,/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(`${packageFile}\n${app}\n${eas}\n${env}\n${readme}`,/SUPABASE_SERVICE_ROLE_KEY\s*=/);
});

test('mobile V2 is modular, dynamic and constrains every write behind preview and confirmation',async()=>{
 const[layout,dashboard,alerts,operations,reports,orby,account,api,contracts]=await Promise.all([
  read('mobile/app/(app)/_layout.tsx'),read('mobile/app/(app)/index.tsx'),read('mobile/app/(app)/alerts.tsx'),read('mobile/app/(app)/operations.tsx'),read('mobile/app/(app)/reports.tsx'),read('mobile/app/(app)/orby.tsx'),read('mobile/app/(app)/account.tsx'),read('mobile/src/lib/api.ts'),read('packages/contracts/mobile-v2.d.ts')
 ]);
 const mobile=`${layout}\n${dashboard}\n${alerts}\n${operations}\n${reports}\n${orby}\n${account}\n${api}\n${contracts}`;
 assert.match(layout,/Tabs\.Screen name="index"/);
 assert.match(layout,/Tabs\.Screen name="alerts"/);
 assert.match(layout,/Tabs\.Screen name="operations"/);
 assert.match(layout,/Tabs\.Screen name="reports"/);
 assert.match(layout,/Tabs\.Screen name="orby"/);
 assert.match(layout,/Tabs\.Screen name="account"/);
 assert.match(dashboard,/food_service/);
 assert.match(dashboard,/hospitality/);
 assert.match(dashboard,/نظام خارجي مرتبط/);
 assert.match(contracts,/CONNECTED_EXTERNAL/);
 assert.match(alerts,/previewCommand/);
 assert.match(alerts,/confirmCommand/);
 assert.match(operations,/تم التنفيذ في النظام/);
 assert.match(operations,/تمت مزامنة مَدار/);
 assert.match(orby,/streamOrby/);
 assert.match(orby,/archiveConversation/);
 assert.match(api,/\/api\/mobile\/v2\/commands\/preview/);
 assert.match(api,/\/api\/mobile\/v2\/commands\/confirm/);
 assert.match(contracts,/PRICE_CHANGE/);
 assert.match(contracts,/PAYMENT_TRANSFER/);
 assert.match(contracts,/CONNECTOR_CREDENTIAL_CHANGE/);
 assert.doesNotMatch(mobile,/SUPABASE_SERVICE_ROLE_KEY|OPENROUTER_API_KEY|MADAR_INTEGRATION_MASTER_KEY/);
});

test('mobile dashboard authenticates with bearer token and preserves tenant RLS',async()=>{
 const[route,context,supabase]=await Promise.all([read('app/api/mobile/v2/bootstrap/route.ts'),read('src/lib/mobile/v2.ts'),read('src/lib/supabase/server.ts')]);
 assert.match(context,/authorization/);
 assert.match(context,/currentUser\(accessToken\)/);
 assert.match(context,/account_type !== 'BUSINESS'/);
 assert.match(context,/organization_members\?user_id=eq\./);
 assert.match(route,/legacyDashboard\(request\)/);
 assert.match(route,/integration_connections/);
 assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY|integrationDatabaseConfig/);
 assert.match(supabase,/supabaseFetch\(path:string, init:RequestInit = \{\}, accessToken\?:string\)/);
 assert.match(supabase,/currentUser\(accessToken\?:string\)/);
});

test('ORBY endpoint accepts mobile bearer sessions without weakening web sessions',async()=>{
 const route=await read('app/api/orby/route.ts');
 assert.match(route,/requestAccessToken/);
 assert.match(route,/currentUser\(accessToken\)/);
 assert.match(route,/supabaseFetch\(path,\s*init,\s*accessToken\)/);
 assert.match(route,/workspace_subscriptions\?organization_id=eq\./);
 assert.match(route,/service_code=in\.\(CONNECT_EXISTING,BUILD_ON_MADAR\)/);
 assert.match(route,/consume_orby_quota/);
 assert.match(route,/save_orby_exchange/);
 assert.doesNotMatch(route,/service.role|SUPABASE_SERVICE_ROLE_KEY/i);
});

test('public Android release is a signed EAS build and cannot regress to a Metro-dependent debug APK',async()=>{
 const[workflow,mobilePage,dashboardPage,rootLayout,supabaseClient,network]=await Promise.all([
  read('.github/workflows/mobile-v2-apk.yml'),read('app/mobile/page.tsx'),read('app/dashboard-app/page.tsx'),read('mobile/app/_layout.tsx'),read('mobile/src/lib/supabase.ts'),read('mobile/src/lib/network.ts')
 ]);
 assert.match(workflow,/eas build --platform android --profile preview/);
 assert.match(workflow,/unzip -tq/);
 assert.match(workflow,/mobile-v2-stable/);
 assert.doesNotMatch(workflow,/assembleDebug|app-debug\.apk|gradlew assembleDebug/);
 assert.match(mobilePage,/mobile-v2-stable\/MADAR-Mobile\.apk/);
 assert.match(dashboardPage,/mobile-v2-stable\/MADAR-Mobile\.apk/);
 assert.match(rootLayout,/watchdogExpired/);
 assert.match(rootLayout,/SplashScreen\.hideAsync/);
 assert.match(supabaseClient,/hasValidEmbeddedSupabaseConfig/);
 assert.match(supabaseClient,/8_000/);
 assert.match(network,/AbortController/);
 assert.match(network,/NetworkTimeoutError/);
});
