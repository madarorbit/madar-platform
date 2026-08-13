import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('ORBY persistence regression removes legacy workspace-only write guards',async()=>{
 const migration=await read('supabase/migrations/20260813001000_fix_orby_persistence_and_scoped_context.sql');
 assert.match(migration,/drop trigger if exists madar_v2_orby_access_guard on public\.orby_conversations/);
 assert.match(migration,/drop trigger if exists madar_v2_orby_access_guard on public\.orby_messages/);
 assert.match(migration,/alter function public\.orby_business_context\(uuid\) security definer/);
 assert.match(migration,/grant execute on function public\.orby_business_context\(uuid\) to authenticated/);
});

test('Retail ORBY customer and supplier summaries qualify ambiguous balances',async()=>{
 const migration=await read('supabase/migrations/20260813001000_fix_orby_persistence_and_scoped_context.sql');
 assert.match(migration,/sum\(rr\.balance_due\) as open_balance/);
 assert.match(migration,/sum\(rpay\.balance_due\) as open_balance/);
 assert.doesNotMatch(migration,/select customer_id, sum\(balance_due\)/);
 assert.doesNotMatch(migration,/select supplier_id, sum\(balance_due\)/);
});

test('MADAR Retail uses the same modern workspace-shell interaction model as MADAR Native',async()=>{
 const[layout,shell,dashboard]=await Promise.all([read('app/retail/workspace/layout.tsx'),read('components/retail-v0/layout/RetailWorkspaceShell.tsx'),read('app/retail/workspace/page.tsx')]);
 assert.match(layout,/RetailWorkspaceShell/);
 for(const contract of [/md-ux-shell/,/md-ux-sidebar/,/md-ux-topbar/,/md-mobile-bottom-nav/,/md-mobile-drawer-layer/,/ThemeToggle/,/siteConfig\.assets\.orby/])assert.match(shell,contract);
 assert.match(shell,/platformOrganizationId/);
 assert.match(shell,/\/orby\?conversation=new&organization=/);
 assert.match(dashboard,/md-card/);
 assert.match(dashboard,/md-panel/);
 assert.match(dashboard,/بيع جديد/);
});

test('customer account is segmented into focused views instead of one long service feed',async()=>{
 const account=await read('app/account/page.tsx');
 for(const view of ['overview','services','orby','account'])assert.ok(account.includes(`"${view}"`));
 assert.match(account,/viewFrom/);
 assert.match(account,/نظرة عامة/);
 assert.match(account,/الخدمات والاشتراكات/);
 assert.match(account,/سياقات الأعمال/);
 assert.match(account,/إدارة الحساب/);
 assert.match(account,/coverImage/);
});
