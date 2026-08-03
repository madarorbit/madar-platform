import {readFile,writeFile} from 'node:fs/promises';

const path='supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql';
let source=await readFile(path,'utf8');

const reportStart=source.indexOf('create or replace view public.restaurant_profit_report');
const reportEnd=source.indexOf('-- Hotel atomic reservation',reportStart);
if(reportStart<0||reportEnd<0)throw new Error('MADAR_V2_RESTAURANT_REPORT_BLOCK_NOT_FOUND');
const reportBefore=source.slice(reportStart,reportEnd);
const reportAfter=reportBefore
 .replace('select organization_id,count(*) filter','select o.organization_id,count(*) filter')
 .replaceAll('filter(where status not in','filter(where o.status not in')
 .replace('group by organization_id;','group by o.organization_id;');
if(!reportAfter.includes('select o.organization_id,count(*) filter')||!reportAfter.includes('filter(where o.status not in')||!reportAfter.includes('group by o.organization_id;'))throw new Error('MADAR_V2_RESTAURANT_REPORT_PATCH_INVALID');
source=source.slice(0,reportStart)+reportAfter+source.slice(reportEnd);

source=source.replace(
 "'activity_profiles','activity_profile_answers','organization_sector_packages'",
 "'activity_profiles','organization_sector_packages'",
);
if(source.includes("'activity_profiles','activity_profile_answers','organization_sector_packages'"))throw new Error('MADAR_V2_ACTIVITY_ANSWERS_STILL_IN_GENERIC_RLS');

const childMarker='-- Child tables without organization_id inherit access from their parent command.';
const activityAnswerPolicy=`-- Activity profile answers inherit tenant access from their parent profile.\nalter table public.activity_profile_answers enable row level security;\ndrop policy if exists "organization member read activity profile answers" on public.activity_profile_answers;\ncreate policy "organization member read activity profile answers" on public.activity_profile_answers for select to authenticated\nusing(exists(select 1 from public.activity_profiles p where p.id=activity_profile_id and ((select private.is_organization_member(p.organization_id)) or (select private.is_admin()))));\n\n`;
if(!source.includes(activityAnswerPolicy)){
 const childIndex=source.indexOf(childMarker);
 if(childIndex<0)throw new Error('MADAR_V2_CHILD_RLS_MARKER_NOT_FOUND');
 source=source.slice(0,childIndex)+activityAnswerPolicy+source.slice(childIndex);
}
if(!source.includes('p.id=activity_profile_id')||!source.includes('private.is_organization_member(p.organization_id)'))throw new Error('MADAR_V2_ACTIVITY_ANSWER_POLICY_INVALID');

await writeFile(path,source,'utf8');
console.log('Patched MADAR V2 production SQL ambiguities and parent-scoped RLS.');
