import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');

test('ORBY V2 conversation history and feedback remain tenant scoped',async()=>{const[sidebar,conversations,feedback,migration,page]=await Promise.all(['components/orby/OrbyConversationSidebar.tsx','app/api/orby/conversations/route.ts','app/api/orby/feedback/route.ts','supabase/migrations/20260804070000_orby_v2_o1_o3_conversation_model.sql','app/workspace/orby/page.tsx'].map(read));assert.match(sidebar,/بحث في المحادثات/);assert.match(sidebar,/إعادة تسمية/);assert.match(sidebar,/أرشفة/);assert.match(sidebar,/حذف/);for(const source of [conversations,feedback]){assert.match(source,/organization_members/);assert.match(source,/user_id=eq/);assert.match(source,/currentUser/);}assert.match(migration,/orby_message_feedback/);assert.match(migration,/enable row level security/);assert.match(migration,/user_id=\(select auth\.uid\(\)\)/);assert.match(migration,/status in \('sending','streaming','completed','failed','stopped'\)/);assert.match(page,/OrbyConversationSidebar/);assert.match(page,/المساحة:/);assert.match(page,/المصدر:/);});
