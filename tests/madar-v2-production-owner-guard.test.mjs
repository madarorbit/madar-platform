import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';

const read=(name)=>readFile(`supabase/migrations/${name}`,'utf8');

test('V2 owner transition is scoped then strict protection is restored',async()=>{
 const files=(await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort();
 const snapshot='20260802085900_madar_v2_transition_snapshot.sql';
 const scoped='20260802085930_madar_v2_transition_owner_guard.sql';
 const platform='20260802090000_madar_v2_p0_p11_platform.sql';
 const restored='20260802090100_madar_v2_restore_owner_guard.sql';
 assert.ok(files.indexOf(snapshot)<files.indexOf(scoped));
 assert.ok(files.indexOf(scoped)<files.indexOf(platform));
 assert.ok(files.indexOf(platform)<files.indexOf(restored));
 const [guard,restore]=await Promise.all([read(scoped),read(restored)]);
 assert.match(guard,/v2_transition_membership_backups/);
 assert.match(guard,/student_org\.type='STUDENT'/);
 assert.match(guard,/commercial_org\.type<>'STUDENT'/);
 assert.match(guard,/backup\.restored_at is null/);
 assert.match(guard,/raise exception 'An organization must retain an owner'/);
 assert.doesNotMatch(restore,/v2_transition_membership_backups/);
 assert.match(restore,/raise exception 'An organization must retain an owner'/);
});

test('V2 external reverse writes remain globally fail-closed until a real pilot',async()=>{
 const sql=await read('20260802090200_madar_v2_external_write_fail_closed.sql');
 assert.match(sql,/'integration_write_enabled'/);
 assert.match(sql,/false/);
 assert.match(sql,/'activation_requires_real_pilot',true/);
 assert.match(sql,/'required_stable_days',7/);
 assert.match(sql,/v2\.integration\.external_write_fail_closed/);
});
