import {readFile,writeFile} from 'node:fs/promises';

const path='supabase/migrations/20260729190000_orby_os_v1.sql';
let sql=await readFile(path,'utf8');
let changed=0;

const scopeReplacements=new Map([
 ["concat_ws(':',coalesce(environment,'*'),coalesce(organization_id::text,'*'),coalesce(workspace_id::text,'*'),coalesce(user_id::text,'*'))","coalesce(environment,'*')||':'||coalesce(organization_id::text,'*')||':'||coalesce(workspace_id::text,'*')||':'||coalesce(user_id::text,'*')"],
 ["concat_ws(':',coalesce(organization_id::text,'global'),coalesce(workspace_id::text,'*'))","coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')"],
 ["concat_ws(':',coalesce(organization_id::text,'global'),coalesce(workspace_id::text,'*'),coalesce(user_id::text,'*'))","coalesce(organization_id::text,'global')||':'||coalesce(workspace_id::text,'*')||':'||coalesce(user_id::text,'*')"],
]);
for(const [from,to] of scopeReplacements){const count=sql.split(from).length-1;if(count){sql=sql.split(from).join(to);changed+=count;}}

const cascade='workspace_id uuid references public.workspaces(id) on delete cascade';
const setNull='workspace_id uuid references public.workspaces(id) on delete set null';
const cascadeCount=sql.split(cascade).length-1;
const setNullCount=sql.split(setNull).length-1;
if(cascadeCount||setNullCount){
 if(cascadeCount!==6||setNullCount!==2)throw new Error(`Expected 6 cascade and 2 set-null workspace references, found ${cascadeCount} and ${setNullCount}`);
 sql=sql.split(cascade).join('workspace_id uuid');
 sql=sql.split(setNull).join('workspace_id uuid');
 changed+=cascadeCount+setNullCount;
}

const invalidRestore="'sections',jsonb_object_keys(record.snapshot)";
const safeRestore="'sections',(select coalesce(jsonb_agg(key),'[]'::jsonb) from jsonb_object_keys(record.snapshot) as key)";
const restoreCount=sql.split(invalidRestore).length-1;
if(restoreCount){
 if(restoreCount!==1)throw new Error(`Expected one unsafe backup section expression, found ${restoreCount}`);
 sql=sql.replace(invalidRestore,safeRestore);
 changed+=1;
}

if(changed===0){console.log('ORBY OS migration already matches production database constraints.');process.exit(0);}
await writeFile(path,sql,'utf8');
console.log(`Applied ${changed} ORBY OS migration compatibility corrections.`);
