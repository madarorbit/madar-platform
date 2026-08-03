import {readFile,writeFile} from 'node:fs/promises';

const path='supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql';
const source=await readFile(path,'utf8');
const start=source.indexOf('create or replace view public.restaurant_profit_report');
const end=source.indexOf('-- Hotel atomic reservation',start);
if(start<0||end<0)throw new Error('MADAR_V2_RESTAURANT_REPORT_BLOCK_NOT_FOUND');
const before=source.slice(start,end);
const after=before
 .replace('select organization_id,count(*) filter','select o.organization_id,count(*) filter')
 .replace('group by organization_id;','group by o.organization_id;');
if(after===before)throw new Error('MADAR_V2_RESTAURANT_REPORT_PATCH_NOT_APPLIED');
if(!after.includes('select o.organization_id,count(*) filter')||!after.includes('group by o.organization_id;'))throw new Error('MADAR_V2_RESTAURANT_REPORT_PATCH_INVALID');
await writeFile(path,source.slice(0,start)+after+source.slice(end),'utf8');
console.log('Qualified restaurant profit report organization_id references.');
