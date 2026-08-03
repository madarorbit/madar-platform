import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const snapshotPath='supabase/migrations/20260802085900_madar_v2_transition_snapshot.sql';
const platformPath='supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql';

test('V2 production transition is snapshotted before exclusive account migration',async()=>{
 const migrations=(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort();
 assert.ok(migrations.indexOf('20260802085900_madar_v2_transition_snapshot.sql')<migrations.indexOf('20260802090000_madar_v2_p0_p11_platform.sql'));
 const [snapshot,platform]=await Promise.all([readFile(snapshotPath,'utf8'),readFile(platformPath,'utf8')]);
 for(const table of ['v2_transition_membership_backups','v2_transition_subscription_backups'])assert.match(snapshot,new RegExp(`create table if not exists public\\.${table}`));
 assert.match(snapshot,/commercial_org\.type<>'STUDENT'/);
 assert.match(snapshot,/private\.restore_v2_student_membership/);
 assert.match(snapshot,/security definer[\s\S]*set search_path=''/i);
 assert.match(snapshot,/revoke all on function private\.restore_v2_student_membership[\s\S]*authenticated/i);
 assert.match(snapshot,/grant execute on function private\.restore_v2_student_membership[\s\S]*service_role/i);
 assert.match(snapshot,/enable row level security/g);
 assert.match(platform,/delete from public\.organization_members/);
});
