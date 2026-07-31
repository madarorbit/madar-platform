import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);const read=path=>readFile(new URL(path,root),'utf8');

test('mobile client is an Expo TypeScript APK project with no privileged secret',async()=>{
 const[packageFile,app,eas,env,readme,workflow]=await Promise.all([read('mobile/package.json'),read('mobile/app.json'),read('mobile/eas.json'),read('mobile/.env.example'),read('mobile/README.md'),read('.github/workflows/eas-apk.yml')]);
 assert.match(packageFile,/"expo": "~57\.0\.1"/);
 assert.match(packageFile,/@supabase\/supabase-js/);
 assert.match(packageFile,/expo-secure-store/);
 assert.doesNotMatch(packageFile,/@react-native-async-storage/);
 assert.match(app,/com\.orbitmadar\.mobile/);
 assert.match(app,/"icon": "\.\/assets\/icon\.png"/);
 assert.match(app,/"foregroundImage": "\.\/assets\/adaptive-icon\.png"/);
 assert.match(eas,/"buildType": "apk"/);
 assert.match(workflow,/--profile preview/);
 assert.match(workflow,/index\\\.android\\\.bundle/);
 assert.doesNotMatch(workflow,/assembleDebug/);
 assert.match(env,/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
 assert.doesNotMatch(`${packageFile}\n${app}\n${eas}\n${env}\n${readme}\n${workflow}`,/SUPABASE_SERVICE_ROLE_KEY\s*=/);
});

test('mobile experience is read-only for business data and exposes the agreed dashboard areas',async()=>{
 const app=await read('mobile/App.tsx');
 assert.match(app,/حالة العمل الآن/);
 assert.match(app,/المؤشرات السريعة/);
 assert.match(app,/الأداء المالي/);
 assert.match(app,/المساعد الذكي/);
 assert.match(app,/تطبيق عرض آمن/);
 assert.match(app,/fetchDashboard/);
 assert.match(app,/askOrby/);
 assert.match(app,/postgres_changes/);
 assert.match(app,/30_000/);
 assert.doesNotMatch(app,/\.from\([^)]*\)\.(insert|update|delete|upsert)\(/);
 assert.doesNotMatch(app,/تسجيل عملية بيع|إضافة منتج|تعديل المخزون/);
});

test('mobile dashboard authenticates with bearer token and preserves tenant RLS',async()=>{
 const[route,supabase]=await Promise.all([read('app/api/mobile/v1/dashboard/route.ts'),read('src/lib/supabase/server.ts')]);
 assert.match(route,/authorization/);
 assert.match(route,/currentUser\(accessToken\)/);
 assert.match(route,/organization_members\?user_id=eq\./);
 assert.match(route,/supabaseFetch\(.+accessToken/s);
 assert.match(route,/refresh_workspace_subscription/);
 assert.match(route,/business_products/);
 assert.match(route,/business_sales/);
 assert.match(route,/orby_insights/);
 assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY|integrationDatabaseConfig/);
 assert.match(supabase,/supabaseFetch\(path:string, init:RequestInit = \{\}, accessToken\?:string\)/);
 assert.match(supabase,/currentUser\(accessToken\?:string\)/);
});

test('mobile realtime refresh is enabled only for the dashboard source tables',async()=>{
 const migration=await read('supabase/migrations/20260731160000_mobile_dashboard_realtime.sql');
 assert.match(migration,/supabase_realtime/);
 for(const table of ['business_products','business_customers','business_sales','business_expenses','business_tasks','orby_insights']) assert.match(migration,new RegExp(table));
 assert.doesNotMatch(migration,/disable row level security|service_role/i);
});

test('ORBY endpoint accepts mobile bearer sessions without weakening web sessions',async()=>{
 const route=await read('app/api/orby/route.ts');
 assert.match(route,/requestAccessToken/);
 assert.match(route,/currentUser\(accessToken\)/);
 assert.match(route,/supabaseFetch\(path,init,accessToken\)/);
 assert.match(route,/organization_members\?organization_id=eq\./);
 assert.match(route,/consume_orby_quota/);
 assert.match(route,/save_orby_exchange/);
 assert.doesNotMatch(route,/service.role|SUPABASE_SERVICE_ROLE_KEY/i);
});
