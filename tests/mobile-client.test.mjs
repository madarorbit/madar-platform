import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);const read=path=>readFile(new URL(path,root),'utf8');

test('MADAR Dashboard V2 continues the Expo app and ships a real mobile identity',async()=>{
 const[packageFile,lock,app,eas,env,readme]=await Promise.all(['mobile/package.json','mobile/package-lock.json','mobile/app.json','mobile/eas.json','mobile/.env.example','mobile/README.md'].map(read));
 assert.match(packageFile,/"version": "2\.0\.0"/);assert.match(lock,/"version": "2\.0\.0"/);assert.match(packageFile,/"expo": "~57\.0\.1"/);assert.match(packageFile,/@supabase\/supabase-js/);
 assert.match(app,/"version": "2\.0\.0"/);assert.match(app,/com\.orbitmadar\.mobile/);assert.match(app,/\.\/assets\/icon\.png/);assert.match(app,/"userInterfaceStyle": "automatic"/);assert.match(app,/"scheme": "madar"/);assert.match(eas,/"buildType": "apk"/);
 assert.match(readme,/تطوير مباشر لتطبيق V1/);assert.doesNotMatch(`${packageFile}\n${app}\n${eas}\n${env}\n${readme}`,/SUPABASE_SERVICE_ROLE_KEY\s*=/);
});

test('mobile V2 is modular, sector-aware, multi-workspace and responsive to app lifecycle',async()=>{
 const[app,home,reports,operations,account,types,cache]=await Promise.all(['mobile/App.tsx','mobile/src/screens/home-screen.tsx','mobile/src/screens/reports-screen.tsx','mobile/src/screens/operations-screen.tsx','mobile/src/screens/account-screen.tsx','mobile/src/types.ts','mobile/src/lib/cache.ts'].map(read));
 assert.match(app,/HomeScreen/);assert.match(app,/ReportsScreen/);assert.match(app,/OperationsScreen/);assert.match(app,/OrbyScreen/);assert.match(app,/AccountScreen/);assert.match(app,/AppState\.addEventListener/);assert.match(app,/setInterval\(refresh,60_000\)/);assert.match(app,/WorkspaceSwitcher/);
 for(const vertical of ['commerce','food_service','hospitality'])assert.match(types,new RegExp(vertical));
 assert.match(home,/sourceLabel/);assert.match(home,/آخر مزامنة/);assert.match(reports,/occupancy_rate/);assert.match(reports,/ingredient_cost/);assert.match(operations,/KITCHEN_TICKET_STATUS/);assert.match(operations,/HOUSEKEEPING_STATUS/);assert.match(account,/operatingMode/);
 assert.match(cache,/madar-dashboard-v2/);assert.match(cache,/cacheKey=\(userId:string,workspaceId:string\)/);assert.match(cache,/snapshot\.profile\.id!==userId/);assert.match(cache,/86_400_000/);
});

