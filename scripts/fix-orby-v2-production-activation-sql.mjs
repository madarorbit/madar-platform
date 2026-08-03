import {readFile,writeFile} from 'node:fs/promises';

const path='supabase/migrations/20260804120000_orby_v2_production_activation.sql';
let source=await readFile(path,'utf8');
source=source.replace(
  'previous_version,metadata,created_at,activated_at,scope_key',
  'previous_version,metadata,created_at,activated_at',
);
source=source.replace(
  "),now(),now(),'global'\n  where not exists(",
  '),now(),now()\n  where not exists(',
);
if(source.includes('activated_at,scope_key'))throw new Error('ORBY_V2_GENERATED_SCOPE_COLUMN_STILL_INSERTED');
if(source.includes("now(),now(),'global'"))throw new Error('ORBY_V2_GENERATED_SCOPE_VALUE_STILL_INSERTED');
if(!source.includes("where r.scope_key='global'"))throw new Error('ORBY_V2_RELEASE_LOOKUP_SCOPE_MISSING');
await writeFile(path,source,'utf8');
console.log('Removed generated scope_key from ORBY V2 release insert.');
