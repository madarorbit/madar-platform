import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const launch=fs.readFileSync('supabase/migrations/20260724070000_phase_four_launch_readiness_core.sql','utf8');
const founder=fs.readFileSync('supabase/migrations/20260724070100_phase_four_founder_control_plane.sql','utf8');
const switches=fs.readFileSync('supabase/migrations/20260724070200_phase_four_platform_switch_enforcement.sql','utf8');
const founderActions=fs.readFileSync('app/actions/founder.ts','utf8');
const founderPage=fs.readFileSync('app/admin/founder/page.tsx','utf8');
const founderUsers=fs.readFileSync('app/admin/founder/users/page.tsx','utf8');
const founderWorkspaces=fs.readFileSync('app/admin/founder/workspaces/page.tsx','utf8');
const founderSettings=fs.readFileSync('app/admin/founder/settings/page.tsx','utf8');
const founderAudit=fs.readFileSync('app/admin/founder/audit/page.tsx','utf8');
const privacy=fs.readFileSync('app/account/privacy/page.tsx','utf8');
const accountExport=fs.readFileSync('app/account/privacy/export/account/route.ts','utf8');
const workspaceExport=fs.readFileSync('app/account/privacy/export/workspace/route.ts','utf8');
const betaAdmin=fs.readFileSync('app/admin/beta-operations/page.tsx','utf8');
const attachmentRoute=fs.readFileSync('app/admin/beta-operations/attachment/[id]/route.ts','utf8');
const activity=fs.readFileSync('app/workspace/activity/page.tsx','utf8');
const proxy=fs.readFileSync('proxy.ts','utf8');
const health=fs.readFileSync('app/api/health/route.ts','utf8');
const layout=fs.readFileSync('app/layout.tsx','utf8');
const admin=fs.readFileSync('app/admin/page.tsx','utf8');

test('Beta feedback privacy and activity are tenant safe',()=>{
 assert.match(launch,/create table public\.platform_feedback/);
 assert.match(launch,/create table public\.data_privacy_requests/);
 assert.match(launch,/feedback-attachments','feedback-attachments',false/);
 assert.match(launch,/enable row level security/g);
 assert.match(launch,/private\.is_organization_member\(target_organization\)/);
 assert.match(launch,/has_organization_role\(target_organization,array\['OWNER'\]/);
 assert.match(activity,/rpc\/workspace_activity/);
});

test('founder account and privileged actions are protected in the database',()=>{
 assert.match(founder,/private\.founder_user_id/);
 assert.match(founder,/FOUNDER_ACCOUNT_PROTECTED/);
 assert.match(founder,/LAST_SUPER_ADMIN_PROTECTED/);
 for(const rpc of ['founder_update_settings','founder_update_user','founder_update_organization','founder_adjust_subscription','founder_broadcast_notification','founder_platform_overview'])assert.match(founder,new RegExp(`public\\.${rpc}`));
 assert.match(founder,/if not private\.is_super_admin\(\) then raise exception 'SUPER_ADMIN_REQUIRED'/g);
 assert.match(founderActions,/requireSuperAdmin\(\)/g);
 assert.match(founderUsers,/الحساب المؤسس المحمي/);
});

test('founder can control accounts workspaces subscriptions store and platform settings',()=>{
 for(const path of ['/admin/founder/users','/admin/founder/workspaces','/admin/founder/settings','/admin/founder/audit','/admin/products','/admin/services','/admin/orders','/admin/local-payments'])assert.match(founderPage,new RegExp(path.replaceAll('/','\\/')));
 assert.match(founderWorkspaces,/adjustFounderSubscription/);
 assert.match(founderWorkspaces,/updateFounderOrganization/);
 assert.match(founderSettings,/saveFounderSettings/);
 assert.match(founderAudit,/audit_logs/);
 assert.match(admin,/مركز قيادة المؤسس/);
});

test('platform switches are enforced below the UI',()=>{
 assert.match(founder,/create table public\.platform_settings/);
 for(const flag of ['beta_registration_open','workspace_creation_enabled','store_enabled','orby_enabled','maintenance_mode'])assert.match(founder,new RegExp(flag));
 assert.match(switches,/REGISTRATION_CLOSED/);
 assert.match(switches,/WORKSPACE_CREATION_CLOSED/);
 assert.match(switches,/STORE_DISABLED/);
 assert.match(switches,/ORBY_DISABLED/);
 assert.match(proxy,/maintenanceRedirect/);
 assert.match(layout,/PlatformStatusBar/);
});

test('privacy exports require authenticated ownership and omit public file access',()=>{
 assert.match(privacy,/تنزيل بيانات الحساب الآن/);
 assert.match(privacy,/حذف حسابي/);
 assert.match(privacy,/حذف مساحتي/);
 assert.match(accountExport,/currentUser\(\)/);
 assert.match(accountExport,/Content-Disposition/);
 assert.match(workspaceExport,/role=eq\.OWNER/);
 assert.match(workspaceExport,/business_products/);
 assert.doesNotMatch(workspaceExport,/service_role/i);
});

test('Beta operations and attachments are admin controlled',()=>{
 assert.match(betaAdmin,/requireAdmin\(\)/);
 assert.match(betaAdmin,/updateBetaFeedback/);
 assert.match(betaAdmin,/reviewPrivacyRequest/);
 assert.match(attachmentRoute,/requireAdmin\(\)/);
 assert.match(attachmentRoute,/signedFeedbackAttachment/);
});

test('launch health endpoint is public and secret free',()=>{
 assert.match(health,/platform_settings/);
 assert.match(health,/database:'connected'/);
 assert.match(health,/beta-1(?:\.0\.0)?/);
 assert.doesNotMatch(health,/service_role|secret_key/i);
});
