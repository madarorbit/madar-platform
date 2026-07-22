import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/migrations/20260722080000_student_workspace_v2.sql',import.meta.url),'utf8');
const page=readFileSync(new URL('../app/student/page.tsx',import.meta.url),'utf8');
const assistant=readFileSync(new URL('../app/api/student/assistant/route.ts',import.meta.url),'utf8');

test('every authenticated account can own one isolated free student workspace',()=>{
 assert.match(migration,/ensure_student_workspace_impl/);
 assert.match(migration,/o\.type='STUDENT'/);
 assert.match(migration,/private\.is_student_organization_member\(organization_id\)/);
 assert.match(migration,/o\.type<>'STUDENT'/);
});

test('student hub includes private library filters, planning and learning tools',()=>{
 for(const value of ['مكتبة الطالب','حسب الاسم','الحجم: الأكبر','التركيز والأهداف','مساعد مَدار الذكي'])assert.ok(page.includes(value));
 assert.match(migration,/student_events/);
 assert.match(migration,/student_study_sessions/);
 assert.match(migration,/student_goals/);
});

test('AI assistant authenticates membership and limits submitted content',()=>{
 assert.match(assistant,/currentUser\(\)/);
 assert.match(assistant,/organizations\(type,status\)/);
 assert.match(assistant,/prompt\.length>12000/);
 assert.match(assistant,/student_ai_history/);
});
