import {readFile,writeFile} from 'node:fs/promises';
const path='supabase/migrations/20260729190000_orby_os_v1.sql';
let sql=await readFile(path,'utf8');
const replacements=new Map([
 ["concat_ws(':',coalesce(environment,'*'),coalesce(organization_id::text,'*'),coalesce(workspace_id::text,'*'),coalesce(user_id::text,'*'))","coalesce(environment,'*')||':'||coalesce(organization_id::text,'*')||':'||coalesce(workspace_id::text,'*')||':'||coalesce(user_id::text,'*')"],
 ["concat_ws(':',coalesce(organization_id::text,'global'),coalesce(workspace_id::text,'*'))","coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')"],
 ["concat_ws(':',coalesce(organization_id::text,'global'),coalesce(workspace_id::text,'*'),coalesce(user_id::text,'*'))","coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')||':'||coalesce(user_id::text,'*')"],
]);
let changed=0;
for(const [from,to] of replacements){const count=sql.split(from).length-1;if(count){sql=sql.split(from).join(to);changed+=count;}}
if(changed!==4)throw new Error(`Expected 4 generated scope expressions, replaced ${changed}`);
await writeFile(path,sql,'utf8');
console.log('Replaced four generated scope expressions with immutable concatenation.');
