import {readFile,writeFile} from 'node:fs/promises';
const replacements=[
 {file:'supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql',from:`create or replace view public.restaurant_profit_report with (security_invoker=true) as
select organization_id,count(*) filter(where status not in ('CANCELLED','OPEN')) completed_orders,
 coalesce(sum(total) filter(where status not in ('CANCELLED','OPEN')),0) revenue,
 coalesce(sum(ingredient_cost) filter(where status not in ('CANCELLED','OPEN')),0) ingredient_cost,
 coalesce(sum(total-ingredient_cost) filter(where status not in ('CANCELLED','OPEN')),0) gross_profit,
 coalesce(avg(extract(epoch from (k.ready_at-k.opened_at))/60) filter(where k.ready_at is not null),0) avg_ticket_minutes
from public.restaurant_orders o left join public.restaurant_kitchen_tickets k on k.restaurant_order_id=o.id group by organization_id;`,to:`create or replace view public.restaurant_profit_report with (security_invoker=true) as
select o.organization_id,count(*) filter(where o.status not in ('CANCELLED','OPEN')) completed_orders,
 coalesce(sum(o.total) filter(where o.status not in ('CANCELLED','OPEN')),0) revenue,
 coalesce(sum(o.ingredient_cost) filter(where o.status not in ('CANCELLED','OPEN')),0) ingredient_cost,
 coalesce(sum(o.total-o.ingredient_cost) filter(where o.status not in ('CANCELLED','OPEN')),0) gross_profit,
 coalesce(avg(extract(epoch from (k.ready_at-k.opened_at))/60) filter(where k.ready_at is not null),0) avg_ticket_minutes
from public.restaurant_orders o left join public.restaurant_kitchen_tickets k on k.restaurant_order_id=o.id group by o.organization_id;`},
 {file:'supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql',from:"'activity_profiles','activity_profile_answers','organization_sector_packages'",to:"'activity_profiles','organization_sector_packages'"},
 {file:'supabase/migrations/20260802090000_madar_v2_p0_p11_platform.sql',from:'-- Child tables without organization_id inherit access from their parent command.',to:`alter table public.activity_profile_answers enable row level security;
create policy "organization member read activity_profile_answers" on public.activity_profile_answers for select to authenticated using(exists(select 1 from public.activity_profiles p where p.id=activity_profile_id and ((select private.is_organization_member(p.organization_id)) or (select private.is_admin()))));

-- Child tables without organization_id inherit access from their parent command.`},
 {file:'supabase/migrations/20260804110000_orby_v2_o4_o7_completion.sql',from:'connector_id uuid references public.integration_connectors(id) on delete set null',to:'connector_id text references public.integration_connectors(connector_key) on delete set null'},
 {file:'supabase/migrations/20260804110000_orby_v2_o4_o7_completion.sql',from:'orby_data_governance_requests(organization_id,user_id,status,created_at desc)',to:'orby_data_governance_requests(organization_id,user_id,status,requested_at desc)'},
];
for(const item of replacements){const source=await readFile(item.file,'utf8');if(source.includes(item.to))continue;if(!source.includes(item.from))throw new Error(`Patch target missing: ${item.file}`);await writeFile(item.file,source.replace(item.from,item.to));}
console.log('MADAR V2 release migrations are production-compatible.');