test('dashboard contract exposes verticals, entitlements, source of truth, health and only server-approved capabilities',async()=>{
 const route=await read('app/api/mobile/v1/dashboard/route.ts');
 assert.match(route,/authorization/);assert.match(route,/currentUser\(accessToken\)/);assert.match(route,/organization_members\?user_id=eq\./);assert.match(route,/requestedWorkspace/);assert.match(route,/pricing_subscription_snapshots/);assert.match(route,/locked_entitlements/);assert.match(route,/actionCapabilities/);assert.match(route,/orby_write_tools/);assert.match(route,/reverse_write/);assert.match(route,/integration_permission_grants/);assert.match(route,/sourceOfTruth/);assert.match(route,/sectorOperations/);assert.match(route,/restaurant_profit_report/);assert.match(route,/hotel_daily_report/);assert.match(route,/commerce_profit_report/);
 assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY|integrationDatabaseConfig/);
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

test('mobile writes are allow-listed and require entitlement, manager, preview, one-time confirmation, conflict checks and audit',async()=>{
 const[collection,item,sql,client,operations]=await Promise.all(['app/api/mobile/v2/actions/route.ts','app/api/mobile/v2/actions/[actionId]/route.ts','supabase/migrations/20260810090000_madar_dashboard_v2.sql','mobile/src/lib/api.ts','mobile/src/screens/operations-screen.tsx'].map(read));
 for(const action of ['TASK_STATUS_UPDATE','KITCHEN_TICKET_STATUS','HOUSEKEEPING_STATUS']){assert.match(collection,new RegExp(action));assert.match(sql,new RegExp(action));}
 assert.match(sql,/mobile_action_commands/);assert.match(sql,/enable row level security/);assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);assert.match(sql,/private\.assert_v2_organization_access\(target_organization,true\)/);assert.match(sql,/orby_write_tools/);assert.match(sql,/reverse_write/);assert.match(sql,/WRITE_PERMISSION_REQUIRED/);assert.match(sql,/idempotency_key/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/expires_at<=now\(\)/);assert.match(sql,/for update/);assert.match(sql,/SOURCE_VERSION_CONFLICT/);assert.match(sql,/MOBILE_VERIFICATION_FAILED/);assert.match(sql,/preview_integration_write_impl/);assert.match(sql,/confirm_integration_write_impl/);assert.match(sql,/mobile\.action\.previewed/);assert.match(sql,/mobile\.action\.confirmed/);assert.match(sql,/'before'.*'after'/s);assert.match(sql,/security_invoker=true/);assert.match(sql,/revoke all on table public\.mobile_action_commands from public,anon,authenticated/);
 assert.match(item,/decision==='confirmed'/);assert.match(item,/status\?\:\s*string/);assert.match(client,/previewAction/);assert.match(client,/decideAction/);assert.match(operations,/تأكيد التنفيذ/);assert.match(operations,/رفض/);assert.doesNotMatch(`${operations}\n${client}`,/\.from\([^)]*\)\.(insert|update|delete|upsert)\(/);
});

test('mobile ORBY uses the same V2 threads, SSE stream, citations, stop and cross-device history',async()=>{
 const[screen,client,list,conversation,stream]=await Promise.all(['mobile/src/screens/orby-screen.tsx','mobile/src/lib/api.ts','app/api/orby/conversations/route.ts','app/api/orby/conversations/[conversationId]/route.ts','app/api/orby/stream/route.ts'].map(read));
 assert.match(screen,/fetchConversations/);assert.match(screen,/fetchConversation/);assert.match(screen,/streamOrby/);assert.match(screen,/abortRef\.current\?\.abort/);assert.match(screen,/المصادر والحداثة/);assert.match(screen,/إعادة/);assert.match(screen,/تعديل وإعادة/);assert.match(screen,/فتح المعاينة الآمنة/);
 assert.match(client,/text\/event-stream/);assert.match(client,/\/api\/orby\/stream/);assert.match(client,/parseSseFrames/);assert.match(client,/getReader/);assert.match(client,/TextDecoder/);assert.match(list,/orby_conversations/);assert.match(conversation,/orby_messages/);assert.match(stream,/createServerOrbyFoundation/);assert.match(stream,/foundation\.kernel\.stream/);assert.match(stream,/save_orby_exchange/);
});

test('shared ORBY agent routes accept mobile bearer auth without weakening tenant checks',async()=>{
 const[http,plan,runs,run,approval,runtime,governance]=await Promise.all(['src/lib/orby/execution/http.ts','app/api/orby/agent/plan/route.ts','app/api/orby/agent/runs/route.ts','app/api/orby/agent/runs/[runId]/route.ts','app/api/orby/agent/approvals/[approvalId]/route.ts','src/lib/orby/execution/agent-runtime.ts','src/lib/orby/execution/governance.ts'].map(read));
 assert.match(http,/Authorization/i);assert.match(http,/currentUser\(accessToken\)/);for(const source of [plan,runs,run,approval])assert.match(source,/authenticateAgentRequest\(request\)/);assert.match(runtime,/permissions\.resolve\(input\.identity\)/);assert.match(runtime,/run\.organizationId!==identity\.organizationId/);assert.match(governance,/permissions\.canApprove|canApprove\(/);
});
