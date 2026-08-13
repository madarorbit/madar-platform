import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');

test('unified ORBY conversation history remains user-owned and service scopes remain tenant checked',async()=>{
 const[sidebar,conversations,feedback,legacyConversationMigration,unifiedMigration,accountPage,workspaceRedirect,retailRedirect]=await Promise.all([
  'components/orby/OrbyConversationSidebar.tsx',
  'app/api/orby/conversations/route.ts',
  'app/api/orby/feedback/route.ts',
  'supabase/migrations/20260804070000_orby_v2_o1_o3_conversation_model.sql',
  'supabase/migrations/20260812230015_orby_unified_account_plus.sql',
  'app/orby/page.tsx',
  'app/workspace/orby/page.tsx',
  'app/retail/workspace/orby/page.tsx',
 ].map(read));
 assert.match(sidebar,/بحث في المحادثات/);
 assert.match(sidebar,/تسمية/);
 assert.match(sidebar,/أرشفة/);
 assert.match(sidebar,/حذف/);
 assert.match(conversations,/currentUser/);
 assert.match(conversations,/user_id=eq/);
 assert.match(conversations,/conversationId/);
 assert.match(feedback,/organization_members/);
 assert.match(feedback,/user_id=eq/);
 assert.match(legacyConversationMigration,/orby_message_feedback/);
 assert.match(legacyConversationMigration,/status in \('sending','streaming','completed','failed','stopped'\)/);
 assert.match(unifiedMigration,/orby account conversations/);
 assert.match(unifiedMigration,/organization_id is null or private\.is_organization_member\(organization_id\)/);
 assert.match(accountPage,/OrbyConversationSidebar/);
 assert.match(accountPage,/organization_id/);
 assert.match(accountPage,/service_code/);
 for(const redirectPage of [workspaceRedirect,retailRedirect])assert.match(redirectPage,/redirect\(`\/orby\?/);
});
