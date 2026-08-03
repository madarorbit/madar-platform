-- MADAR Platform V2.0 — P0 through P11.
-- Additive migration only. It is intentionally committed without being applied to any remote environment.

create schema if not exists private;

-- P0: version baseline and approved product decisions.
create table if not exists public.platform_release_decisions (
  key text primary key,
  release_version text not null,
  decision jsonb not null check (jsonb_typeof(decision) in ('object','array','string','number','boolean')),
  status text not null default 'approved' check (status in ('draft','approved','retired')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_release_decisions(key,release_version,decision,status,approved_at) values
 ('v1_baseline','1.0',jsonb_build_object('git_ref','70f923b6c6cb673f104a231e9eea1dca93c43a32','schema_cutoff','20260731120100','frozen',true),'approved',now()),
 ('v2_plan_levels','2.0','["BASIC","PREMIUM","FULL"]'::jsonb,'approved',now()),
 ('v2_base_prices_sar','2.0','{"BASIC":5,"PREMIUM":20,"FULL":50}'::jsonb,'approved',now()),
 ('v2_term_discounts','2.0','{"1":0,"6":0.10,"12":0.20}'::jsonb,'approved',now()),
 ('v2_connected_multiplier','2.0','1.20'::jsonb,'approved',now()),
 ('v2_trial_days','2.0','20'::jsonb,'approved',now()),
 ('v2_launch_price_notice','2.0',to_jsonb('سعر خاص بمناسبة الإطلاق الأول، وسيتم تغييره لاحقًا.'::text),'approved',now()),
 ('v2_launch_verticals','2.0','["GENERAL_COMMERCE","WHOLESALE","RETAIL","WHOLESALE_RETAIL","GROCERY_WHOLESALE","RESTAURANT","HOTEL"]'::jsonb,'approved',now()),
 ('v2_write_allowlist','2.0','["PRODUCT_UPDATE","INVENTORY_ADJUSTMENT","PRICE_UPDATE","ORDER_STATUS_UPDATE","CUSTOMER_UPDATE","TASK_UPDATE","RESTAURANT_ORDER_STATUS","HOTEL_RESERVATION_STATUS","HOUSEKEEPING_STATUS"]'::jsonb,'approved',now())
on conflict(key) do update set release_version=excluded.release_version,decision=excluded.decision,status=excluded.status,approved_at=excluded.approved_at,updated_at=now();

-- P1: account model and operating mode.
alter table public.profiles
  add column if not exists account_type text,
  add column if not exists account_type_selected_at timestamptz,
  add column if not exists account_migration_source text,
  add column if not exists default_commercial_organization_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_account_type_check' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_account_type_check check (account_type in ('PERSONAL','BUSINESS'));
  end if;
end $$;

alter table public.organizations
  add column if not exists operating_mode text not null default 'MADAR_NATIVE',
  add column if not exists source_of_truth text not null default 'MADAR',
  add column if not exists setup_status text not null default 'not_started',
  add column if not exists sector_package_version text,
  add column if not exists navigation_state jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='organizations_operating_mode_check' and conrelid='public.organizations'::regclass) then
    alter table public.organizations add constraint organizations_operating_mode_check check (operating_mode in ('MADAR_NATIVE','CONNECTED_EXTERNAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname='organizations_source_of_truth_check' and conrelid='public.organizations'::regclass) then
    alter table public.organizations add constraint organizations_source_of_truth_check check (source_of_truth in ('MADAR','EXTERNAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname='organizations_setup_status_check' and conrelid='public.organizations'::regclass) then
    alter table public.organizations add constraint organizations_setup_status_check check (setup_status in ('not_started','in_progress','ready','blocked'));
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_default_commercial_org_fkey' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_default_commercial_org_fkey foreign key(default_commercial_organization_id) references public.organizations(id) on delete set null;
  end if;
end $$;

create index if not exists profiles_account_type_idx on public.profiles(account_type);
create index if not exists profiles_default_commercial_org_idx on public.profiles(default_commercial_organization_id);
create index if not exists organizations_mode_status_idx on public.organizations(operating_mode,status);

update public.profiles p set
  account_type=case when exists(
    select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
    where m.user_id=p.id and o.type<>'STUDENT'
  ) then 'BUSINESS' else 'PERSONAL' end,
  account_type_selected_at=coalesce(account_type_selected_at,created_at),
  account_migration_source=coalesce(account_migration_source,'V1_INFERRED')
where account_type is null;

update public.profiles p set default_commercial_organization_id=(
  select o.id from public.organization_members m join public.organizations o on o.id=m.organization_id
  where m.user_id=p.id and o.type<>'STUDENT' order by m.created_at limit 1
) where p.account_type='BUSINESS' and p.default_commercial_organization_id is null;

-- V1 allowed a user to own both a student space and a commercial space. V2 makes
-- the selected account path exclusive, so migrated business users lose only the
-- membership edge; the former student organization's data remains archived.
insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
select null,'v2.account.student_membership_detached','organization',m.organization_id,
 jsonb_build_object('user_id',m.user_id,'role',m.role,'migration','V1_INFERRED')
from public.organization_members m
join public.organizations o on o.id=m.organization_id and o.type='STUDENT'
join public.profiles p on p.id=m.user_id and p.account_type='BUSINESS';

delete from public.organization_members m using public.organizations o,public.profiles p
where o.id=m.organization_id and o.type='STUDENT' and p.id=m.user_id and p.account_type='BUSINESS';

update public.organizations o set status='archived',updated_at=now()
where o.type='STUDENT' and o.status<>'archived'
and not exists(select 1 from public.organization_members m where m.organization_id=o.id);

alter table public.profiles alter column account_type set default 'PERSONAL';
alter table public.profiles alter column account_type set not null;

-- P2: MADAR Vertical Engine.
create table if not exists public.activity_families (
  id uuid primary key default gen_random_uuid(), code text not null unique, name_ar text not null, name_en text,
  description text, sort_order integer not null default 100, is_visible boolean not null default true,
  status text not null default 'draft' check(status in ('draft','approved','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_types (
  id uuid primary key default gen_random_uuid(), family_id uuid not null references public.activity_families(id) on delete restrict,
  code text not null unique, name_ar text not null, name_en text, description text, sort_order integer not null default 100,
  is_visible boolean not null default true, status text not null default 'draft' check(status in ('draft','approved','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_specializations (
  id uuid primary key default gen_random_uuid(), activity_type_id uuid not null references public.activity_types(id) on delete restrict,
  code text not null unique, name_ar text not null, name_en text, description text, terminology jsonb not null default '{}'::jsonb,
  default_kpis jsonb not null default '[]'::jsonb, sort_order integer not null default 100, is_visible boolean not null default true,
  launch_enabled boolean not null default false, status text not null default 'draft' check(status in ('draft','approved','retired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_onboarding_questions (
  id uuid primary key default gen_random_uuid(), specialization_id uuid references public.activity_specializations(id) on delete cascade,
  key text not null, label_ar text not null, help_ar text, field_type text not null check(field_type in ('text','number','boolean','select','multiselect')),
  options jsonb not null default '[]'::jsonb, condition jsonb not null default '{}'::jsonb, validation jsonb not null default '{}'::jsonb,
  is_required boolean not null default false, sort_order integer not null default 100, is_active boolean not null default true,
  unique(specialization_id,key)
);
create table if not exists public.sector_packages (
  id uuid primary key default gen_random_uuid(), code text not null unique, name_ar text not null, extension_key text not null,
  description text, status text not null default 'draft' check(status in ('draft','approved','retired')),
  is_visible boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sector_package_versions (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references public.sector_packages(id) on delete cascade,
  version text not null, status text not null default 'draft' check(status in ('draft','certified','retired')),
  manifest jsonb not null default '{}'::jsonb, certified_at timestamptz, certified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(), unique(package_id,version)
);
create table if not exists public.activity_specialization_packages (
  specialization_id uuid not null references public.activity_specializations(id) on delete cascade,
  package_id uuid not null references public.sector_packages(id) on delete cascade,
  is_required boolean not null default true, primary key(specialization_id,package_id)
);
create table if not exists public.activity_profiles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null unique references public.organizations(id) on delete cascade,
  family_id uuid not null references public.activity_families(id) on delete restrict,
  activity_type_id uuid not null references public.activity_types(id) on delete restrict,
  specialization_id uuid not null references public.activity_specializations(id) on delete restrict,
  operating_mode text not null check(operating_mode in ('MADAR_NATIVE','CONNECTED_EXTERNAL')),
  configuration jsonb not null default '{}'::jsonb, status text not null default 'active' check(status in ('draft','active','blocked','archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.activity_profile_answers (
  activity_profile_id uuid not null references public.activity_profiles(id) on delete cascade,
  question_id uuid not null references public.activity_onboarding_questions(id) on delete restrict,
  answer jsonb not null, answered_at timestamptz not null default now(), primary key(activity_profile_id,question_id)
);
create table if not exists public.organization_sector_packages (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  package_version_id uuid not null references public.sector_package_versions(id) on delete restrict,
  status text not null default 'active' check(status in ('active','paused','retired')),
  activated_at timestamptz not null default now(), activated_by uuid references public.profiles(id) on delete set null,
  primary key(organization_id,package_version_id)
);

create index if not exists activity_types_family_idx on public.activity_types(family_id,sort_order);
create index if not exists activity_specializations_type_idx on public.activity_specializations(activity_type_id,sort_order);
create index if not exists activity_questions_specialization_idx on public.activity_onboarding_questions(specialization_id,sort_order) where is_active;
create index if not exists sector_package_versions_package_status_idx on public.sector_package_versions(package_id,status);
create index if not exists activity_profiles_specialization_idx on public.activity_profiles(specialization_id,status);
create index if not exists organization_sector_packages_org_status_idx on public.organization_sector_packages(organization_id,status);

insert into public.activity_families(code,name_ar,name_en,description,sort_order,is_visible,status) values
 ('COMMERCE','التجارة','Commerce','أنشطة البيع والمخزون والمشتريات',10,true,'approved'),
 ('FOOD_SERVICE','الأغذية والمطاعم','Food service','المطاعم والمطابخ والوصفات',20,true,'approved'),
 ('HOSPITALITY','الضيافة والفنادق','Hospitality','الفنادق والإقامة وإدارة الغرف',30,true,'approved')
on conflict(code) do update set name_ar=excluded.name_ar,description=excluded.description,is_visible=true,status='approved',updated_at=now();

insert into public.activity_types(family_id,code,name_ar,name_en,description,sort_order,is_visible,status)
select f.id,v.code,v.name_ar,v.name_en,v.description,v.sort_order,true,'approved'
from (values
 ('COMMERCE','TRADE','التجارة العامة','Trade','إدارة تجارة عامة متعددة الأصناف',10),
 ('FOOD_SERVICE','RESTAURANT','مطعم','Restaurant','إدارة مطعم ووصفات ومطبخ',10),
 ('HOSPITALITY','HOTEL','فندق','Hotel','إدارة منشأة فندقية وحجوزات',10)
) as v(family_code,code,name_ar,name_en,description,sort_order)
join public.activity_families f on f.code=v.family_code
on conflict(code) do update set family_id=excluded.family_id,name_ar=excluded.name_ar,description=excluded.description,is_visible=true,status='approved',updated_at=now();

insert into public.activity_specializations(activity_type_id,code,name_ar,name_en,description,terminology,default_kpis,sort_order,is_visible,launch_enabled,status)
select t.id,v.code,v.name_ar,v.name_en,v.description,v.terminology,v.kpis,v.sort_order,true,true,'approved'
from (values
 ('TRADE','GENERAL_COMMERCE','تجارة عامة','General commerce','تجارة مرنة للمنتجات والخدمات','{"sale":"عملية بيع","product":"منتج","customer":"عميل"}'::jsonb,'["revenue","gross_profit","inventory_turnover","low_stock"]'::jsonb,10),
 ('TRADE','WHOLESALE','بيع بالجملة','Wholesale','طلبات كمية وتسعير جملة وموردون','{"sale":"فاتورة جملة","product":"صنف","customer":"عميل جملة"}'::jsonb,'["revenue","gross_margin","average_order_value","inventory_turnover"]'::jsonb,20),
 ('TRADE','RETAIL','بيع بالتجزئة','Retail','مبيعات مباشرة ومخزون عملاء','{"sale":"فاتورة بيع","product":"منتج","customer":"عميل"}'::jsonb,'["daily_sales","gross_margin","basket_size","stockout_rate"]'::jsonb,30),
 ('TRADE','WHOLESALE_RETAIL','جملة وتجزئة','Wholesale and retail','تشغيل قناتي الجملة والتجزئة','{"sale":"فاتورة","product":"صنف","customer":"عميل"}'::jsonb,'["channel_revenue","gross_margin","inventory_turnover","returns_rate"]'::jsonb,40),
 ('TRADE','GROCERY_WHOLESALE','تموينات غذائية','Grocery wholesale','تموينات غذائية مع دفعات وتواريخ صلاحية','{"sale":"فاتورة تموينات","product":"صنف غذائي","customer":"عميل جملة"}'::jsonb,'["gross_margin","expiry_risk","stockout_rate","supplier_lead_time"]'::jsonb,50),
 ('RESTAURANT','RESTAURANT','مطعم','Restaurant','وصفات ومكونات وطلبات ومطبخ','{"sale":"طلب","product":"وجبة","customer":"ضيف"}'::jsonb,'["food_cost_ratio","ticket_time","waste_rate","meal_margin"]'::jsonb,10),
 ('HOTEL','HOTEL','فندق','Hotel','غرف وأسعار وحجوزات وإقامة','{"sale":"حجز","product":"غرفة","customer":"نزيل"}'::jsonb,'["occupancy","adr","revpar","housekeeping_turnaround"]'::jsonb,10)
) as v(type_code,code,name_ar,name_en,description,terminology,kpis,sort_order)
join public.activity_types t on t.code=v.type_code
on conflict(code) do update set activity_type_id=excluded.activity_type_id,name_ar=excluded.name_ar,description=excluded.description,terminology=excluded.terminology,default_kpis=excluded.default_kpis,is_visible=true,launch_enabled=true,status='approved',updated_at=now();

insert into public.sector_packages(code,name_ar,extension_key,description,status,is_visible) values
 ('COMMERCE_CORE','حزمة التجارة','commerce','المشتريات والمخزون والمبيعات والمرتجعات والربحية','approved',true),
 ('FOOD_SERVICE_CORE','حزمة المطاعم','food_service','الوصفات والمكونات والطلبات والمطبخ','approved',true),
 ('HOSPITALITY_CORE','حزمة الفنادق','hospitality','الغرف والأسعار والحجوزات والإقامة','approved',true)
on conflict(code) do update set name_ar=excluded.name_ar,description=excluded.description,status='approved',is_visible=true,updated_at=now();

insert into public.sector_package_versions(package_id,version,status,manifest,certified_at)
select id,'2.0.0','certified',case code
 when 'COMMERCE_CORE' then '{"modules":["procurement","inventory","sales","returns","expenses","analytics"],"acceptance_cycle":"purchase-receipt-cost-inventory-sale-return-expense-profit-report-orby"}'::jsonb
 when 'FOOD_SERVICE_CORE' then '{"modules":["recipes","ingredients","restaurant_orders","kitchen","food_reports"]}'::jsonb
 else '{"modules":["properties","rooms","rates","availability","reservations","stays","housekeeping","maintenance","folios"]}'::jsonb end,now()
from public.sector_packages
on conflict(package_id,version) do update set status='certified',manifest=excluded.manifest,certified_at=excluded.certified_at;

insert into public.activity_specialization_packages(specialization_id,package_id,is_required)
select s.id,p.id,true from public.activity_specializations s join public.sector_packages p on
 (s.code in ('GENERAL_COMMERCE','WHOLESALE','RETAIL','WHOLESALE_RETAIL','GROCERY_WHOLESALE') and p.code='COMMERCE_CORE') or
 (s.code='RESTAURANT' and p.code='FOOD_SERVICE_CORE') or (s.code='HOTEL' and p.code='HOSPITALITY_CORE')
on conflict do nothing;

insert into public.activity_onboarding_questions(specialization_id,key,label_ar,help_ar,field_type,options,condition,validation,is_required,sort_order)
select s.id,q.key,q.label_ar,q.help_ar,q.field_type,q.options,q.condition,q.validation,q.required,q.sort_order
from public.activity_specializations s join (values
 ('GENERAL_COMMERCE','branches_count','عدد الفروع','يمكن تغييره لاحقًا','number','[]'::jsonb,'{}'::jsonb,'{"min":1,"max":1000}'::jsonb,true,10),
 ('WHOLESALE','minimum_order_policy','سياسة الحد الأدنى للطلب',null,'text','[]'::jsonb,'{}'::jsonb,'{"maxLength":300}'::jsonb,false,10),
 ('RETAIL','sales_channels','قنوات البيع',null,'multiselect','["STORE","ONLINE","SOCIAL"]'::jsonb,'{}'::jsonb,'{}'::jsonb,true,10),
 ('WHOLESALE_RETAIL','sales_channels','قنوات البيع',null,'multiselect','["WHOLESALE","RETAIL","ONLINE"]'::jsonb,'{}'::jsonb,'{}'::jsonb,true,10),
 ('GROCERY_WHOLESALE','track_expiry','هل تريد تتبع الصلاحية والدفعات؟',null,'boolean','[]'::jsonb,'{}'::jsonb,'{}'::jsonb,true,10),
 ('GROCERY_WHOLESALE','expiry_warning_days','قبل كم يوم تريد تنبيه انتهاء الصلاحية؟','يظهر فقط عند تفعيل تتبع الصلاحية','number','[]'::jsonb,'{"field":"track_expiry","equals":true}'::jsonb,'{"min":1,"max":365}'::jsonb,true,20),
 ('RESTAURANT','service_modes','أنماط الخدمة',null,'multiselect','["DINE_IN","TAKEAWAY","DELIVERY"]'::jsonb,'{}'::jsonb,'{}'::jsonb,true,10),
 ('HOTEL','rooms_count','عدد الغرف',null,'number','[]'::jsonb,'{}'::jsonb,'{"min":1,"max":10000}'::jsonb,true,10)
) as q(spec_code,key,label_ar,help_ar,field_type,options,condition,validation,required,sort_order) on s.code=q.spec_code
on conflict(specialization_id,key) do update set label_ar=excluded.label_ar,options=excluded.options,condition=excluded.condition,validation=excluded.validation,is_required=excluded.is_required,sort_order=excluded.sort_order,is_active=true;

-- P3: sector-specific UDM contracts. Hotel reservations and restaurant recipes remain independent entities.
create table if not exists public.udm_entity_definitions (
  key text primary key, extension_key text not null check(extension_key in ('core','commerce','food_service','hospitality')),
  name_ar text not null, identity_fields jsonb not null default '[]'::jsonb, required_fields jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb, source_of_truth_policy text not null,
  status text not null default 'approved' check(status in ('draft','approved','retired')), version text not null default '2.0.0'
);
create table if not exists public.udm_mapping_contracts (
  id uuid primary key default gen_random_uuid(), extension_key text not null, entity_key text not null references public.udm_entity_definitions(key) on delete cascade,
  connector_key text, direction text not null check(direction in ('INBOUND','OUTBOUND','BIDIRECTIONAL')),
  contract jsonb not null, version text not null, status text not null default 'draft' check(status in ('draft','certified','retired')),
  created_at timestamptz not null default now(), unique(extension_key,entity_key,connector_key,direction,version)
);
create table if not exists public.sector_event_definitions (
  key text primary key, extension_key text not null, name_ar text not null, entity_key text not null references public.udm_entity_definitions(key),
  payload_schema jsonb not null default '{}'::jsonb, version text not null default '2.0.0', status text not null default 'approved' check(status in ('draft','approved','retired'))
);
create table if not exists public.sector_kpi_definitions (
  key text primary key, extension_key text not null, name_ar text not null, description text, unit text not null,
  formula jsonb not null, refresh_policy text not null default 'daily', target_direction text not null check(target_direction in ('UP','DOWN','RANGE','INFO')),
  status text not null default 'approved' check(status in ('draft','approved','retired'))
);
create table if not exists public.sector_orby_tools (
  key text primary key, extension_key text not null, name_ar text not null, permission_mode text not null check(permission_mode in ('READ','WRITE_CONFIRM','WRITE_AUTOMATED')),
  input_schema jsonb not null default '{}'::jsonb, allowed_plan_levels text[] not null default array['FULL'], status text not null default 'approved' check(status in ('draft','approved','retired'))
);

insert into public.udm_entity_definitions(key,extension_key,name_ar,identity_fields,required_fields,relationships,source_of_truth_policy) values
 ('organization','core','منظمة','["external_id","registration_number","name"]','["name"]','[]','organization.operating_mode'),
 ('branch','core','فرع','["external_id","code"]','["name"]','[{"target":"organization","field":"organization_external_id"}]','organization.operating_mode'),
 ('product','commerce','منتج','["external_id","sku","barcode"]','["name"]','[{"target":"category","field":"category_external_id"}]','organization.operating_mode'),
 ('purchase_order','commerce','أمر شراء','["external_id","order_number"]','["ordered_at","supplier_external_id"]','[{"target":"supplier","field":"supplier_external_id"}]','organization.operating_mode'),
 ('goods_receipt','commerce','استلام مشتريات','["external_id","receipt_number"]','["received_at"]','[{"target":"purchase_order","field":"purchase_order_external_id"}]','organization.operating_mode'),
 ('sale','commerce','عملية بيع','["external_id","invoice_number"]','["sold_at","total_amount"]','[{"target":"customer","field":"customer_external_id"}]','organization.operating_mode'),
 ('sales_return','commerce','مرتجع بيع','["external_id","return_number"]','["returned_at"]','[{"target":"sale","field":"sale_external_id"}]','organization.operating_mode'),
 ('recipe','food_service','وصفة','["external_id","recipe_code"]','["name","yield_quantity"]','[{"target":"restaurant_menu_item","field":"menu_item_external_id"}]','organization.operating_mode'),
 ('restaurant_order','food_service','طلب مطعم','["external_id","order_number"]','["opened_at"]','[{"target":"restaurant_location","field":"location_external_id"}]','organization.operating_mode'),
 ('kitchen_ticket','food_service','تذكرة مطبخ','["external_id","ticket_number"]','["status"]','[{"target":"restaurant_order","field":"order_external_id"}]','organization.operating_mode'),
 ('hotel_property','hospitality','منشأة فندقية','["external_id","code"]','["name"]','[]','organization.operating_mode'),
 ('hotel_room','hospitality','غرفة','["external_id","room_number"]','["room_number"]','[{"target":"hotel_property","field":"property_external_id"}]','organization.operating_mode'),
 ('hotel_rate','hospitality','سعر إقامة','["external_id","rate_code"]','["name","amount"]','[{"target":"hotel_property","field":"property_external_id"}]','organization.operating_mode'),
 ('hotel_reservation','hospitality','حجز فندقي','["external_id","confirmation_number"]','["check_in_date","check_out_date"]','[{"target":"hotel_room","field":"room_external_id"}]','organization.operating_mode'),
 ('hotel_stay','hospitality','إقامة','["external_id","stay_number"]','["checked_in_at"]','[{"target":"hotel_reservation","field":"reservation_external_id"}]','organization.operating_mode'),
 ('hotel_folio','hospitality','حساب نزيل','["external_id","folio_number"]','["currency"]','[{"target":"hotel_stay","field":"stay_external_id"}]','organization.operating_mode')
on conflict(key) do update set extension_key=excluded.extension_key,name_ar=excluded.name_ar,identity_fields=excluded.identity_fields,required_fields=excluded.required_fields,relationships=excluded.relationships,source_of_truth_policy=excluded.source_of_truth_policy,status='approved',version='2.0.0';

alter table public.integration_udm_records drop constraint if exists integration_udm_entity_check;
alter table public.integration_udm_records add constraint integration_udm_entity_check check(entity_type in (
 'organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event',
 'purchase_order','goods_receipt','sales_return','recipe','restaurant_order','kitchen_ticket','hotel_property','hotel_room','hotel_rate','hotel_reservation','hotel_stay','hotel_folio'
));

insert into public.udm_mapping_contracts(extension_key,entity_key,connector_key,direction,contract,version,status)
select d.extension_key,d.key,'madar.generic-rest',case when d.key in ('product','inventory','restaurant_order','kitchen_ticket','hotel_reservation','hotel_folio') then 'BIDIRECTIONAL' else 'INBOUND' end,
 jsonb_build_object('identity',d.identity_fields,'required',d.required_fields,'relationships',d.relationships,'source_of_truth','organization.operating_mode','fail_on_missing_identity',true),'2.0.0','certified'
from public.udm_entity_definitions d
on conflict(extension_key,entity_key,connector_key,direction,version) do update set contract=excluded.contract,status='certified';

insert into public.sector_event_definitions(key,extension_key,name_ar,entity_key,payload_schema,version,status) values
 ('commerce.purchase_order.created','commerce','إنشاء أمر شراء','purchase_order','{"required":["subtotal","currency"]}','2.0.0','approved'),
 ('commerce.goods_receipt.posted','commerce','ترحيل استلام مشتريات','goods_receipt','{"required":["total_cost"]}','2.0.0','approved'),
 ('commerce.sales_return.posted','commerce','ترحيل مرتجع بيع','sales_return','{"required":["refund_amount"]}','2.0.0','approved'),
 ('food_service.recipe.created','food_service','إنشاء وصفة','recipe','{"required":["menu_price"]}','2.0.0','approved'),
 ('food_service.order.sent_to_kitchen','food_service','إرسال الطلب للمطبخ','restaurant_order','{"required":["revenue","ingredient_cost"]}','2.0.0','approved'),
 ('hospitality.reservation.confirmed','hospitality','تأكيد حجز','hotel_reservation','{"required":["nights","room_total"]}','2.0.0','approved'),
 ('hospitality.stay.checked_in','hospitality','تسجيل دخول النزيل','hotel_stay','{"required":["room_id","folio_id"]}','2.0.0','approved'),
 ('hospitality.stay.checked_out','hospitality','تسجيل مغادرة النزيل','hotel_stay','{"required":["folio_id","total_charges"]}','2.0.0','approved')
on conflict(key) do update set name_ar=excluded.name_ar,payload_schema=excluded.payload_schema,version=excluded.version,status='approved';

insert into public.sector_kpi_definitions(key,extension_key,name_ar,description,unit,formula,refresh_policy,target_direction) values
 ('gross_profit','commerce','إجمالي الربح','المبيعات ناقص تكلفة البضاعة والمصروفات','currency','{"expression":"revenue-cogs-expenses"}','hourly','UP'),
 ('inventory_turnover','commerce','دوران المخزون','تكلفة المبيعات إلى متوسط المخزون','ratio','{"expression":"cogs/avg_inventory"}','daily','UP'),
 ('stockout_rate','commerce','نسبة نفاد المخزون','الأصناف النافدة من النشطة','percent','{"expression":"out_of_stock/active_products*100"}','hourly','DOWN'),
 ('food_cost_ratio','food_service','نسبة تكلفة الطعام','تكلفة المكونات إلى مبيعات الوجبات','percent','{"expression":"ingredient_cost/meal_revenue*100"}','daily','DOWN'),
 ('ticket_time','food_service','زمن تذكرة المطبخ','متوسط الزمن بين الفتح والجاهزية','minutes','{"expression":"avg(ready_at-opened_at)"}','hourly','DOWN'),
 ('occupancy','hospitality','الإشغال','ليالي الغرف المشغولة إلى المتاحة','percent','{"expression":"occupied_room_nights/available_room_nights*100"}','daily','UP'),
 ('adr','hospitality','متوسط سعر الغرفة','إيراد الغرف إلى الغرف المباعة','currency','{"expression":"room_revenue/rooms_sold"}','daily','UP'),
 ('revpar','hospitality','إيراد الغرفة المتاحة','إيراد الغرف إلى الغرف المتاحة','currency','{"expression":"room_revenue/available_rooms"}','daily','UP')
on conflict(key) do update set name_ar=excluded.name_ar,description=excluded.description,unit=excluded.unit,formula=excluded.formula,refresh_policy=excluded.refresh_policy,target_direction=excluded.target_direction,status='approved';

insert into public.sector_orby_tools(key,extension_key,name_ar,permission_mode,input_schema,allowed_plan_levels) values
 ('commerce.inspect_margin','commerce','تحليل هامش الربح','READ','{"type":"object","properties":{"period":{"type":"string"}}}','{BASIC,PREMIUM,FULL}'),
 ('commerce.adjust_inventory','commerce','تعديل المخزون','WRITE_CONFIRM','{"type":"object","required":["product_id","quantity_delta"]}','{FULL}'),
 ('food.inspect_recipe_cost','food_service','تحليل تكلفة الوصفة','READ','{"type":"object","required":["recipe_id"]}','{PREMIUM,FULL}'),
 ('food.update_kitchen_ticket','food_service','تحديث تذكرة المطبخ','WRITE_CONFIRM','{"type":"object","required":["ticket_id","status"]}','{FULL}'),
 ('hotel.inspect_occupancy','hospitality','تحليل الإشغال','READ','{"type":"object","properties":{"from":{"type":"string"},"to":{"type":"string"}}}','{PREMIUM,FULL}'),
 ('hotel.update_housekeeping','hospitality','تحديث حالة النظافة','WRITE_CONFIRM','{"type":"object","required":["task_id","status"]}','{FULL}')
on conflict(key) do update set name_ar=excluded.name_ar,permission_mode=excluded.permission_mode,input_schema=excluded.input_schema,allowed_plan_levels=excluded.allowed_plan_levels,status='approved';

-- P4: Pricing & Entitlements Engine.
create table if not exists public.pricing_price_books (
  id uuid primary key default gen_random_uuid(), code text not null unique, name_ar text not null, is_default boolean not null default false,
  valid_from timestamptz not null default now(), valid_until timestamptz, launch_notice text,
  status text not null default 'active' check(status in ('draft','active','retired')), created_at timestamptz not null default now()
);
create table if not exists public.pricing_plan_levels (
  code text primary key check(code in ('BASIC','PREMIUM','FULL')), name_ar text not null, description_ar text not null,
  base_monthly_sar numeric(12,2) not null check(base_monthly_sar>=0), sort_order integer not null, is_active boolean not null default true
);
create table if not exists public.pricing_variants (
  id uuid primary key default gen_random_uuid(), code text not null unique, level_code text not null references public.pricing_plan_levels(code) on delete restrict,
  term_months integer not null check(term_months in (1,6,12)), operating_mode text not null check(operating_mode in ('MADAR_NATIVE','CONNECTED_EXTERNAL')),
  duration_discount numeric(6,5) not null check(duration_discount between 0 and 1), mode_multiplier numeric(6,3) not null check(mode_multiplier>=1),
  trial_days integer not null default 20 check(trial_days between 0 and 90), is_active boolean not null default true,
  created_at timestamptz not null default now(), unique(level_code,term_months,operating_mode)
);
create table if not exists public.pricing_variant_prices (
  price_book_id uuid not null references public.pricing_price_books(id) on delete cascade,
  variant_id uuid not null references public.pricing_variants(id) on delete cascade,
  currency text not null check(currency in ('SAR','USD','YER')), amount numeric(14,2) not null check(amount>=0),
  monthly_equivalent numeric(14,2) not null check(monthly_equivalent>=0), created_at timestamptz not null default now(),
  primary key(price_book_id,variant_id,currency)
);
create table if not exists public.pricing_entitlement_definitions (
  key text primary key, name_ar text not null, value_type text not null check(value_type in ('boolean','integer','text','json')),
  description_ar text, created_at timestamptz not null default now()
);
create table if not exists public.pricing_variant_entitlements (
  variant_id uuid not null references public.pricing_variants(id) on delete cascade,
  entitlement_key text not null references public.pricing_entitlement_definitions(key) on delete cascade,
  value jsonb not null, primary key(variant_id,entitlement_key)
);
create table if not exists public.pricing_subscription_snapshots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_subscription_id uuid references public.workspace_subscriptions(id) on delete set null,
  variant_id uuid not null references public.pricing_variants(id) on delete restrict, price_book_id uuid not null references public.pricing_price_books(id) on delete restrict,
  currency text not null check(currency in ('SAR','USD','YER')), locked_amount numeric(14,2) not null check(locked_amount>=0),
  locked_entitlements jsonb not null, is_grandfathered boolean not null default false,
  trial_starts_at timestamptz, trial_ends_at timestamptz, starts_at timestamptz not null default now(), ends_at timestamptz,
  status text not null default 'trialing' check(status in ('trialing','active','past_due','cancelled','expired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists pricing_one_current_subscription_idx on public.pricing_subscription_snapshots(organization_id) where status in ('trialing','active','past_due');
create table if not exists public.pricing_subscription_changes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_snapshot_id uuid not null references public.pricing_subscription_snapshots(id) on delete cascade,
  from_variant_id uuid not null references public.pricing_variants(id) on delete restrict, to_variant_id uuid not null references public.pricing_variants(id) on delete restrict,
  change_type text not null check(change_type in ('UPGRADE','DOWNGRADE','TERM_CHANGE','MODE_CHANGE')),
  requested_at timestamptz not null default now(), effective_at timestamptz not null, status text not null default 'scheduled' check(status in ('scheduled','applied','cancelled')),
  requested_by uuid not null references public.profiles(id) on delete restrict, applied_at timestamptz
);

create index if not exists pricing_variants_catalog_idx on public.pricing_variants(level_code,term_months,operating_mode) where is_active;
create index if not exists pricing_variant_prices_currency_idx on public.pricing_variant_prices(currency,variant_id);
create index if not exists pricing_subscription_org_created_idx on public.pricing_subscription_snapshots(organization_id,created_at desc);
create index if not exists pricing_changes_effective_idx on public.pricing_subscription_changes(status,effective_at) where status='scheduled';

insert into public.pricing_price_books(code,name_ar,is_default,launch_notice,status) values
 ('LAUNCH_2026','أسعار الإطلاق الأول',true,'سعر خاص بمناسبة الإطلاق الأول، وسيتم تغييره لاحقًا.','active')
on conflict(code) do update set name_ar=excluded.name_ar,is_default=true,launch_notice=excluded.launch_notice,status='active';
insert into public.pricing_plan_levels(code,name_ar,description_ar,base_monthly_sar,sort_order) values
 ('BASIC','الاشتراك العادي','الميزات الأساسية ومساحة العمل واستخدام محدود جدًا لأوربي.',5,10),
 ('PREMIUM','الاشتراك المميز','ميزات أوسع ووصول أكبر لأوربي.',20,20),
 ('FULL','الاشتراك الكامل','كل ميزات مَدار ووصول غير محدود لأوربي واستخدام كامل لأدواته.',50,30)
on conflict(code) do update set name_ar=excluded.name_ar,description_ar=excluded.description_ar,base_monthly_sar=excluded.base_monthly_sar,sort_order=excluded.sort_order,is_active=true;

insert into public.pricing_variants(code,level_code,term_months,operating_mode,duration_discount,mode_multiplier,trial_days)
select level.code||'-'||term.months||'M-'||case mode.value when 'MADAR_NATIVE' then 'NATIVE' else 'CONNECTED' end,
 level.code,term.months,mode.value,term.discount,case mode.value when 'CONNECTED_EXTERNAL' then 1.20 else 1 end,20
from public.pricing_plan_levels level
cross join (values(1,0::numeric),(6,0.10::numeric),(12,0.20::numeric)) term(months,discount)
cross join (values('MADAR_NATIVE'),('CONNECTED_EXTERNAL')) mode(value)
on conflict(level_code,term_months,operating_mode) do update set duration_discount=excluded.duration_discount,mode_multiplier=excluded.mode_multiplier,trial_days=20,is_active=true;

insert into public.pricing_variant_prices(price_book_id,variant_id,currency,amount,monthly_equivalent)
select pb.id,v.id,c.currency,
 round(l.base_monthly_sar*v.term_months*(1-v.duration_discount)*v.mode_multiplier*c.rate,2),
 round(l.base_monthly_sar*(1-v.duration_discount)*v.mode_multiplier*c.rate,2)
from public.pricing_price_books pb join public.pricing_variants v on true join public.pricing_plan_levels l on l.code=v.level_code
cross join (values('SAR',1::numeric),('USD',0.2666666667::numeric),('YER',405::numeric)) c(currency,rate)
where pb.code='LAUNCH_2026'
on conflict(price_book_id,variant_id,currency) do update set amount=excluded.amount,monthly_equivalent=excluded.monthly_equivalent;

insert into public.pricing_entitlement_definitions(key,name_ar,value_type,description_ar) values
 ('workspace_access','فتح مساحة العمل','boolean','الوصول إلى مساحة العمل التجارية'),
 ('team_members','أعضاء الفريق','integer','الحد الأقصى لأعضاء الفريق'),
 ('products','المنتجات','integer','الحد الأقصى للمنتجات'),
 ('storage_mb','التخزين','integer','سعة التخزين بالميجابايت'),
 ('import_rows','صفوف الاستيراد','integer','الحد الأقصى لكل استيراد'),
 ('orby_daily_messages','رسائل أوربي اليومية','integer','-1 يعني غير محدود'),
 ('orby_write_tools','أدوات أوربي التنفيذية','boolean','السماح بأدوات الكتابة بعد التأكيد'),
 ('connectors','الموصلات','integer','عدد الاتصالات النشطة'),
 ('advanced_analytics','التحليلات المتقدمة','boolean','تقارير وتنبؤات متقدمة'),
 ('reverse_write','الكتابة العكسية','boolean','إرسال التغييرات إلى نظام العميل')
on conflict(key) do update set name_ar=excluded.name_ar,value_type=excluded.value_type,description_ar=excluded.description_ar;

insert into public.pricing_variant_entitlements(variant_id,entitlement_key,value)
select v.id,e.key,case e.key
 when 'workspace_access' then 'true'::jsonb
 when 'team_members' then to_jsonb(case v.level_code when 'BASIC' then 1 when 'PREMIUM' then 5 else 25 end)
 when 'products' then to_jsonb(case v.level_code when 'BASIC' then 200 when 'PREMIUM' then 3000 else 50000 end)
 when 'storage_mb' then to_jsonb(case v.level_code when 'BASIC' then 500 when 'PREMIUM' then 5120 else 51200 end)
 when 'import_rows' then to_jsonb(case v.level_code when 'BASIC' then 500 when 'PREMIUM' then 5000 else 50000 end)
 when 'orby_daily_messages' then to_jsonb(case v.level_code when 'BASIC' then 5 when 'PREMIUM' then 100 else -1 end)
 when 'orby_write_tools' then to_jsonb(v.level_code='FULL')
 when 'connectors' then to_jsonb(case when v.operating_mode='CONNECTED_EXTERNAL' then case v.level_code when 'BASIC' then 1 when 'PREMIUM' then 3 else 20 end else 0 end)
 when 'advanced_analytics' then to_jsonb(v.level_code in ('PREMIUM','FULL'))
 when 'reverse_write' then to_jsonb(v.operating_mode='CONNECTED_EXTERNAL' and v.level_code='FULL') end
from public.pricing_variants v cross join public.pricing_entitlement_definitions e
on conflict(variant_id,entitlement_key) do update set value=excluded.value;

-- Preserve active V1 commercial subscriptions as immutable V2 snapshots. Their
-- paid amount and limits remain grandfathered until the owner chooses a V2 plan.
insert into public.pricing_subscription_snapshots(
 organization_id,workspace_subscription_id,variant_id,price_book_id,currency,locked_amount,locked_entitlements,is_grandfathered,
 starts_at,ends_at,status
)
select ws.organization_id,ws.id,v.id,pb.id,sp.currency,sp.price,
 jsonb_build_object(
  'workspace_access',true,'team_members',sp.member_limit,'products',sp.product_limit,'storage_mb',sp.storage_mb,
  'import_rows',sp.import_rows_limit,'orby_daily_messages',sp.orby_daily_limit,'orby_write_tools',false,'connectors',0,
  'advanced_analytics',coalesce((sp.features->>'analytics')::boolean,true),'reverse_write',false
 ),true,ws.starts_at,ws.ends_at,case when ws.status in ('active','past_due','cancelled','expired') then ws.status else 'expired' end
from (select distinct on (organization_id) * from public.workspace_subscriptions order by organization_id,created_at desc) ws join public.subscription_plans sp on sp.id=ws.plan_id
join public.organizations o on o.id=ws.organization_id and o.type<>'STUDENT'
join public.pricing_variants v on v.level_code=case sp.organization_type when 'INDIVIDUAL' then 'BASIC' when 'MERCHANT' then 'PREMIUM' else 'FULL' end
 and v.term_months=1 and v.operating_mode=o.operating_mode
join public.pricing_price_books pb on pb.is_default and pb.status='active'
where not exists(select 1 from public.pricing_subscription_snapshots existing where existing.organization_id=ws.organization_id);

-- Commercial V1 spaces without a historical subscription enter the approved
-- launch trial instead of becoming inaccessible or creating a duplicate path.
insert into public.pricing_subscription_snapshots(
 organization_id,variant_id,price_book_id,currency,locked_amount,locked_entitlements,trial_starts_at,trial_ends_at,starts_at,ends_at,status
)
select o.id,v.id,pb.id,o.currency,price.amount,
 coalesce((select jsonb_object_agg(e.entitlement_key,e.value) from public.pricing_variant_entitlements e where e.variant_id=v.id),'{}'::jsonb),
 now(),now()+interval '20 days',now(),now()+interval '20 days','trialing'
from public.organizations o join public.pricing_variants v on v.level_code='BASIC' and v.term_months=1 and v.operating_mode=o.operating_mode
join public.pricing_price_books pb on pb.is_default and pb.status='active'
join public.pricing_variant_prices price on price.price_book_id=pb.id and price.variant_id=v.id and price.currency=o.currency
where o.type<>'STUDENT' and not exists(select 1 from public.pricing_subscription_snapshots existing where existing.organization_id=o.id);

create or replace view public.pricing_public_catalog with (security_invoker=true) as
select v.id,v.code,v.level_code,l.name_ar,l.description_ar,v.term_months,v.operating_mode,v.duration_discount,v.mode_multiplier,v.trial_days,
 p.currency,p.amount,p.monthly_equivalent,pb.launch_notice,
 coalesce((select jsonb_object_agg(e.entitlement_key,e.value) from public.pricing_variant_entitlements e where e.variant_id=v.id),'{}'::jsonb) entitlements
from public.pricing_variants v join public.pricing_plan_levels l on l.code=v.level_code
join public.pricing_variant_prices p on p.variant_id=v.id join public.pricing_price_books pb on pb.id=p.price_book_id
where v.is_active and l.is_active and pb.status='active';

create or replace view public.pricing_current_subscriptions with (security_invoker=true) as
select s.*,
 case when s.status='trialing' and s.trial_ends_at is not null
  then greatest(0,ceil(extract(epoch from (s.trial_ends_at-now()))/86400))::integer
  else 0 end trial_days_remaining
from public.pricing_subscription_snapshots s;

-- P5: native operating core activation metadata.
create table if not exists public.native_module_definitions (
  key text primary key, extension_key text not null, name_ar text not null, route text not null, icon text not null,
  source_of_truth text not null default 'MADAR' check(source_of_truth in ('MADAR','EXTERNAL','HYBRID')),
  sort_order integer not null default 100, status text not null default 'approved' check(status in ('draft','approved','retired'))
);
create table if not exists public.sector_module_bindings (
  package_id uuid not null references public.sector_packages(id) on delete cascade,
  module_key text not null references public.native_module_definitions(key) on delete cascade,
  is_required boolean not null default true, configuration jsonb not null default '{}'::jsonb, primary key(package_id,module_key)
);
create table if not exists public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null references public.native_module_definitions(key) on delete restrict,
  status text not null default 'active' check(status in ('active','hidden','paused')),
  source_of_truth text not null check(source_of_truth in ('MADAR','EXTERNAL','HYBRID')),
  configuration jsonb not null default '{}'::jsonb, activated_at timestamptz not null default now(), primary key(organization_id,module_key)
);
create table if not exists public.sector_dashboard_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  extension_key text not null, widgets jsonb not null default '[]'::jsonb, terminology jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.sector_report_configs (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null, name_ar text not null, extension_key text not null, definition jsonb not null,
  is_active boolean not null default true, primary key(organization_id,key)
);

insert into public.native_module_definitions(key,extension_key,name_ar,route,icon,sort_order) values
 ('dashboard','core','لوحة المعلومات','/workspace','home',10),('orby','core','أوربي','/workspace/orby','sparkles',20),
 ('analytics','core','التقارير والتحليلات','/workspace/analytics','chart',30),('connect','core','مركز الربط','/workspace/connect','layers',40),
 ('permissions','core','الصلاحيات والكتابة','/workspace/permissions','shield',50),('settings','core','إعدادات النشاط','/workspace/setup','settings',900),
 ('products','commerce','الأصناف والمنتجات','/workspace/products','store',100),('procurement','commerce','المشتريات والاستلام','/workspace/procurement','briefcase',110),
 ('inventory','commerce','المخزون','/workspace/inventory','layers',120),('sales','commerce','المبيعات والمرتجعات','/workspace/sales','chart',130),
 ('customers','commerce','العملاء','/workspace/customers','community',140),('suppliers','commerce','الموردون','/workspace/suppliers','briefcase',150),
 ('expenses','commerce','المصروفات','/workspace/expenses','document',160),('restaurant','food_service','تشغيل المطعم','/workspace/restaurant','store',100),
 ('hotel','hospitality','تشغيل الفندق','/workspace/hotel','home',100)
on conflict(key) do update set extension_key=excluded.extension_key,name_ar=excluded.name_ar,route=excluded.route,icon=excluded.icon,sort_order=excluded.sort_order,status='approved';

insert into public.sector_module_bindings(package_id,module_key,is_required)
select p.id,m.key,true from public.sector_packages p join public.native_module_definitions m on
 m.extension_key='core' or m.extension_key=p.extension_key
on conflict do nothing;

-- P6: first commerce package and its complete operating cycle.
create table if not exists public.commerce_purchase_orders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.business_suppliers(id) on delete set null, order_number text not null,
  status text not null default 'DRAFT' check(status in ('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  currency text not null check(currency in ('SAR','USD','YER')), subtotal numeric(14,2) not null default 0 check(subtotal>=0),
  ordered_at timestamptz, expected_at timestamptz, notes text, created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,order_number)
);
create table if not exists public.commerce_purchase_order_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.commerce_purchase_orders(id) on delete cascade,
  product_id uuid not null references public.business_products(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity>0), received_quantity numeric(14,3) not null default 0 check(received_quantity>=0),
  unit_cost numeric(14,4) not null check(unit_cost>=0), line_total numeric(14,2) generated always as (round(quantity*unit_cost,2)) stored,
  check(received_quantity<=quantity)
);
create table if not exists public.commerce_goods_receipts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.commerce_purchase_orders(id) on delete restrict,
  receipt_number text not null, received_at timestamptz not null default now(), status text not null default 'POSTED' check(status in ('DRAFT','POSTED','REVERSED')),
  total_cost numeric(14,2) not null default 0 check(total_cost>=0), created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), unique(organization_id,receipt_number)
);
create table if not exists public.commerce_goods_receipt_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  goods_receipt_id uuid not null references public.commerce_goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid not null references public.commerce_purchase_order_items(id) on delete restrict,
  product_id uuid not null references public.business_products(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity>0), unit_cost numeric(14,4) not null check(unit_cost>=0),
  batch_number text, expires_at date, created_at timestamptz not null default now()
);
create table if not exists public.commerce_sales_returns (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null references public.business_sales(id) on delete restrict, return_number text not null,
  status text not null default 'POSTED' check(status in ('DRAFT','POSTED','REVERSED')), returned_at timestamptz not null default now(),
  refund_amount numeric(14,2) not null default 0 check(refund_amount>=0), reason text,
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(),
  unique(organization_id,return_number)
);
create table if not exists public.commerce_sales_return_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_return_id uuid not null references public.commerce_sales_returns(id) on delete cascade,
  sale_item_id uuid not null references public.business_sale_items(id) on delete restrict,
  product_id uuid references public.business_products(id) on delete set null,
  quantity numeric(14,3) not null check(quantity>0), unit_refund numeric(14,2) not null check(unit_refund>=0),
  restock boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.sector_operation_events (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  extension_key text not null, event_key text not null, entity_type text not null, entity_id uuid,
  payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), actor_id uuid references public.profiles(id) on delete set null
);

create index if not exists commerce_purchase_orders_org_status_idx on public.commerce_purchase_orders(organization_id,status,created_at desc);
create index if not exists commerce_purchase_items_order_idx on public.commerce_purchase_order_items(purchase_order_id,product_id);
create index if not exists commerce_goods_receipts_order_idx on public.commerce_goods_receipts(purchase_order_id,received_at desc);
create index if not exists commerce_receipt_items_receipt_idx on public.commerce_goods_receipt_items(goods_receipt_id,product_id);
create index if not exists commerce_sales_returns_sale_idx on public.commerce_sales_returns(sale_id,returned_at desc);
create index if not exists commerce_return_items_return_idx on public.commerce_sales_return_items(sales_return_id,product_id);
create index if not exists sector_operation_events_org_time_idx on public.sector_operation_events(organization_id,extension_key,occurred_at desc);

-- P7: MADAR Connect public catalog, setup, mapping, inbound channels, and health.
alter table public.integration_connectors
  add column if not exists certification_status text not null default 'draft',
  add column if not exists setup_schema jsonb not null default '{}'::jsonb,
  add column if not exists channels text[] not null default array['API_KEY'],
  add column if not exists supported_verticals text[] not null default array[]::text[],
  add column if not exists is_public boolean not null default false,
  add column if not exists certified_at timestamptz;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='integration_connectors_certification_check' and conrelid='public.integration_connectors'::regclass) then
    alter table public.integration_connectors add constraint integration_connectors_certification_check check(certification_status in ('draft','testing','certified','suspended','retired'));
  end if;
end $$;

create table if not exists public.integration_connector_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict, vendor_name text not null, system_name text not null,
  website text, use_case text not null, api_documentation_url text, status text not null default 'new' check(status in ('new','reviewing','planned','building','available','declined')),
  admin_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.integration_schema_snapshots (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  schema_version text not null, discovered_schema jsonb not null, discovered_at timestamptz not null default now(),
  status text not null default 'ready' check(status in ('discovering','ready','failed','obsolete')),
  unique(connection_id,schema_version)
);
create table if not exists public.integration_mapping_previews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  schema_snapshot_id uuid references public.integration_schema_snapshots(id) on delete set null,
  entity_key text not null references public.udm_entity_definitions(key) on delete restrict,
  proposed_mapping jsonb not null, confidence numeric(5,4) not null default 0 check(confidence between 0 and 1),
  sample_input jsonb not null default '[]'::jsonb, sample_output jsonb not null default '[]'::jsonb,
  status text not null default 'preview' check(status in ('preview','approved','rejected','superseded')),
  reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.integration_sync_previews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  entity_counts jsonb not null, warnings jsonb not null default '[]'::jsonb, estimated_duration_seconds integer,
  status text not null default 'ready' check(status in ('building','ready','approved','expired')),
  created_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '24 hours')
);
create table if not exists public.integration_inbound_endpoints (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  endpoint_key text not null unique, channel text not null check(channel in ('WEBHOOK','LOCAL_BRIDGE','FILE')),
  auth_mode text not null default 'TOKEN' check(auth_mode in ('TOKEN','HMAC_SHA256')),
  token_hash text not null, signing_secret_ciphertext text, signing_secret_iv text, signing_secret_auth_tag text, signing_secret_key_version integer,
  is_active boolean not null default true, last_received_at timestamptz, created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(), revoked_at timestamptz
);
create table if not exists public.integration_inbound_deliveries (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  endpoint_id uuid not null references public.integration_inbound_endpoints(id) on delete cascade,
  idempotency_key text not null, headers jsonb not null default '{}'::jsonb, payload jsonb not null,
  status text not null default 'accepted' check(status in ('accepted','queued','processed','rejected','failed')),
  received_at timestamptz not null default now(), processed_at timestamptz, error_code text,
  unique(endpoint_id,idempotency_key)
);
create table if not exists public.integration_health_incidents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  severity text not null check(severity in ('info','warning','error','critical')), code text not null, title text not null, details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check(status in ('open','acknowledged','resolved')), opened_at timestamptz not null default now(), resolved_at timestamptz
);

create index if not exists connector_requests_org_status_idx on public.integration_connector_requests(organization_id,status,created_at desc);
create index if not exists schema_snapshots_connection_idx on public.integration_schema_snapshots(connection_id,discovered_at desc);
create index if not exists mapping_previews_connection_status_idx on public.integration_mapping_previews(connection_id,status,created_at desc);
create index if not exists sync_previews_connection_idx on public.integration_sync_previews(connection_id,created_at desc);
create index if not exists inbound_endpoints_connection_idx on public.integration_inbound_endpoints(connection_id,is_active);
create index if not exists inbound_deliveries_status_idx on public.integration_inbound_deliveries(endpoint_id,status,received_at);
create index if not exists health_incidents_connection_idx on public.integration_health_incidents(connection_id,status,opened_at desc);

-- P8: explicit grants, consent, confirmed reverse-write queue, conflicts, verification and compensation.
create table if not exists public.integration_permission_grants (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  resource_key text not null, permission text not null check(permission in ('READ','WRITE')),
  constraints jsonb not null default '{}'::jsonb, granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(), revoked_at timestamptz, revoked_by uuid references public.profiles(id) on delete set null,
  unique(connection_id,resource_key,permission)
);
create table if not exists public.integration_consent_log (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete set null, actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check(action in ('GRANT','REVOKE','PREVIEW','CONFIRM','CANCEL')), resource_key text,
  consent_version text not null default '2.0', details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists public.integration_write_commands (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  command_type text not null, resource_key text not null, entity_type text not null, entity_id text not null,
  desired_change jsonb not null, preview jsonb not null, expected_source_version text, idempotency_key text not null,
  status text not null default 'PREVIEWED' check(status in ('PREVIEWED','CONFIRMED','QUEUED','EXECUTING','VERIFYING','SUCCEEDED','CONFLICT','FAILED','COMPENSATING','COMPENSATED','CANCELLED')),
  requested_by uuid not null references public.profiles(id) on delete restrict, requested_at timestamptz not null default now(),
  confirmed_by uuid references public.profiles(id) on delete set null, confirmed_at timestamptz,
  locked_by text, lease_expires_at timestamptz, source_request_id text, source_version_after text,
  completed_at timestamptz, error_code text, error_message text, unique(connection_id,idempotency_key)
);
create table if not exists public.integration_write_attempts (
  id bigint generated always as identity primary key, command_id uuid not null references public.integration_write_commands(id) on delete cascade,
  attempt_number integer not null check(attempt_number>0), request_snapshot jsonb not null, response_snapshot jsonb,
  status text not null check(status in ('STARTED','SUCCEEDED','FAILED')), started_at timestamptz not null default now(), completed_at timestamptz,
  unique(command_id,attempt_number)
);
create table if not exists public.integration_write_conflicts (
  id uuid primary key default gen_random_uuid(), command_id uuid not null unique references public.integration_write_commands(id) on delete cascade,
  expected_version text, actual_version text, source_snapshot jsonb not null, desired_change jsonb not null,
  resolution text check(resolution in ('SOURCE_WINS','MADAR_WINS','MANUAL','CANCELLED')), resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.integration_compensations (
  id uuid primary key default gen_random_uuid(), command_id uuid not null references public.integration_write_commands(id) on delete cascade,
  strategy text not null check(strategy in ('ROLLBACK','FORWARD_FIX','MANUAL')), payload jsonb not null,
  status text not null default 'PENDING' check(status in ('PENDING','RUNNING','SUCCEEDED','FAILED','MANUAL_REQUIRED')),
  created_at timestamptz not null default now(), completed_at timestamptz
);
create table if not exists public.integration_reverse_sync_records (
  id uuid primary key default gen_random_uuid(), command_id uuid not null unique references public.integration_write_commands(id) on delete cascade,
  udm_entity_key text not null references public.udm_entity_definitions(key) on delete restrict,
  canonical_before jsonb, canonical_after jsonb not null, source_snapshot_after jsonb,
  verified_at timestamptz, created_at timestamptz not null default now()
);

create index if not exists permission_grants_connection_active_idx on public.integration_permission_grants(connection_id,resource_key,permission) where revoked_at is null;
create index if not exists consent_log_org_created_idx on public.integration_consent_log(organization_id,created_at desc);
create index if not exists write_commands_queue_idx on public.integration_write_commands(status,requested_at) where status in ('CONFIRMED','QUEUED','EXECUTING','VERIFYING','COMPENSATING');
create index if not exists write_commands_org_created_idx on public.integration_write_commands(organization_id,requested_at desc);
create index if not exists write_attempts_command_idx on public.integration_write_attempts(command_id,attempt_number desc);
create index if not exists compensations_command_idx on public.integration_compensations(command_id,status);

-- P9: restaurant extension. Recipes are not products and restaurant orders are not generic store orders.
create table if not exists public.restaurant_locations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, code text not null, service_modes text[] not null default array['DINE_IN'], is_active boolean not null default true,
  created_at timestamptz not null default now(), unique(organization_id,code)
);
create table if not exists public.restaurant_recipes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, recipe_code text not null, menu_price numeric(14,2) not null check(menu_price>=0), yield_quantity numeric(14,3) not null default 1 check(yield_quantity>0),
  preparation_minutes integer not null default 0 check(preparation_minutes>=0), is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,recipe_code)
);
create table if not exists public.restaurant_recipe_ingredients (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  recipe_id uuid not null references public.restaurant_recipes(id) on delete cascade,
  product_id uuid not null references public.business_products(id) on delete restrict,
  quantity numeric(14,4) not null check(quantity>0), waste_percent numeric(6,3) not null default 0 check(waste_percent between 0 and 100),
  unique(recipe_id,product_id)
);
create table if not exists public.restaurant_orders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid not null references public.restaurant_locations(id) on delete restrict, order_number text not null,
  service_mode text not null check(service_mode in ('DINE_IN','TAKEAWAY','DELIVERY')),
  status text not null default 'OPEN' check(status in ('OPEN','CONFIRMED','IN_KITCHEN','READY','SERVED','COMPLETED','CANCELLED')),
  subtotal numeric(14,2) not null default 0 check(subtotal>=0), ingredient_cost numeric(14,2) not null default 0 check(ingredient_cost>=0),
  total numeric(14,2) not null default 0 check(total>=0), opened_at timestamptz not null default now(), completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict, unique(organization_id,order_number)
);
create table if not exists public.restaurant_order_items (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  recipe_id uuid not null references public.restaurant_recipes(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity>0), unit_price numeric(14,2) not null check(unit_price>=0), unit_ingredient_cost numeric(14,2) not null check(unit_ingredient_cost>=0),
  notes text, line_total numeric(14,2) generated always as (round(quantity*unit_price,2)) stored
);
create table if not exists public.restaurant_kitchen_tickets (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  restaurant_order_id uuid not null references public.restaurant_orders(id) on delete cascade,
  ticket_number text not null, status text not null default 'NEW' check(status in ('NEW','PREPARING','READY','SERVED','CANCELLED')),
  priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','URGENT')),
  opened_at timestamptz not null default now(), started_at timestamptz, ready_at timestamptz, served_at timestamptz,
  unique(organization_id,ticket_number)
);

create index if not exists restaurant_locations_org_active_idx on public.restaurant_locations(organization_id,is_active);
create index if not exists restaurant_recipes_org_active_idx on public.restaurant_recipes(organization_id,is_active);
create index if not exists restaurant_ingredients_recipe_idx on public.restaurant_recipe_ingredients(recipe_id,product_id);
create index if not exists restaurant_orders_org_status_idx on public.restaurant_orders(organization_id,status,opened_at desc);
create index if not exists restaurant_order_items_order_idx on public.restaurant_order_items(restaurant_order_id,recipe_id);
create index if not exists kitchen_tickets_org_status_idx on public.restaurant_kitchen_tickets(organization_id,status,opened_at);

-- P10: hospitality extension. Reservations, stays, folios and room operations are independent hotel entities.
create table if not exists public.hotel_properties (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, code text not null, timezone text not null default 'Asia/Riyadh', check_in_time time not null default '15:00', check_out_time time not null default '12:00',
  is_active boolean not null default true, created_at timestamptz not null default now(), unique(organization_id,code)
);
create table if not exists public.hotel_rooms (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hotel_properties(id) on delete cascade,
  room_number text not null, room_type text not null, floor text, capacity integer not null default 2 check(capacity>0),
  status text not null default 'AVAILABLE' check(status in ('AVAILABLE','OCCUPIED','DIRTY','CLEANING','MAINTENANCE','OUT_OF_SERVICE')),
  created_at timestamptz not null default now(), unique(property_id,room_number)
);
create table if not exists public.hotel_rates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hotel_properties(id) on delete cascade,
  code text not null, name text not null, room_type text not null, currency text not null check(currency in ('SAR','USD','YER')),
  nightly_amount numeric(14,2) not null check(nightly_amount>=0), is_refundable boolean not null default true, is_active boolean not null default true,
  created_at timestamptz not null default now(), unique(property_id,code)
);
create table if not exists public.hotel_rate_availability (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  rate_id uuid not null references public.hotel_rates(id) on delete cascade, stay_date date not null,
  available_rooms integer not null check(available_rooms>=0), override_amount numeric(14,2) check(override_amount is null or override_amount>=0),
  closed boolean not null default false, unique(rate_id,stay_date)
);
create table if not exists public.hotel_reservations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.hotel_properties(id) on delete restrict, room_id uuid references public.hotel_rooms(id) on delete set null,
  rate_id uuid not null references public.hotel_rates(id) on delete restrict, confirmation_number text not null,
  guest_name text not null, guest_phone text, guest_email text, check_in_date date not null, check_out_date date not null,
  adults integer not null default 1 check(adults>0), children integer not null default 0 check(children>=0),
  status text not null default 'CONFIRMED' check(status in ('TENTATIVE','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW')),
  currency text not null check(currency in ('SAR','USD','YER')), room_total numeric(14,2) not null check(room_total>=0),
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(check_out_date>check_in_date), unique(organization_id,confirmation_number)
);
create table if not exists public.hotel_stays (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  reservation_id uuid not null unique references public.hotel_reservations(id) on delete restrict,
  room_id uuid not null references public.hotel_rooms(id) on delete restrict, stay_number text not null,
  checked_in_at timestamptz not null default now(), checked_out_at timestamptz,
  status text not null default 'IN_HOUSE' check(status in ('IN_HOUSE','CHECKED_OUT','EVICTED')),
  checked_in_by uuid not null references public.profiles(id) on delete restrict, checked_out_by uuid references public.profiles(id) on delete set null,
  unique(organization_id,stay_number)
);
create table if not exists public.hotel_housekeeping_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid not null references public.hotel_rooms(id) on delete cascade, service_date date not null default current_date,
  task_type text not null default 'TURNOVER' check(task_type in ('TURNOVER','STAYOVER','INSPECTION','DEEP_CLEAN')),
  status text not null default 'PENDING' check(status in ('PENDING','ASSIGNED','IN_PROGRESS','INSPECTION','COMPLETED','BLOCKED')),
  assigned_to uuid references public.profiles(id) on delete set null, started_at timestamptz, completed_at timestamptz, notes text,
  unique(room_id,service_date,task_type)
);
create table if not exists public.hotel_maintenance_requests (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  room_id uuid references public.hotel_rooms(id) on delete set null, title text not null, description text,
  priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','EMERGENCY')),
  status text not null default 'OPEN' check(status in ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED')),
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.hotel_folios (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  stay_id uuid not null unique references public.hotel_stays(id) on delete restrict, folio_number text not null,
  currency text not null check(currency in ('SAR','USD','YER')), status text not null default 'OPEN' check(status in ('OPEN','SETTLED','VOID')),
  total_charges numeric(14,2) not null default 0 check(total_charges>=0), total_payments numeric(14,2) not null default 0 check(total_payments>=0),
  closed_at timestamptz, unique(organization_id,folio_number)
);
create table if not exists public.hotel_folio_charges (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  folio_id uuid not null references public.hotel_folios(id) on delete cascade,
  charge_type text not null check(charge_type in ('ROOM','ROOM_SERVICE','MINIBAR','LAUNDRY','TAX','FEE','PAYMENT','ADJUSTMENT')),
  description text not null, amount numeric(14,2) not null, posted_at timestamptz not null default now(),
  posted_by uuid not null references public.profiles(id) on delete restrict
);

create index if not exists hotel_properties_org_active_idx on public.hotel_properties(organization_id,is_active);
create index if not exists hotel_rooms_property_status_idx on public.hotel_rooms(property_id,status,room_type);
create index if not exists hotel_rates_property_active_idx on public.hotel_rates(property_id,is_active,room_type);
create index if not exists hotel_availability_rate_date_idx on public.hotel_rate_availability(rate_id,stay_date);
create index if not exists hotel_reservations_property_dates_idx on public.hotel_reservations(property_id,check_in_date,check_out_date,status);
create index if not exists hotel_reservations_room_dates_idx on public.hotel_reservations(room_id,check_in_date,check_out_date) where status not in ('CANCELLED','NO_SHOW');
create index if not exists hotel_stays_room_status_idx on public.hotel_stays(room_id,status,checked_in_at desc);
create index if not exists hotel_housekeeping_room_status_idx on public.hotel_housekeeping_tasks(room_id,status,service_date);
create index if not exists hotel_maintenance_room_status_idx on public.hotel_maintenance_requests(room_id,status,created_at desc);
create index if not exists hotel_folio_charges_folio_idx on public.hotel_folio_charges(folio_id,posted_at);

-- P11 navigation persistence is stored on organizations.navigation_state and resolved from organization_modules.

create or replace function private.save_workspace_navigation_impl(target_organization uuid,compact boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; state jsonb;
begin
 actor:=private.assert_v2_organization_access(target_organization,false);
 update public.organizations set navigation_state=jsonb_build_object('version',1,'compact',compact,'updated_at',now(),'updated_by',actor),updated_at=now()
 where id=target_organization returning navigation_state into state;
 return state;
end $$;
revoke all on function private.save_workspace_navigation_impl(uuid,boolean) from public,anon,authenticated;
grant execute on function private.save_workspace_navigation_impl(uuid,boolean) to authenticated;
create or replace function public.save_workspace_navigation(target_organization uuid,compact boolean)
returns jsonb language sql security invoker set search_path='' as $$select private.save_workspace_navigation_impl(target_organization,compact)$$;
revoke all on function public.save_workspace_navigation(uuid,boolean) from public,anon;
grant execute on function public.save_workspace_navigation(uuid,boolean) to authenticated;

-- Shared authorization helper for all V2 mutations.
create or replace function private.assert_v2_organization_access(target_organization uuid, require_manager boolean default false)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); member_role public.organization_role;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into member_role from public.organization_members where organization_id=target_organization and user_id=actor;
  if member_role is null then raise exception 'ORGANIZATION_ACCESS_DENIED'; end if;
  if require_manager and member_role not in ('OWNER','ADMIN') then raise exception 'ORGANIZATION_MANAGER_REQUIRED'; end if;
  if not exists(select 1 from public.profiles where id=actor and account_type='BUSINESS' and status='active') then raise exception 'BUSINESS_ACCOUNT_REQUIRED'; end if;
  return actor;
end $$;
revoke all on function private.assert_v2_organization_access(uuid,boolean) from public,anon,authenticated;
grant execute on function private.assert_v2_organization_access(uuid,boolean) to authenticated,service_role;

create or replace function private.activate_sector_package_impl(target_organization uuid,target_specialization uuid,actor uuid)
returns public.activity_profiles language plpgsql security definer set search_path='' as $$
declare spec public.activity_specializations; typ public.activity_types; fam public.activity_families; org public.organizations; profile public.activity_profiles; extension text;
begin
  -- The auth bootstrap runs without an end-user JWT. Every direct authenticated
  -- invocation must still prove both actor identity and organization membership.
  if (select auth.uid()) is not null then
    if actor is distinct from (select auth.uid()) then raise exception 'ACTOR_MISMATCH'; end if;
    perform private.assert_v2_organization_access(target_organization,true);
  end if;
  select * into org from public.organizations where id=target_organization for update;
  if org.id is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  select * into spec from public.activity_specializations where id=target_specialization and status='approved' and is_visible and launch_enabled;
  if spec.id is null then raise exception 'VERTICAL_NOT_APPROVED'; end if;
  select * into typ from public.activity_types where id=spec.activity_type_id and status='approved' and is_visible;
  select * into fam from public.activity_families where id=typ.family_id and status='approved' and is_visible;
  if typ.id is null or fam.id is null then raise exception 'VERTICAL_TAXONOMY_NOT_APPROVED'; end if;
  if exists(
    select 1 from public.activity_specialization_packages sp
    where sp.specialization_id=spec.id and sp.is_required and not exists(
      select 1 from public.sector_package_versions pv where pv.package_id=sp.package_id and pv.status='certified'
    )
  ) then raise exception 'SECTOR_PACKAGE_NOT_CERTIFIED'; end if;

  insert into public.activity_profiles(organization_id,family_id,activity_type_id,specialization_id,operating_mode,configuration,status,created_by)
  values(org.id,fam.id,typ.id,spec.id,org.operating_mode,'{}','active',actor)
  on conflict(organization_id) do update set family_id=excluded.family_id,activity_type_id=excluded.activity_type_id,specialization_id=excluded.specialization_id,
    operating_mode=excluded.operating_mode,status='active',updated_at=now() returning * into profile;

  delete from public.organization_sector_packages where organization_id=org.id;
  insert into public.organization_sector_packages(organization_id,package_version_id,status,activated_by)
  select org.id,pv.id,'active',actor from public.activity_specialization_packages sp
  join lateral(select id from public.sector_package_versions where package_id=sp.package_id and status='certified' order by certified_at desc nulls last,version desc limit 1) pv on true
  where sp.specialization_id=spec.id;

  delete from public.organization_modules where organization_id=org.id;
  insert into public.organization_modules(organization_id,module_key,status,source_of_truth,configuration)
  select distinct org.id,b.module_key,'active',case when org.operating_mode='CONNECTED_EXTERNAL' then 'EXTERNAL' else m.source_of_truth end,b.configuration
  from public.organization_sector_packages osp join public.sector_package_versions pv on pv.id=osp.package_version_id
  join public.sector_module_bindings b on b.package_id=pv.package_id join public.native_module_definitions m on m.key=b.module_key
  where osp.organization_id=org.id and osp.status='active' and m.status='approved'
  on conflict(organization_id,module_key) do update set status='active',source_of_truth=excluded.source_of_truth,configuration=excluded.configuration;

  select p.extension_key into extension from public.activity_specialization_packages asp join public.sector_packages p on p.id=asp.package_id
  where asp.specialization_id=spec.id order by asp.is_required desc limit 1;
  insert into public.sector_dashboard_configs(organization_id,extension_key,widgets,terminology)
  values(org.id,extension,case extension
    when 'commerce' then '["revenue","gross_profit","inventory_turnover","low_stock"]'::jsonb
    when 'food_service' then '["daily_revenue","food_cost_ratio","open_tickets","ticket_time"]'::jsonb
    else '["occupancy","adr","revpar","arrivals_departures"]'::jsonb end,spec.terminology)
  on conflict(organization_id) do update set extension_key=excluded.extension_key,widgets=excluded.widgets,terminology=excluded.terminology,updated_at=now();

  delete from public.sector_report_configs where organization_id=org.id;
  insert into public.sector_report_configs(organization_id,key,name_ar,extension_key,definition)
  select org.id,k.key,k.name_ar,k.extension_key,jsonb_build_object('kpi',k.key,'formula',k.formula,'unit',k.unit)
  from public.sector_kpi_definitions k where k.extension_key=extension and k.status='approved';

  update public.organizations set setup_status='in_progress',sector_package_version='2.0.0',source_of_truth=case when operating_mode='CONNECTED_EXTERNAL' then 'EXTERNAL' else 'MADAR' end where id=org.id;
  return profile;
end $$;
revoke all on function private.activate_sector_package_impl(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.activate_sector_package_impl(uuid,uuid,uuid) to service_role;

create or replace function public.activate_sector_package(target_organization uuid,target_specialization uuid)
returns public.activity_profiles language plpgsql security invoker set search_path='' as $$
declare actor uuid;
begin
  actor:=private.assert_v2_organization_access(target_organization,true);
  return private.activate_sector_package_impl(target_organization,target_specialization,actor);
end $$;
revoke all on function public.activate_sector_package(uuid,uuid) from public,anon;
grant execute on function public.activate_sector_package(uuid,uuid) to authenticated;
grant execute on function private.activate_sector_package_impl(uuid,uuid,uuid) to authenticated;

-- Every migrated V1 commercial workspace receives the certified general
-- commerce profile and modules. Owners can later choose a more specific sector
-- through the controlled vertical engine without creating another workspace.
do $$
declare existing record; default_specialization uuid;
begin
 select id into default_specialization from public.activity_specializations where code='GENERAL_COMMERCE' and status='approved' and launch_enabled and is_visible;
 for existing in
  select o.id organization_id,coalesce((select m.user_id from public.organization_members m where m.organization_id=o.id and m.role='OWNER' order by m.created_at limit 1),o.created_by) actor_id
  from public.organizations o where o.type<>'STUDENT' and not exists(select 1 from public.activity_profiles ap where ap.organization_id=o.id and ap.status='active')
 loop
  perform private.activate_sector_package_impl(existing.organization_id,default_specialization,existing.actor_id);
 end loop;
end $$;

-- Account creation consumes only validated choices; user metadata is never used as an authorization claim.
create or replace function private.bootstrap_v2_account(target_user uuid,metadata jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare acct text:=upper(coalesce(metadata->>'account_type','PERSONAL')); mode text:=upper(coalesce(metadata->>'operating_mode','MADAR_NATIVE'));
 spec public.activity_specializations; org public.organizations; slug_value text; variant public.pricing_variants; book public.pricing_price_books; price public.pricing_variant_prices; entitlements jsonb;
begin
  if acct not in ('PERSONAL','BUSINESS') then acct:='PERSONAL'; end if;
  update public.profiles set account_type=acct,account_type_selected_at=coalesce(account_type_selected_at,now()),account_migration_source='V2_REGISTRATION' where id=target_user;
  if acct='PERSONAL' then
    if not exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=target_user and o.type='STUDENT') then
      slug_value:='student-'||substr(replace(target_user::text,'-',''),1,16);
      insert into public.organizations(name,slug,type,status,created_by,currency,operating_mode,source_of_truth,setup_status)
      values(coalesce(nullif(trim(metadata->>'full_name'),''),'مساحة الطالب'),slug_value,'STUDENT','active',target_user,'SAR','MADAR_NATIVE','MADAR','ready') returning * into org;
      insert into public.organization_members(organization_id,user_id,role) values(org.id,target_user,'OWNER');
    end if;
    return;
  end if;

  if mode not in ('MADAR_NATIVE','CONNECTED_EXTERNAL') then mode:='MADAR_NATIVE'; end if;
  if exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=target_user and o.type<>'STUDENT') then return; end if;
  select * into spec from public.activity_specializations where code=upper(coalesce(metadata->>'activity_specialization_code','GENERAL_COMMERCE')) and status='approved' and launch_enabled and is_visible;
  if spec.id is null then raise exception 'VERTICAL_NOT_APPROVED'; end if;
  slug_value:=lower(regexp_replace(coalesce(nullif(metadata->>'business_slug',''),'business-'||substr(replace(target_user::text,'-',''),1,16)),'[^a-z0-9]+','-','g'));
  slug_value:=trim(both '-' from slug_value);
  if char_length(slug_value)<3 then slug_value:='business-'||substr(replace(target_user::text,'-',''),1,16); end if;
  if exists(select 1 from public.organizations where slug=slug_value) then slug_value:=left(slug_value,60)||'-'||substr(replace(target_user::text,'-',''),1,8); end if;
  insert into public.organizations(name,slug,type,status,created_by,currency,operating_mode,source_of_truth,setup_status)
  values(coalesce(nullif(trim(metadata->>'business_name'),''),'تجارتي'),slug_value,'MERCHANT','active',target_user,
    case when upper(coalesce(metadata->>'currency','SAR')) in ('SAR','USD','YER') then upper(metadata->>'currency') else 'SAR' end,
    mode,case when mode='CONNECTED_EXTERNAL' then 'EXTERNAL' else 'MADAR' end,'not_started') returning * into org;
  insert into public.organization_members(organization_id,user_id,role) values(org.id,target_user,'OWNER');
  update public.profiles set default_commercial_organization_id=org.id where id=target_user;
  perform private.activate_sector_package_impl(org.id,spec.id,target_user);

  select * into variant from public.pricing_variants where level_code=upper(coalesce(metadata->>'plan_level','BASIC'))
    and term_months=case when coalesce(metadata->>'term_months','1') ~ '^(1|6|12)$' then (metadata->>'term_months')::int else 1 end
    and operating_mode=mode and is_active limit 1;
  if variant.id is null then select * into variant from public.pricing_variants where level_code='BASIC' and term_months=1 and operating_mode=mode; end if;
  select * into book from public.pricing_price_books where is_default and status='active' order by valid_from desc limit 1;
  select * into price from public.pricing_variant_prices where price_book_id=book.id and variant_id=variant.id and currency=org.currency;
  select coalesce(jsonb_object_agg(entitlement_key,value),'{}'::jsonb) into entitlements from public.pricing_variant_entitlements where variant_id=variant.id;
  insert into public.pricing_subscription_snapshots(organization_id,variant_id,price_book_id,currency,locked_amount,locked_entitlements,trial_starts_at,trial_ends_at,ends_at,status)
  values(org.id,variant.id,book.id,org.currency,price.amount,entitlements,now(),now()+(variant.trial_days||' days')::interval,now()+(variant.trial_days||' days')::interval,'trialing');

  if spec.code='RESTAURANT' then insert into public.restaurant_locations(organization_id,name,code) values(org.id,org.name,'MAIN') on conflict do nothing; end if;
  if spec.code='HOTEL' then insert into public.hotel_properties(organization_id,name,code) values(org.id,org.name,'MAIN') on conflict do nothing; end if;
end $$;
revoke all on function private.bootstrap_v2_account(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.bootstrap_v2_account(uuid,jsonb) to service_role;

create or replace function private.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path='' as $$
declare selected_account text:=case when upper(coalesce(new.raw_user_meta_data->>'account_type','PERSONAL'))='BUSINESS' then 'BUSINESS' else 'PERSONAL' end;
begin
  insert into public.profiles(id,email,full_name,phone,email_verified,account_type,account_type_selected_at,account_migration_source)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),new.phone,new.email_confirmed_at is not null,selected_account,now(),'V2_REGISTRATION')
  on conflict(id) do update set email=excluded.email,phone=coalesce(excluded.phone,public.profiles.phone),email_verified=excluded.email_verified,
    full_name=case when nullif(public.profiles.full_name,'') is null then excluded.full_name else public.profiles.full_name end;
  if tg_op='INSERT' then perform private.bootstrap_v2_account(new.id,coalesce(new.raw_user_meta_data,'{}'::jsonb)); end if;
  return new;
end $$;
revoke all on function private.handle_new_user_v2() from public,anon,authenticated;
grant execute on function private.handle_new_user_v2() to service_role;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email,email_confirmed_at on auth.users for each row execute function private.handle_new_user_v2();

create or replace function private.prevent_v2_space_mixing()
returns trigger language plpgsql security definer set search_path='' as $$
declare acct text; org_type public.organization_type;
begin
  select account_type into acct from public.profiles where id=new.user_id;
  select type into org_type from public.organizations where id=new.organization_id;
  if acct='BUSINESS' and org_type='STUDENT' then raise exception 'BUSINESS_ACCOUNT_STUDENT_SPACE_FORBIDDEN'; end if;
  if acct='PERSONAL' and org_type<>'STUDENT' then raise exception 'PERSONAL_ACCOUNT_BUSINESS_SPACE_FORBIDDEN'; end if;
  return new;
end $$;
revoke all on function private.prevent_v2_space_mixing() from public,anon,authenticated;
drop trigger if exists organization_members_v2_space_guard on public.organization_members;
create trigger organization_members_v2_space_guard before insert or update on public.organization_members for each row execute function private.prevent_v2_space_mixing();

create or replace function private.change_v2_subscription_impl(target_organization uuid,target_variant uuid,target_currency text)
returns public.pricing_subscription_changes language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); current_sub public.pricing_subscription_snapshots; current_variant public.pricing_variants; next_variant public.pricing_variants;
 book public.pricing_price_books; price public.pricing_variant_prices; entitlements jsonb; change public.pricing_subscription_changes; immediate boolean;
begin
  perform private.assert_v2_organization_access(target_organization,true);
  select * into current_sub from public.pricing_subscription_snapshots where organization_id=target_organization and status in ('trialing','active','past_due') order by created_at desc limit 1 for update;
  if current_sub.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  select * into current_variant from public.pricing_variants where id=current_sub.variant_id;
  select * into next_variant from public.pricing_variants where id=target_variant and is_active;
  if next_variant.id is null then raise exception 'PRICING_VARIANT_NOT_AVAILABLE'; end if;
  if next_variant.operating_mode<>(select operating_mode from public.organizations where id=target_organization) then raise exception 'PRICING_MODE_MISMATCH'; end if;
  immediate:=(case next_variant.level_code when 'BASIC' then 1 when 'PREMIUM' then 2 else 3 end)>(case current_variant.level_code when 'BASIC' then 1 when 'PREMIUM' then 2 else 3 end);
  if immediate then raise exception 'UPGRADE_REQUIRES_CONFIRMED_PAYMENT'; end if;
  insert into public.pricing_subscription_changes(organization_id,subscription_snapshot_id,from_variant_id,to_variant_id,change_type,effective_at,status,requested_by)
  values(target_organization,current_sub.id,current_variant.id,next_variant.id,
   case when immediate then 'UPGRADE' when next_variant.level_code<>current_variant.level_code then 'DOWNGRADE' when next_variant.term_months<>current_variant.term_months then 'TERM_CHANGE' else 'MODE_CHANGE' end,
   case when immediate then now() else coalesce(current_sub.ends_at,now()) end,case when immediate then 'applied' else 'scheduled' end,actor) returning * into change;
  return change;
end $$;
revoke all on function private.change_v2_subscription_impl(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.change_v2_subscription_impl(uuid,uuid,text) to authenticated;
create or replace function public.change_v2_subscription(target_organization uuid,target_variant uuid,target_currency text)
returns public.pricing_subscription_changes language sql security invoker set search_path='' as $$select private.change_v2_subscription_impl(target_organization,target_variant,upper(target_currency))$$;
revoke all on function public.change_v2_subscription(uuid,uuid,text) from public,anon;
grant execute on function public.change_v2_subscription(uuid,uuid,text) to authenticated;

-- Commerce transactions: purchasing, receipt/costing and returns.
create or replace function private.create_commerce_purchase_order_impl(target_organization uuid,target_supplier uuid,order_items jsonb,order_currency text,order_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; order_id uuid:=gen_random_uuid(); item jsonb; product public.business_products; total numeric(14,2):=0; order_no text;
begin
  actor:=private.assert_v2_organization_access(target_organization,true);
  if jsonb_typeof(order_items)<>'array' or jsonb_array_length(order_items)=0 then raise exception 'PURCHASE_ITEMS_REQUIRED'; end if;
  if upper(order_currency) not in ('SAR','USD','YER') then raise exception 'INVALID_CURRENCY'; end if;
  if target_supplier is not null and not exists(select 1 from public.business_suppliers where id=target_supplier and organization_id=target_organization) then raise exception 'SUPPLIER_NOT_FOUND'; end if;
  order_no:='PO-'||upper(substr(replace(order_id::text,'-',''),1,10));
  insert into public.commerce_purchase_orders(id,organization_id,supplier_id,order_number,status,currency,ordered_at,notes,created_by)
  values(order_id,target_organization,target_supplier,order_no,'ORDERED',upper(order_currency),now(),nullif(trim(order_notes),''),actor);
  for item in select value from jsonb_array_elements(order_items) loop
    select * into product from public.business_products where id=(item->>'product_id')::uuid and organization_id=target_organization;
    if product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if coalesce((item->>'quantity')::numeric,0)<=0 or coalesce((item->>'unit_cost')::numeric,-1)<0 then raise exception 'INVALID_PURCHASE_ITEM'; end if;
    insert into public.commerce_purchase_order_items(organization_id,purchase_order_id,product_id,quantity,unit_cost)
    values(target_organization,order_id,product.id,(item->>'quantity')::numeric,(item->>'unit_cost')::numeric);
    total:=total+round((item->>'quantity')::numeric*(item->>'unit_cost')::numeric,2);
  end loop;
  update public.commerce_purchase_orders set subtotal=total where id=order_id;
  insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
  values(target_organization,'commerce','commerce.purchase_order.created','purchase_order',order_id,jsonb_build_object('subtotal',total,'currency',upper(order_currency)),actor);
  return order_id;
end $$;
revoke all on function private.create_commerce_purchase_order_impl(uuid,uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.create_commerce_purchase_order_impl(uuid,uuid,jsonb,text,text) to authenticated;
create or replace function public.create_commerce_purchase_order(target_organization uuid,target_supplier uuid,order_items jsonb,order_currency text,order_notes text default null)
returns uuid language sql security invoker set search_path='' as $$select private.create_commerce_purchase_order_impl(target_organization,target_supplier,order_items,order_currency,order_notes)$$;
revoke all on function public.create_commerce_purchase_order(uuid,uuid,jsonb,text,text) from public,anon;
grant execute on function public.create_commerce_purchase_order(uuid,uuid,jsonb,text,text) to authenticated;

create or replace function private.receive_commerce_purchase_impl(target_organization uuid,target_purchase_order uuid,receipt_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; purchase public.commerce_purchase_orders; receipt_id uuid:=gen_random_uuid(); item jsonb; po_item public.commerce_purchase_order_items; product public.business_products;
 qty numeric(14,3); unit_cost numeric(14,4); old_stock numeric(14,3); new_stock numeric(14,3); new_cost numeric(14,4); total numeric(14,2):=0; receipt_no text;
begin
  actor:=private.assert_v2_organization_access(target_organization,true);
  select * into purchase from public.commerce_purchase_orders where id=target_purchase_order and organization_id=target_organization for update;
  if purchase.id is null or purchase.status not in ('ORDERED','PARTIALLY_RECEIVED') then raise exception 'PURCHASE_ORDER_NOT_RECEIVABLE'; end if;
  if jsonb_typeof(receipt_items)<>'array' or jsonb_array_length(receipt_items)=0 then raise exception 'RECEIPT_ITEMS_REQUIRED'; end if;
  receipt_no:='GR-'||upper(substr(replace(receipt_id::text,'-',''),1,10));
  insert into public.commerce_goods_receipts(id,organization_id,purchase_order_id,receipt_number,status,created_by)
  values(receipt_id,target_organization,purchase.id,receipt_no,'POSTED',actor);
  for item in select value from jsonb_array_elements(receipt_items) loop
    select * into po_item from public.commerce_purchase_order_items where id=(item->>'purchase_order_item_id')::uuid and purchase_order_id=purchase.id for update;
    if po_item.id is null then raise exception 'PURCHASE_ORDER_ITEM_NOT_FOUND'; end if;
    qty:=coalesce((item->>'quantity')::numeric,0); unit_cost:=coalesce((item->>'unit_cost')::numeric,po_item.unit_cost);
    if qty<=0 or unit_cost<0 or po_item.received_quantity+qty>po_item.quantity then raise exception 'INVALID_RECEIPT_QUANTITY'; end if;
    select * into product from public.business_products where id=po_item.product_id and organization_id=target_organization for update;
    old_stock:=product.stock_quantity; new_stock:=old_stock+qty;
    new_cost:=case when new_stock=0 then unit_cost else round(((old_stock*product.cost)+(qty*unit_cost))/new_stock,4) end;
    update public.business_products set stock_quantity=new_stock,cost=new_cost where id=product.id;
    update public.commerce_purchase_order_items set received_quantity=received_quantity+qty where id=po_item.id;
    insert into public.commerce_goods_receipt_items(organization_id,goods_receipt_id,purchase_order_item_id,product_id,quantity,unit_cost,batch_number,expires_at)
    values(target_organization,receipt_id,po_item.id,product.id,qty,unit_cost,nullif(item->>'batch_number',''),nullif(item->>'expires_at','')::date);
    insert into public.inventory_movements(organization_id,product_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,note,created_by)
    values(target_organization,product.id,'purchase',qty,new_stock,'goods_receipt',receipt_id,'استلام مشتريات عبر مَدار V2',actor);
    total:=total+round(qty*unit_cost,2);
  end loop;
  update public.commerce_goods_receipts set total_cost=total where id=receipt_id;
  update public.commerce_purchase_orders set status=case when not exists(select 1 from public.commerce_purchase_order_items where purchase_order_id=purchase.id and received_quantity<quantity) then 'RECEIVED' else 'PARTIALLY_RECEIVED' end where id=purchase.id;
  insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
  values(target_organization,'commerce','commerce.goods_receipt.posted','goods_receipt',receipt_id,jsonb_build_object('total_cost',total),actor);
  return receipt_id;
end $$;
revoke all on function private.receive_commerce_purchase_impl(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.receive_commerce_purchase_impl(uuid,uuid,jsonb) to authenticated;
create or replace function public.receive_commerce_purchase(target_organization uuid,target_purchase_order uuid,receipt_items jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.receive_commerce_purchase_impl(target_organization,target_purchase_order,receipt_items)$$;
revoke all on function public.receive_commerce_purchase(uuid,uuid,jsonb) from public,anon;
grant execute on function public.receive_commerce_purchase(uuid,uuid,jsonb) to authenticated;

create or replace function private.record_commerce_sales_return_impl(target_organization uuid,target_sale uuid,return_items jsonb,return_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; sale public.business_sales; return_id uuid:=gen_random_uuid(); item jsonb; sale_item public.business_sale_items; qty numeric(14,3); refund numeric(14,2):=0; product public.business_products; return_no text;
begin
  actor:=private.assert_v2_organization_access(target_organization,true);
  select * into sale from public.business_sales where id=target_sale and organization_id=target_organization and status in ('completed','refunded') for update;
  if sale.id is null then raise exception 'SALE_NOT_RETURNABLE'; end if;
  if jsonb_typeof(return_items)<>'array' or jsonb_array_length(return_items)=0 then raise exception 'RETURN_ITEMS_REQUIRED'; end if;
  return_no:='RT-'||upper(substr(replace(return_id::text,'-',''),1,10));
  insert into public.commerce_sales_returns(id,organization_id,sale_id,return_number,reason,created_by)
  values(return_id,target_organization,sale.id,return_no,nullif(trim(return_reason),''),actor);
  for item in select value from jsonb_array_elements(return_items) loop
    select * into sale_item from public.business_sale_items where id=(item->>'sale_item_id')::uuid and sale_id=sale.id;
    qty:=coalesce((item->>'quantity')::numeric,0);
    if sale_item.id is null or qty<=0 or qty>sale_item.quantity then raise exception 'INVALID_RETURN_ITEM'; end if;
    insert into public.commerce_sales_return_items(organization_id,sales_return_id,sale_item_id,product_id,quantity,unit_refund,restock)
    values(target_organization,return_id,sale_item.id,sale_item.product_id,qty,sale_item.unit_price,coalesce((item->>'restock')::boolean,true));
    refund:=refund+round(qty*sale_item.unit_price,2);
    if sale_item.product_id is not null and coalesce((item->>'restock')::boolean,true) then
      select * into product from public.business_products where id=sale_item.product_id for update;
      update public.business_products set stock_quantity=stock_quantity+qty where id=product.id;
      insert into public.inventory_movements(organization_id,product_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,note,created_by)
      values(target_organization,product.id,'return',qty,product.stock_quantity+qty,'sales_return',return_id,'مرتجع بيع عبر مَدار V2',actor);
    end if;
  end loop;
  update public.commerce_sales_returns set refund_amount=refund where id=return_id;
  if refund>=sale.total then update public.business_sales set status='refunded',payment_status='refunded' where id=sale.id; end if;
  insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
  values(target_organization,'commerce','commerce.sales_return.posted','sales_return',return_id,jsonb_build_object('refund_amount',refund),actor);
  return return_id;
end $$;
revoke all on function private.record_commerce_sales_return_impl(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function private.record_commerce_sales_return_impl(uuid,uuid,jsonb,text) to authenticated;
create or replace function public.record_commerce_sales_return(target_organization uuid,target_sale uuid,return_items jsonb,return_reason text default null)
returns uuid language sql security invoker set search_path='' as $$select private.record_commerce_sales_return_impl(target_organization,target_sale,return_items,return_reason)$$;
revoke all on function public.record_commerce_sales_return(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.record_commerce_sales_return(uuid,uuid,jsonb,text) to authenticated;

create or replace view public.commerce_profit_report with (security_invoker=true) as
select o.id organization_id,
 coalesce((select sum(s.total) from public.business_sales s where s.organization_id=o.id and s.status='completed'),0) revenue,
 coalesce((select sum(i.quantity*i.unit_cost) from public.business_sale_items i join public.business_sales s on s.id=i.sale_id where i.organization_id=o.id and s.status in ('completed','refunded')),0) cost_of_goods,
 coalesce((select sum(e.amount) from public.business_expenses e where e.organization_id=o.id),0) expenses,
 coalesce((select sum(r.refund_amount) from public.commerce_sales_returns r where r.organization_id=o.id and r.status='POSTED'),0) returns,
 coalesce((select sum(s.total) from public.business_sales s where s.organization_id=o.id and s.status='completed'),0)
 -coalesce((select sum(i.quantity*i.unit_cost) from public.business_sale_items i join public.business_sales s on s.id=i.sale_id where i.organization_id=o.id and s.status in ('completed','refunded')),0)
 -coalesce((select sum(e.amount) from public.business_expenses e where e.organization_id=o.id),0)
 -coalesce((select sum(r.refund_amount) from public.commerce_sales_returns r where r.organization_id=o.id and r.status='POSTED'),0) net_profit
from public.organizations o where o.type<>'STUDENT';

-- MADAR Connect user-facing actions.
create or replace function private.request_connector_impl(target_organization uuid,vendor_name text,system_name text,use_case text,website text,api_documentation_url text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; request_id uuid;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if char_length(trim(vendor_name))<2 or char_length(trim(system_name))<2 or char_length(trim(use_case))<5 then raise exception 'INVALID_CONNECTOR_REQUEST'; end if;
 insert into public.integration_connector_requests(organization_id,requested_by,vendor_name,system_name,use_case,website,api_documentation_url)
 values(target_organization,actor,trim(vendor_name),trim(system_name),trim(use_case),nullif(trim(website),''),nullif(trim(api_documentation_url),'')) returning id into request_id;
 return request_id;
end $$;
revoke all on function private.request_connector_impl(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.request_connector_impl(uuid,text,text,text,text,text) to authenticated;
create or replace function public.request_connector(target_organization uuid,vendor_name text,system_name text,use_case text,website text default null,api_documentation_url text default null)
returns uuid language sql security invoker set search_path='' as $$select private.request_connector_impl(target_organization,vendor_name,system_name,use_case,website,api_documentation_url)$$;
revoke all on function public.request_connector(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.request_connector(uuid,text,text,text,text,text) to authenticated;

create or replace function private.approve_mapping_preview_impl(target_organization uuid,target_preview uuid)
returns public.integration_mapping_previews language plpgsql security definer set search_path='' as $$
declare actor uuid; preview public.integration_mapping_previews;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 update public.integration_mapping_previews set status='approved',reviewed_by=actor,reviewed_at=now()
 where id=target_preview and organization_id=target_organization and status='preview' returning * into preview;
 if preview.id is null then raise exception 'MAPPING_PREVIEW_NOT_APPROVABLE'; end if;
 update public.integration_mapping_previews set status='superseded' where connection_id=preview.connection_id and entity_key=preview.entity_key and id<>preview.id and status='approved';
 if not exists(select 1 from public.integration_mapping_previews where connection_id=preview.connection_id and status='preview') then
   update public.integration_sync_previews set status='approved' where connection_id=preview.connection_id and status='ready' and expires_at>now();
 end if;
 return preview;
end $$;
revoke all on function private.approve_mapping_preview_impl(uuid,uuid) from public,anon,authenticated;
grant execute on function private.approve_mapping_preview_impl(uuid,uuid) to authenticated;
create or replace function public.approve_mapping_preview(target_organization uuid,target_preview uuid)
returns public.integration_mapping_previews language sql security invoker set search_path='' as $$select private.approve_mapping_preview_impl(target_organization,target_preview)$$;
revoke all on function public.approve_mapping_preview(uuid,uuid) from public,anon;
grant execute on function public.approve_mapping_preview(uuid,uuid) to authenticated;

-- Reverse-write lifecycle: grant -> preview -> confirm -> queue -> execute -> verify/compensate.
create or replace function private.grant_integration_permission_impl(target_organization uuid,target_connection uuid,resource_key text,permission text,grant_constraints jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; grant_id uuid;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if upper(permission) not in ('READ','WRITE') then raise exception 'INVALID_PERMISSION'; end if;
 if not exists(select 1 from public.integration_connections where id=target_connection and organization_id=target_organization and deleted_at is null) then raise exception 'CONNECTION_NOT_FOUND'; end if;
 if upper(permission)='WRITE' and resource_key not in ('PRODUCT_UPDATE','INVENTORY_ADJUSTMENT','PRICE_UPDATE','ORDER_STATUS_UPDATE','CUSTOMER_UPDATE','TASK_UPDATE','RESTAURANT_ORDER_STATUS','HOTEL_RESERVATION_STATUS','HOUSEKEEPING_STATUS') then raise exception 'WRITE_RESOURCE_NOT_ALLOWED'; end if;
 insert into public.integration_permission_grants(organization_id,connection_id,resource_key,permission,constraints,granted_by,granted_at,revoked_at,revoked_by)
 values(target_organization,target_connection,resource_key,upper(permission),coalesce(grant_constraints,'{}'::jsonb),actor,now(),null,null)
 on conflict(connection_id,resource_key,permission) do update set constraints=excluded.constraints,granted_by=excluded.granted_by,granted_at=now(),revoked_at=null,revoked_by=null returning id into grant_id;
 insert into public.integration_consent_log(organization_id,connection_id,actor_id,action,resource_key,details) values(target_organization,target_connection,actor,'GRANT',resource_key,jsonb_build_object('permission',upper(permission),'constraints',grant_constraints));
 return grant_id;
end $$;
revoke all on function private.grant_integration_permission_impl(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function private.grant_integration_permission_impl(uuid,uuid,text,text,jsonb) to authenticated;
create or replace function public.grant_integration_permission(target_organization uuid,target_connection uuid,resource_key text,permission text,grant_constraints jsonb default '{}'::jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.grant_integration_permission_impl(target_organization,target_connection,resource_key,permission,grant_constraints)$$;
revoke all on function public.grant_integration_permission(uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.grant_integration_permission(uuid,uuid,text,text,jsonb) to authenticated;

create or replace function private.preview_integration_write_impl(target_organization uuid,target_connection uuid,command_type text,p_resource_key text,entity_type text,entity_id text,desired_change jsonb,expected_source_version text,p_idempotency_key text)
returns public.integration_write_commands language plpgsql security definer set search_path='' as $$
declare actor uuid; command public.integration_write_commands;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if not exists(select 1 from public.integration_permission_grants g where g.connection_id=target_connection and g.organization_id=target_organization and g.resource_key=p_resource_key and g.permission='WRITE' and g.revoked_at is null) then raise exception 'WRITE_PERMISSION_REQUIRED'; end if;
 if not exists(select 1 from public.pricing_subscription_snapshots s where s.organization_id=target_organization and s.status in ('trialing','active') and coalesce((s.locked_entitlements->>'reverse_write')::boolean,false)) then raise exception 'ENTITLEMENT_REVERSE_WRITE_REQUIRED'; end if;
 insert into public.integration_write_commands(organization_id,connection_id,command_type,resource_key,entity_type,entity_id,desired_change,preview,expected_source_version,idempotency_key,requested_by)
 values(target_organization,target_connection,command_type,p_resource_key,entity_type,entity_id,desired_change,
   jsonb_build_object('entity_type',entity_type,'entity_id',entity_id,'changes',desired_change,'requires_confirmation',true,'source_version',expected_source_version),expected_source_version,p_idempotency_key,actor)
 on conflict(connection_id,idempotency_key) do update set desired_change=excluded.desired_change,preview=excluded.preview,expected_source_version=excluded.expected_source_version
 where public.integration_write_commands.status='PREVIEWED' returning * into command;
 if command.id is null then select * into command from public.integration_write_commands c where c.connection_id=target_connection and c.idempotency_key=p_idempotency_key; end if;
 insert into public.integration_consent_log(organization_id,connection_id,actor_id,action,resource_key,details) values(target_organization,target_connection,actor,'PREVIEW',p_resource_key,jsonb_build_object('command_id',command.id));
 return command;
end $$;
revoke all on function private.preview_integration_write_impl(uuid,uuid,text,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function private.preview_integration_write_impl(uuid,uuid,text,text,text,text,jsonb,text,text) to authenticated;
create or replace function public.preview_integration_write(target_organization uuid,target_connection uuid,command_type text,resource_key text,entity_type text,entity_id text,desired_change jsonb,expected_source_version text,idempotency_key text)
returns public.integration_write_commands language sql security invoker set search_path='' as $$select private.preview_integration_write_impl(target_organization,target_connection,command_type,resource_key,entity_type,entity_id,desired_change,expected_source_version,idempotency_key)$$;
revoke all on function public.preview_integration_write(uuid,uuid,text,text,text,text,jsonb,text,text) from public,anon;
grant execute on function public.preview_integration_write(uuid,uuid,text,text,text,text,jsonb,text,text) to authenticated;

create or replace function private.confirm_integration_write_impl(target_organization uuid,target_command uuid)
returns public.integration_write_commands language plpgsql security definer set search_path='' as $$
declare actor uuid; command public.integration_write_commands;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 update public.integration_write_commands set status='QUEUED',confirmed_by=actor,confirmed_at=now()
 where id=target_command and organization_id=target_organization and status='PREVIEWED' returning * into command;
 if command.id is null then raise exception 'WRITE_COMMAND_NOT_CONFIRMABLE'; end if;
 insert into public.integration_consent_log(organization_id,connection_id,actor_id,action,resource_key,details) values(target_organization,command.connection_id,actor,'CONFIRM',command.resource_key,jsonb_build_object('command_id',command.id));
 insert into public.integration_audit_events(organization_id,connection_id,event_type,severity,actor_id,metadata)
 values(target_organization,command.connection_id,'reverse_write.confirmed','info',actor,jsonb_build_object('command_id',command.id,'resource_key',command.resource_key));
 return command;
end $$;
revoke all on function private.confirm_integration_write_impl(uuid,uuid) from public,anon,authenticated;
grant execute on function private.confirm_integration_write_impl(uuid,uuid) to authenticated;
create or replace function public.confirm_integration_write(target_organization uuid,target_command uuid)
returns public.integration_write_commands language sql security invoker set search_path='' as $$select private.confirm_integration_write_impl(target_organization,target_command)$$;
revoke all on function public.confirm_integration_write(uuid,uuid) from public,anon;
grant execute on function public.confirm_integration_write(uuid,uuid) to authenticated;

create or replace function private.revoke_connection_permissions_impl(target_organization uuid,target_connection uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid; affected integer;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 update public.integration_permission_grants set revoked_at=now(),revoked_by=actor where organization_id=target_organization and connection_id=target_connection and revoked_at is null;
 get diagnostics affected=row_count;
 update public.integration_write_commands set status='CANCELLED',completed_at=now(),error_code='PERMISSION_REVOKED' where organization_id=target_organization and connection_id=target_connection and status in ('PREVIEWED','CONFIRMED','QUEUED');
 insert into public.integration_consent_log(organization_id,connection_id,actor_id,action,details) values(target_organization,target_connection,actor,'REVOKE',jsonb_build_object('grants_revoked',affected));
 return affected;
end $$;
revoke all on function private.revoke_connection_permissions_impl(uuid,uuid) from public,anon,authenticated;
grant execute on function private.revoke_connection_permissions_impl(uuid,uuid) to authenticated;
create or replace function public.revoke_connection_permissions(target_organization uuid,target_connection uuid)
returns integer language sql security invoker set search_path='' as $$select private.revoke_connection_permissions_impl(target_organization,target_connection)$$;
revoke all on function public.revoke_connection_permissions(uuid,uuid) from public,anon;
grant execute on function public.revoke_connection_permissions(uuid,uuid) to authenticated;

create or replace function public.integration_claim_write_commands(worker_id text,claim_limit integer default 5,lease_seconds integer default 120)
returns setof public.integration_write_commands language plpgsql security invoker set search_path='' as $$
begin
  return query with candidates as (
    select id from public.integration_write_commands where status='QUEUED' and (lease_expires_at is null or lease_expires_at<now())
    order by requested_at for update skip locked limit greatest(1,least(claim_limit,20))
  ) update public.integration_write_commands c set status='EXECUTING',locked_by=worker_id,lease_expires_at=now()+(greatest(30,least(lease_seconds,900))||' seconds')::interval
  from candidates where c.id=candidates.id returning c.*;
end $$;
revoke all on function public.integration_claim_write_commands(text,integer,integer) from public,anon,authenticated;
grant execute on function public.integration_claim_write_commands(text,integer,integer) to service_role;

create or replace function public.integration_complete_write_command(target_command uuid,worker_id text,source_request_id text,source_version_after text,source_snapshot jsonb,canonical_after jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare command public.integration_write_commands; v_source_request_id text:=$3; v_source_version_after text:=$4;
begin
  select * into command from public.integration_write_commands where id=target_command and status in ('EXECUTING','VERIFYING') and locked_by=worker_id for update;
  if command.id is null then return false; end if;
  update public.integration_write_commands set status='SUCCEEDED',source_request_id=v_source_request_id,source_version_after=v_source_version_after,completed_at=now(),lease_expires_at=null where id=command.id;
  insert into public.integration_reverse_sync_records(command_id,udm_entity_key,canonical_after,source_snapshot_after,verified_at)
  values(command.id,command.entity_type,canonical_after,source_snapshot,now())
  on conflict(command_id) do update set canonical_after=excluded.canonical_after,source_snapshot_after=excluded.source_snapshot_after,verified_at=excluded.verified_at;
  insert into public.integration_audit_events(organization_id,connection_id,event_type,severity,metadata)
  values(command.organization_id,command.connection_id,'reverse_write.succeeded','info',jsonb_build_object('command_id',command.id,'source_request_id',v_source_request_id));
  return true;
end $$;
revoke all on function public.integration_complete_write_command(uuid,text,text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.integration_complete_write_command(uuid,text,text,text,jsonb,jsonb) to service_role;

create or replace function public.integration_conflict_write_command(target_command uuid,worker_id text,actual_version text,source_snapshot jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare command public.integration_write_commands; v_actual_version text:=$3; v_source_snapshot jsonb:=$4;
begin
  select * into command from public.integration_write_commands where id=target_command and status='EXECUTING' and locked_by=worker_id for update;
  if command.id is null then return false; end if;
  update public.integration_write_commands set status='CONFLICT',completed_at=now(),error_code='SOURCE_VERSION_CONFLICT',lease_expires_at=null where id=command.id;
  insert into public.integration_write_conflicts(command_id,expected_version,actual_version,source_snapshot,desired_change)
  values(command.id,command.expected_source_version,v_actual_version,v_source_snapshot,command.desired_change)
  on conflict(command_id) do update set actual_version=excluded.actual_version,source_snapshot=excluded.source_snapshot,desired_change=excluded.desired_change;
  return true;
end $$;
revoke all on function public.integration_conflict_write_command(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.integration_conflict_write_command(uuid,text,text,jsonb) to service_role;

create or replace function public.integration_fail_write_command(target_command uuid,worker_id text,error_code text,error_message text,compensation_payload jsonb default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare command public.integration_write_commands; v_error_code text:=$3; v_error_message text:=$4;
begin
  select * into command from public.integration_write_commands where id=target_command and status in ('EXECUTING','VERIFYING') and locked_by=worker_id for update;
  if command.id is null then return false; end if;
  update public.integration_write_commands set status=case when compensation_payload is null then 'FAILED' else 'COMPENSATING' end,
    completed_at=case when compensation_payload is null then now() else null end,error_code=v_error_code,error_message=v_error_message,lease_expires_at=null where id=command.id;
  if compensation_payload is not null then insert into public.integration_compensations(command_id,strategy,payload) values(command.id,'ROLLBACK',compensation_payload); end if;
  return true;
end $$;
revoke all on function public.integration_fail_write_command(uuid,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.integration_fail_write_command(uuid,text,text,text,jsonb) to service_role;

-- Restaurant atomic order: recipe costing, ingredient consumption, kitchen ticket, profit event.
create or replace function private.record_restaurant_order_impl(target_organization uuid,target_location uuid,service_mode text,order_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; order_id uuid:=gen_random_uuid(); order_no text; ticket_no text; item jsonb; recipe public.restaurant_recipes; ingredient record; qty numeric(14,3); recipe_cost numeric(14,2); v_subtotal numeric(14,2):=0; v_total_cost numeric(14,2):=0; product public.business_products;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if not exists(select 1 from public.restaurant_locations where id=target_location and organization_id=target_organization and is_active) then raise exception 'RESTAURANT_LOCATION_NOT_FOUND'; end if;
 if upper(service_mode) not in ('DINE_IN','TAKEAWAY','DELIVERY') then raise exception 'INVALID_SERVICE_MODE'; end if;
 if jsonb_typeof(order_items)<>'array' or jsonb_array_length(order_items)=0 then raise exception 'RESTAURANT_ORDER_ITEMS_REQUIRED'; end if;
 order_no:='RO-'||upper(substr(replace(order_id::text,'-',''),1,10)); ticket_no:='KT-'||upper(substr(replace(order_id::text,'-',''),1,10));
 insert into public.restaurant_orders(id,organization_id,location_id,order_number,service_mode,status,created_by) values(order_id,target_organization,target_location,order_no,upper(service_mode),'IN_KITCHEN',actor);
 for item in select value from jsonb_array_elements(order_items) loop
   qty:=coalesce((item->>'quantity')::numeric,0); if qty<=0 then raise exception 'INVALID_RESTAURANT_QUANTITY'; end if;
   select * into recipe from public.restaurant_recipes where id=(item->>'recipe_id')::uuid and organization_id=target_organization and is_active;
   if recipe.id is null then raise exception 'RECIPE_NOT_FOUND'; end if;
   recipe_cost:=0;
   for ingredient in select * from public.restaurant_recipe_ingredients where recipe_id=recipe.id loop
     select * into product from public.business_products where id=ingredient.product_id and organization_id=target_organization for update;
     if product.id is null or product.stock_quantity<(ingredient.quantity*(1+ingredient.waste_percent/100)*qty/recipe.yield_quantity) then raise exception 'INSUFFICIENT_INGREDIENT_STOCK'; end if;
     update public.business_products set stock_quantity=stock_quantity-(ingredient.quantity*(1+ingredient.waste_percent/100)*qty/recipe.yield_quantity) where id=product.id;
     insert into public.inventory_movements(organization_id,product_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,note,created_by)
     values(target_organization,product.id,'sale',-(ingredient.quantity*(1+ingredient.waste_percent/100)*qty/recipe.yield_quantity),product.stock_quantity-(ingredient.quantity*(1+ingredient.waste_percent/100)*qty/recipe.yield_quantity),'restaurant_order',order_id,'استهلاك مكونات وصفة',actor);
     recipe_cost:=recipe_cost+round(product.cost*ingredient.quantity*(1+ingredient.waste_percent/100)/recipe.yield_quantity,2);
   end loop;
   insert into public.restaurant_order_items(organization_id,restaurant_order_id,recipe_id,quantity,unit_price,unit_ingredient_cost,notes)
   values(target_organization,order_id,recipe.id,qty,recipe.menu_price,recipe_cost,nullif(item->>'notes',''));
   v_subtotal:=v_subtotal+round(qty*recipe.menu_price,2); v_total_cost:=v_total_cost+round(qty*recipe_cost,2);
 end loop;
 update public.restaurant_orders set subtotal=v_subtotal,total=v_subtotal,ingredient_cost=v_total_cost where id=order_id;
 insert into public.restaurant_kitchen_tickets(organization_id,restaurant_order_id,ticket_number,status) values(target_organization,order_id,ticket_no,'NEW');
 insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
 values(target_organization,'food_service','food_service.order.sent_to_kitchen','restaurant_order',order_id,jsonb_build_object('revenue',v_subtotal,'ingredient_cost',v_total_cost,'profit',v_subtotal-v_total_cost),actor);
 return order_id;
end $$;
revoke all on function private.record_restaurant_order_impl(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.record_restaurant_order_impl(uuid,uuid,text,jsonb) to authenticated;
create or replace function public.record_restaurant_order(target_organization uuid,target_location uuid,service_mode text,order_items jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.record_restaurant_order_impl(target_organization,target_location,service_mode,order_items)$$;
revoke all on function public.record_restaurant_order(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.record_restaurant_order(uuid,uuid,text,jsonb) to authenticated;

create or replace function private.update_kitchen_ticket_impl(target_organization uuid,target_ticket uuid,next_status text)
returns public.restaurant_kitchen_tickets language plpgsql security definer set search_path='' as $$
declare actor uuid; ticket public.restaurant_kitchen_tickets;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if upper(next_status) not in ('PREPARING','READY','SERVED','CANCELLED') then raise exception 'INVALID_KITCHEN_STATUS'; end if;
 update public.restaurant_kitchen_tickets set status=upper(next_status),started_at=case when upper(next_status)='PREPARING' then coalesce(started_at,now()) else started_at end,
 ready_at=case when upper(next_status)='READY' then coalesce(ready_at,now()) else ready_at end,served_at=case when upper(next_status)='SERVED' then coalesce(served_at,now()) else served_at end
 where id=target_ticket and organization_id=target_organization returning * into ticket;
 if ticket.id is null then raise exception 'KITCHEN_TICKET_NOT_FOUND'; end if;
 update public.restaurant_orders set status=case upper(next_status) when 'PREPARING' then 'IN_KITCHEN' when 'READY' then 'READY' when 'SERVED' then 'SERVED' else 'CANCELLED' end,
 completed_at=case when upper(next_status)='SERVED' then now() else completed_at end where id=ticket.restaurant_order_id;
 return ticket;
end $$;
revoke all on function private.update_kitchen_ticket_impl(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.update_kitchen_ticket_impl(uuid,uuid,text) to authenticated;
create or replace function public.update_kitchen_ticket(target_organization uuid,target_ticket uuid,next_status text)
returns public.restaurant_kitchen_tickets language sql security invoker set search_path='' as $$select private.update_kitchen_ticket_impl(target_organization,target_ticket,next_status)$$;
revoke all on function public.update_kitchen_ticket(uuid,uuid,text) from public,anon;
grant execute on function public.update_kitchen_ticket(uuid,uuid,text) to authenticated;

create or replace view public.restaurant_profit_report with (security_invoker=true) as
select o.organization_id,count(*) filter(where o.status not in ('CANCELLED','OPEN')) completed_orders,
 coalesce(sum(o.total) filter(where o.status not in ('CANCELLED','OPEN')),0) revenue,
 coalesce(sum(o.ingredient_cost) filter(where o.status not in ('CANCELLED','OPEN')),0) ingredient_cost,
 coalesce(sum(o.total-o.ingredient_cost) filter(where o.status not in ('CANCELLED','OPEN')),0) gross_profit,
 coalesce(avg(extract(epoch from (k.ready_at-k.opened_at))/60) filter(where k.ready_at is not null),0) avg_ticket_minutes
from public.restaurant_orders o left join public.restaurant_kitchen_tickets k on k.restaurant_order_id=o.id group by o.organization_id;

-- Hotel atomic reservation, check-in and check-out lifecycle.
create or replace function private.create_hotel_reservation_impl(target_organization uuid,target_property uuid,target_rate uuid,target_room uuid,guest_name text,guest_phone text,guest_email text,p_check_in_date date,p_check_out_date date,adults integer,children integer)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; rate public.hotel_rates; reservation_id uuid:=gen_random_uuid(); confirmation text; nights integer; total numeric(14,2);
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if p_check_out_date<=p_check_in_date then raise exception 'INVALID_STAY_DATES'; end if;
 select * into rate from public.hotel_rates where id=target_rate and property_id=target_property and organization_id=target_organization and is_active;
 if rate.id is null then raise exception 'HOTEL_RATE_NOT_FOUND'; end if;
 if target_room is not null and (not exists(select 1 from public.hotel_rooms where id=target_room and property_id=target_property and organization_id=target_organization and status not in ('MAINTENANCE','OUT_OF_SERVICE')) or exists(
   select 1 from public.hotel_reservations r where r.room_id=target_room and r.status not in ('CANCELLED','NO_SHOW','CHECKED_OUT') and r.check_in_date<p_check_out_date and r.check_out_date>p_check_in_date
 )) then raise exception 'ROOM_NOT_AVAILABLE'; end if;
 nights:=p_check_out_date-p_check_in_date; total:=round(rate.nightly_amount*nights,2); confirmation:='HR-'||upper(substr(replace(reservation_id::text,'-',''),1,10));
 insert into public.hotel_reservations(id,organization_id,property_id,room_id,rate_id,confirmation_number,guest_name,guest_phone,guest_email,check_in_date,check_out_date,adults,children,status,currency,room_total,created_by)
 values(reservation_id,target_organization,target_property,target_room,target_rate,confirmation,trim(guest_name),nullif(trim(guest_phone),''),nullif(trim(guest_email),''),p_check_in_date,p_check_out_date,greatest(adults,1),greatest(children,0),'CONFIRMED',rate.currency,total,actor);
 update public.hotel_rate_availability set available_rooms=greatest(available_rooms-1,0) where rate_id=target_rate and stay_date>=p_check_in_date and stay_date<p_check_out_date and not closed;
 insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
 values(target_organization,'hospitality','hospitality.reservation.confirmed','hotel_reservation',reservation_id,jsonb_build_object('nights',nights,'room_total',total,'currency',rate.currency),actor);
 return reservation_id;
end $$;
revoke all on function private.create_hotel_reservation_impl(uuid,uuid,uuid,uuid,text,text,text,date,date,integer,integer) from public,anon,authenticated;
grant execute on function private.create_hotel_reservation_impl(uuid,uuid,uuid,uuid,text,text,text,date,date,integer,integer) to authenticated;
create or replace function public.create_hotel_reservation(target_organization uuid,target_property uuid,target_rate uuid,target_room uuid,guest_name text,guest_phone text,guest_email text,check_in_date date,check_out_date date,adults integer default 1,children integer default 0)
returns uuid language sql security invoker set search_path='' as $$select private.create_hotel_reservation_impl(target_organization,target_property,target_rate,target_room,guest_name,guest_phone,guest_email,check_in_date,check_out_date,adults,children)$$;
revoke all on function public.create_hotel_reservation(uuid,uuid,uuid,uuid,text,text,text,date,date,integer,integer) from public,anon;
grant execute on function public.create_hotel_reservation(uuid,uuid,uuid,uuid,text,text,text,date,date,integer,integer) to authenticated;

create or replace function private.check_in_hotel_reservation_impl(target_organization uuid,target_reservation uuid,target_room uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; reservation public.hotel_reservations; room public.hotel_rooms; stay_id uuid:=gen_random_uuid(); stay_no text; folio_id uuid:=gen_random_uuid(); folio_no text;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 select * into reservation from public.hotel_reservations where id=target_reservation and organization_id=target_organization and status='CONFIRMED' for update;
 select * into room from public.hotel_rooms where id=coalesce(target_room,reservation.room_id) and organization_id=target_organization and property_id=reservation.property_id and status='AVAILABLE' for update;
 if reservation.id is null then raise exception 'RESERVATION_NOT_CHECKIN_READY'; end if; if room.id is null then raise exception 'ROOM_NOT_CHECKIN_READY'; end if;
 stay_no:='HS-'||upper(substr(replace(stay_id::text,'-',''),1,10)); folio_no:='HF-'||upper(substr(replace(folio_id::text,'-',''),1,10));
 insert into public.hotel_stays(id,organization_id,reservation_id,room_id,stay_number,status,checked_in_by) values(stay_id,target_organization,reservation.id,room.id,stay_no,'IN_HOUSE',actor);
 insert into public.hotel_folios(id,organization_id,stay_id,folio_number,currency,status,total_charges) values(folio_id,target_organization,stay_id,folio_no,reservation.currency,'OPEN',reservation.room_total);
 insert into public.hotel_folio_charges(organization_id,folio_id,charge_type,description,amount,posted_by) values(target_organization,folio_id,'ROOM','إقامة الغرفة',reservation.room_total,actor);
 update public.hotel_reservations set status='CHECKED_IN',room_id=room.id,updated_at=now() where id=reservation.id;
 update public.hotel_rooms set status='OCCUPIED' where id=room.id;
 insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id) values(target_organization,'hospitality','hospitality.stay.checked_in','hotel_stay',stay_id,jsonb_build_object('room_id',room.id,'folio_id',folio_id),actor);
 return stay_id;
end $$;
revoke all on function private.check_in_hotel_reservation_impl(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.check_in_hotel_reservation_impl(uuid,uuid,uuid) to authenticated;
create or replace function public.check_in_hotel_reservation(target_organization uuid,target_reservation uuid,target_room uuid default null)
returns uuid language sql security invoker set search_path='' as $$select private.check_in_hotel_reservation_impl(target_organization,target_reservation,target_room)$$;
revoke all on function public.check_in_hotel_reservation(uuid,uuid,uuid) from public,anon;
grant execute on function public.check_in_hotel_reservation(uuid,uuid,uuid) to authenticated;

create or replace function private.check_out_hotel_stay_impl(target_organization uuid,target_stay uuid,payment_amount numeric)
returns public.hotel_folios language plpgsql security definer set search_path='' as $$
declare actor uuid; stay public.hotel_stays; folio public.hotel_folios;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 select * into stay from public.hotel_stays where id=target_stay and organization_id=target_organization and status='IN_HOUSE' for update;
 select * into folio from public.hotel_folios where stay_id=stay.id and status='OPEN' for update;
 if stay.id is null or folio.id is null then raise exception 'STAY_NOT_CHECKOUT_READY'; end if;
 if payment_amount<folio.total_charges-folio.total_payments then raise exception 'FOLIO_BALANCE_REMAINING'; end if;
 insert into public.hotel_folio_charges(organization_id,folio_id,charge_type,description,amount,posted_by) values(target_organization,folio.id,'PAYMENT','تسوية حساب المغادرة',-payment_amount,actor);
 update public.hotel_folios set total_payments=total_payments+payment_amount,status='SETTLED',closed_at=now() where id=folio.id returning * into folio;
 update public.hotel_stays set status='CHECKED_OUT',checked_out_at=now(),checked_out_by=actor where id=stay.id;
 update public.hotel_reservations set status='CHECKED_OUT',updated_at=now() where id=stay.reservation_id;
 update public.hotel_rooms set status='DIRTY' where id=stay.room_id;
 insert into public.hotel_housekeeping_tasks(organization_id,room_id,service_date,task_type,status) values(target_organization,stay.room_id,current_date,'TURNOVER','PENDING') on conflict do nothing;
 insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id) values(target_organization,'hospitality','hospitality.stay.checked_out','hotel_stay',stay.id,jsonb_build_object('folio_id',folio.id,'total_charges',folio.total_charges),actor);
 return folio;
end $$;
revoke all on function private.check_out_hotel_stay_impl(uuid,uuid,numeric) from public,anon,authenticated;
grant execute on function private.check_out_hotel_stay_impl(uuid,uuid,numeric) to authenticated;
create or replace function public.check_out_hotel_stay(target_organization uuid,target_stay uuid,payment_amount numeric)
returns public.hotel_folios language sql security invoker set search_path='' as $$select private.check_out_hotel_stay_impl(target_organization,target_stay,payment_amount)$$;
revoke all on function public.check_out_hotel_stay(uuid,uuid,numeric) from public,anon;
grant execute on function public.check_out_hotel_stay(uuid,uuid,numeric) to authenticated;

create or replace view public.hotel_daily_report with (security_invoker=true) as
select p.organization_id,p.id property_id,current_date report_date,
 count(r.id) total_rooms,count(r.id) filter(where r.status='OCCUPIED') occupied_rooms,
 case when count(r.id)=0 then 0 else round(count(r.id) filter(where r.status='OCCUPIED')::numeric/count(r.id)*100,2) end occupancy,
 coalesce((select sum(c.amount) from public.hotel_folio_charges c join public.hotel_folios f on f.id=c.folio_id join public.hotel_stays s on s.id=f.stay_id join public.hotel_reservations res on res.id=s.reservation_id where res.property_id=p.id and c.charge_type='ROOM' and c.posted_at::date=current_date),0) room_revenue
from public.hotel_properties p left join public.hotel_rooms r on r.property_id=p.id group by p.organization_id,p.id;

-- Certified generic channels ship with the engine; vendor-specific connectors still require their published API contract.
insert into public.integration_connectors(connector_key,version,display_name,description,auth_schemes,capabilities,internal_only,enabled,certification_status,setup_schema,channels,supported_verticals,is_public,certified_at) values
 ('madar.generic-rest','2.0.0','REST API','ربط نظام يوفّر REST API موثقًا مع اختبار ومزامنة تدريجية.',array['api_key','bearer','basic','oauth2'],
  '{"read":true,"write":true,"webhooks":true,"polling":true,"files":false,"database":false,"localBridge":false}'::jsonb,false,true,'certified',
  '{"fields":[{"key":"base_url","type":"url","required":true},{"key":"health_path","type":"text","required":false},{"key":"streams","type":"json","required":true}]}'::jsonb,array['OAUTH','API_KEY','WEBHOOK'],array['commerce','food_service','hospitality'],true,now()),
 ('madar.file-import','2.0.0','Files & CSV','ربط ملفات CSV/JSON عبر قوالب ومطابقة ومعاينة قبل الاستيراد.',array['none'],
  '{"read":true,"write":false,"webhooks":false,"polling":false,"files":true,"database":false,"localBridge":false}'::jsonb,false,true,'certified',
  '{"fields":[{"key":"format","type":"select","required":true,"options":["CSV","JSON"]},{"key":"encoding","type":"text","required":false}]}'::jsonb,array['FILE'],array['commerce','food_service','hospitality'],true,now()),
 ('madar.webhook','2.0.0','Webhooks','استقبال أحداث النظام القائم بتوقيع واختبار وتتبّع تسليم.',array['custom'],
  '{"read":true,"write":false,"webhooks":true,"polling":false,"files":false,"database":false,"localBridge":false}'::jsonb,false,true,'certified',
  '{"fields":[{"key":"signature_header","type":"text","required":false},{"key":"signature_algorithm","type":"select","required":true,"options":["HMAC_SHA256","TOKEN"]}]}'::jsonb,array['WEBHOOK'],array['commerce','food_service','hospitality'],true,now()),
 ('madar.local-bridge','2.0.0','Local Bridge','جسر محلي للأنظمة داخل الشبكة مع دفع مشفّر إلى مَدار.',array['custom'],
  '{"read":true,"write":true,"webhooks":true,"polling":true,"files":true,"database":true,"localBridge":true}'::jsonb,false,true,'certified',
  '{"fields":[{"key":"bridge_name","type":"text","required":true},{"key":"allowed_streams","type":"multiselect","required":true,"options":["products","customers","suppliers","inventory","sales","expenses","purchase_orders","goods_receipts","sales_returns","recipes","restaurant_orders","hotel_rooms","hotel_reservations","hotel_folios"]}]}'::jsonb,array['LOCAL_BRIDGE'],array['commerce','food_service','hospitality'],true,now())
on conflict(connector_key) do update set version=excluded.version,display_name=excluded.display_name,description=excluded.description,auth_schemes=excluded.auth_schemes,
 capabilities=excluded.capabilities,internal_only=false,enabled=true,certification_status='certified',setup_schema=excluded.setup_schema,channels=excluded.channels,
 supported_verticals=excluded.supported_verticals,is_public=true,certified_at=excluded.certified_at,updated_at=now();

insert into public.integration_feature_flags(organization_id,key,enabled,config) values
 (null,'integration_engine_enabled',true,'{"release":"V2.0"}'),(null,'integration_worker_enabled',true,'{"release":"V2.0"}'),
 (null,'integration_scheduler_enabled',true,'{"minimum_interval_seconds":300}'),(null,'integration_pipeline_enabled',true,'{"udm_version":"2.0.0"}'),
 (null,'integration_quality_center_enabled',true,'{"release":"V2.0"}'),(null,'integration_readiness_lab_enabled',true,'{"release":"V2.0"}'),
 (null,'integration_write_enabled',true,'{"confirmation_required":true,"fail_closed":true}')
on conflict(key) where organization_id is null do update set enabled=excluded.enabled,config=excluded.config,updated_at=now();

drop policy if exists "integration connector catalog read" on public.integration_connectors;
create policy "certified integration connector catalog read" on public.integration_connectors for select to authenticated
using((enabled and is_public and certification_status='certified') or (select private.is_admin()));

-- Protect account routing and source-of-truth fields from direct client writes.
create or replace function private.protect_profile_v2_routing()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (select auth.uid())=old.id and (new.account_type is distinct from old.account_type or new.default_commercial_organization_id is distinct from old.default_commercial_organization_id or new.account_migration_source is distinct from old.account_migration_source) then
    raise exception 'ACCOUNT_ROUTING_FIELDS_ARE_SERVER_MANAGED';
  end if;
  return new;
end $$;
revoke all on function private.protect_profile_v2_routing() from public,anon,authenticated;
drop trigger if exists profiles_v2_routing_guard on public.profiles;
create trigger profiles_v2_routing_guard before update on public.profiles for each row execute function private.protect_profile_v2_routing();
revoke update(account_type,account_type_selected_at,account_migration_source,default_commercial_organization_id) on public.profiles from authenticated;
revoke update(operating_mode,source_of_truth,setup_status,sector_package_version,navigation_state) on public.organizations from authenticated;

-- Consistent updated_at triggers.
do $$ declare table_name text;
begin
 foreach table_name in array array[
  'platform_release_decisions','activity_families','activity_types','activity_specializations','sector_packages','activity_profiles',
  'pricing_subscription_snapshots','commerce_purchase_orders','integration_connector_requests','restaurant_recipes','hotel_reservations'
 ] loop
  execute format('drop trigger if exists %I_updated on public.%I',table_name,table_name);
  execute format('create trigger %I_updated before update on public.%I for each row execute function public.touch_updated_at()',table_name,table_name);
 end loop;
end $$;

-- RLS for public reference catalogs.
do $$ declare table_name text;
begin
 foreach table_name in array array[
  'platform_release_decisions','activity_families','activity_types','activity_specializations','activity_onboarding_questions','sector_packages','sector_package_versions',
  'activity_specialization_packages','udm_entity_definitions','udm_mapping_contracts','sector_event_definitions','sector_kpi_definitions','sector_orby_tools',
  'pricing_price_books','pricing_plan_levels','pricing_variants','pricing_variant_prices','pricing_entitlement_definitions','pricing_variant_entitlements',
  'native_module_definitions','sector_module_bindings'
 ] loop execute format('alter table public.%I enable row level security',table_name); end loop;
end $$;

create policy "approved release decisions read" on public.platform_release_decisions for select to authenticated using(status='approved' or (select private.is_admin()));
create policy "approved activity families read" on public.activity_families for select to anon,authenticated using(status='approved' and is_visible or (select private.is_admin()));
create policy "approved activity types read" on public.activity_types for select to anon,authenticated using(status='approved' and is_visible or (select private.is_admin()));
create policy "approved activity specializations read" on public.activity_specializations for select to anon,authenticated using(status='approved' and is_visible and launch_enabled or (select private.is_admin()));
create policy "active onboarding questions read" on public.activity_onboarding_questions for select to anon,authenticated using(is_active or (select private.is_admin()));
create policy "approved sector packages read" on public.sector_packages for select to authenticated using(status='approved' and is_visible or (select private.is_admin()));
create policy "certified sector versions read" on public.sector_package_versions for select to authenticated using(status='certified' or (select private.is_admin()));
create policy "specialization packages read" on public.activity_specialization_packages for select to authenticated using(true);
create policy "approved udm entities read" on public.udm_entity_definitions for select to authenticated using(status='approved' or (select private.is_admin()));
create policy "certified mapping contracts read" on public.udm_mapping_contracts for select to authenticated using(status='certified' or (select private.is_admin()));
create policy "approved sector events read" on public.sector_event_definitions for select to authenticated using(status='approved' or (select private.is_admin()));
create policy "approved sector kpis read" on public.sector_kpi_definitions for select to authenticated using(status='approved' or (select private.is_admin()));
create policy "approved sector tools read" on public.sector_orby_tools for select to authenticated using(status='approved' or (select private.is_admin()));
create policy "active price books read" on public.pricing_price_books for select to anon,authenticated using(status='active' or (select private.is_admin()));
create policy "active pricing levels read" on public.pricing_plan_levels for select to anon,authenticated using(is_active or (select private.is_admin()));
create policy "active pricing variants read" on public.pricing_variants for select to anon,authenticated using(is_active or (select private.is_admin()));
create policy "pricing prices read" on public.pricing_variant_prices for select to anon,authenticated using(true);
create policy "entitlement definitions read" on public.pricing_entitlement_definitions for select to authenticated using(true);
create policy "variant entitlements read" on public.pricing_variant_entitlements for select to authenticated using(true);
create policy "module definitions read" on public.native_module_definitions for select to authenticated using(status='approved' or (select private.is_admin()));
create policy "sector module bindings read" on public.sector_module_bindings for select to authenticated using(true);

-- Admins can curate taxonomy and packages without opening write access to customers.
do $$ declare table_name text;
begin
 foreach table_name in array array['activity_families','activity_types','activity_specializations','activity_onboarding_questions','sector_packages','sector_package_versions','activity_specialization_packages','udm_mapping_contracts'] loop
  execute format('create policy "admin manage %1$s" on public.%1$I for all to authenticated using((select private.is_admin())) with check((select private.is_admin()))',table_name);
 end loop;
end $$;

-- Tenant tables all use organization membership for reads; writes are through guarded RPCs.
do $$ declare table_name text;
begin
 foreach table_name in array array[
  'activity_profiles','organization_sector_packages','pricing_subscription_snapshots','pricing_subscription_changes','organization_modules','sector_dashboard_configs','sector_report_configs',
  'commerce_purchase_orders','commerce_purchase_order_items','commerce_goods_receipts','commerce_goods_receipt_items','commerce_sales_returns','commerce_sales_return_items','sector_operation_events',
  'integration_connector_requests','integration_schema_snapshots','integration_mapping_previews','integration_sync_previews','integration_inbound_endpoints','integration_inbound_deliveries','integration_health_incidents',
  'integration_permission_grants','integration_consent_log','integration_write_commands','restaurant_locations','restaurant_recipes','restaurant_recipe_ingredients','restaurant_orders','restaurant_order_items','restaurant_kitchen_tickets',
  'hotel_properties','hotel_rooms','hotel_rates','hotel_rate_availability','hotel_reservations','hotel_stays','hotel_housekeeping_tasks','hotel_maintenance_requests','hotel_folios','hotel_folio_charges'
 ] loop
  execute format('alter table public.%I enable row level security',table_name);
  execute format('create policy "organization member read %1$s" on public.%1$I for select to authenticated using((select private.is_organization_member(organization_id)) or (select private.is_admin()))',table_name);
 end loop;
end $$;

alter table public.activity_profile_answers enable row level security;
create policy "organization member read activity_profile_answers" on public.activity_profile_answers for select to authenticated using(exists(select 1 from public.activity_profiles p where p.id=activity_profile_id and ((select private.is_organization_member(p.organization_id)) or (select private.is_admin()))));

-- Child tables without organization_id inherit access from their parent command.
alter table public.integration_write_attempts enable row level security;
alter table public.integration_write_conflicts enable row level security;
alter table public.integration_compensations enable row level security;
alter table public.integration_reverse_sync_records enable row level security;
create policy "organization member read write attempts" on public.integration_write_attempts for select to authenticated using(exists(select 1 from public.integration_write_commands c where c.id=command_id and ((select private.is_organization_member(c.organization_id)) or (select private.is_admin()))));
create policy "organization member read write conflicts" on public.integration_write_conflicts for select to authenticated using(exists(select 1 from public.integration_write_commands c where c.id=command_id and ((select private.is_organization_member(c.organization_id)) or (select private.is_admin()))));
create policy "organization member read compensations" on public.integration_compensations for select to authenticated using(exists(select 1 from public.integration_write_commands c where c.id=command_id and ((select private.is_organization_member(c.organization_id)) or (select private.is_admin()))));
create policy "organization member read reverse sync" on public.integration_reverse_sync_records for select to authenticated using(exists(select 1 from public.integration_write_commands c where c.id=command_id and ((select private.is_organization_member(c.organization_id)) or (select private.is_admin()))));

-- Data API exposure is explicit for 2026 Supabase projects.
grant select on public.activity_families,public.activity_types,public.activity_specializations,public.activity_onboarding_questions,public.pricing_price_books,public.pricing_plan_levels,public.pricing_variants,public.pricing_variant_prices to anon,authenticated;
grant select on public.pricing_public_catalog to anon,authenticated;
grant select on public.pricing_current_subscriptions to authenticated;
grant select on public.platform_release_decisions,public.sector_packages,public.sector_package_versions,public.activity_specialization_packages,public.udm_entity_definitions,public.udm_mapping_contracts,public.sector_event_definitions,public.sector_kpi_definitions,public.sector_orby_tools,public.pricing_entitlement_definitions,public.pricing_variant_entitlements,public.native_module_definitions,public.sector_module_bindings to authenticated;
grant select on public.activity_profiles,public.activity_profile_answers,public.organization_sector_packages,public.pricing_subscription_snapshots,public.pricing_subscription_changes,public.organization_modules,public.sector_dashboard_configs,public.sector_report_configs to authenticated;
grant select on public.commerce_purchase_orders,public.commerce_purchase_order_items,public.commerce_goods_receipts,public.commerce_goods_receipt_items,public.commerce_sales_returns,public.commerce_sales_return_items,public.sector_operation_events,public.commerce_profit_report to authenticated;
grant select on public.integration_connector_requests,public.integration_schema_snapshots,public.integration_mapping_previews,public.integration_sync_previews,public.integration_inbound_endpoints,public.integration_inbound_deliveries,public.integration_health_incidents,public.integration_permission_grants,public.integration_consent_log,public.integration_write_commands,public.integration_write_attempts,public.integration_write_conflicts,public.integration_compensations,public.integration_reverse_sync_records to authenticated;
grant select on public.restaurant_locations,public.restaurant_recipes,public.restaurant_recipe_ingredients,public.restaurant_orders,public.restaurant_order_items,public.restaurant_kitchen_tickets,public.restaurant_profit_report to authenticated;
grant select on public.hotel_properties,public.hotel_rooms,public.hotel_rates,public.hotel_rate_availability,public.hotel_reservations,public.hotel_stays,public.hotel_housekeeping_tasks,public.hotel_maintenance_requests,public.hotel_folios,public.hotel_folio_charges,public.hotel_daily_report to authenticated;

grant select,insert,update,delete on public.activity_families,public.activity_types,public.activity_specializations,public.activity_onboarding_questions,public.sector_packages,public.sector_package_versions,public.activity_specialization_packages,public.udm_mapping_contracts to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

-- Foreign-key indexes added after all relations exist.
create index if not exists activity_answers_question_idx on public.activity_profile_answers(question_id);
create index if not exists org_sector_package_version_idx on public.organization_sector_packages(package_version_id);
create index if not exists pricing_sub_variant_idx on public.pricing_subscription_snapshots(variant_id);
create index if not exists pricing_sub_price_book_idx on public.pricing_subscription_snapshots(price_book_id);
create index if not exists pricing_changes_from_variant_idx on public.pricing_subscription_changes(from_variant_id);
create index if not exists pricing_changes_to_variant_idx on public.pricing_subscription_changes(to_variant_id);
create index if not exists restaurant_orders_location_idx on public.restaurant_orders(location_id);
create index if not exists hotel_reservations_rate_idx on public.hotel_reservations(rate_id);
create index if not exists hotel_stays_reservation_idx on public.hotel_stays(reservation_id);
create index if not exists hotel_folios_stay_idx on public.hotel_folios(stay_id);

-- Unified entitlement enforcement and local-payment activation for V2 pricing.
create or replace function private.current_v2_entitlement(target_organization uuid,entitlement text)
returns jsonb language sql stable security definer set search_path='' as $$
 select s.locked_entitlements->entitlement from public.pricing_subscription_snapshots s
 where s.organization_id=target_organization and (
  (s.status='trialing' and s.trial_ends_at>now()) or
  (s.status='active' and (s.ends_at is null or s.ends_at>now())) or s.status='past_due'
 ) order by s.created_at desc limit 1
$$;
revoke all on function private.current_v2_entitlement(uuid,text) from public,anon,authenticated;
grant execute on function private.current_v2_entitlement(uuid,text) to authenticated,service_role;

create or replace function private.enforce_workspace_product_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare allowed integer; current_count integer;
begin
 allowed:=coalesce((private.current_v2_entitlement(new.organization_id,'products')#>>'{}')::integer,
  (select p.product_limit from public.workspace_subscriptions s join public.subscription_plans p on p.id=s.plan_id where s.organization_id=new.organization_id and s.status in ('active','past_due') order by s.created_at desc limit 1));
 if allowed is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
 select count(*) into current_count from public.business_products where organization_id=new.organization_id;
 if current_count>=allowed then raise exception 'PRODUCT_LIMIT_REACHED'; end if;
 return new;
end $$;
revoke all on function private.enforce_workspace_product_limit() from public,anon,authenticated;

create or replace function private.enforce_workspace_member_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare org_type public.organization_type; allowed integer; current_count integer;
begin
 select type into org_type from public.organizations where id=new.organization_id;
 if org_type='STUDENT' then return new; end if;
 allowed:=coalesce((private.current_v2_entitlement(new.organization_id,'team_members')#>>'{}')::integer,
  (select p.member_limit from public.workspace_subscriptions s join public.subscription_plans p on p.id=s.plan_id where s.organization_id=new.organization_id and s.status in ('active','past_due') order by s.created_at desc limit 1));
 if allowed is null then
  if new.role='OWNER' and not exists(select 1 from public.organization_members where organization_id=new.organization_id) then return new; end if;
  raise exception 'SUBSCRIPTION_REQUIRED';
 end if;
 select count(*) into current_count from public.organization_members where organization_id=new.organization_id;
 if current_count>=allowed then raise exception 'MEMBER_LIMIT_REACHED'; end if;
 return new;
end $$;
revoke all on function private.enforce_workspace_member_limit() from public,anon,authenticated;

create or replace function private.consume_orby_quota_impl(target_organization uuid,submitted_characters integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=(select auth.uid()); usage_row public.orby_usage_daily%rowtype; daily_limit integer;
begin
 if current_user_id is null or not private.is_organization_member(target_organization) then raise exception 'NOT_AUTHORIZED'; end if;
 if submitted_characters<1 or submitted_characters>12000 then raise exception 'INVALID_PROMPT_SIZE'; end if;
 daily_limit:=coalesce((private.current_v2_entitlement(target_organization,'orby_daily_messages')#>>'{}')::integer,
  (select p.orby_daily_limit from public.workspace_subscriptions s join public.subscription_plans p on p.id=s.plan_id where s.organization_id=target_organization and s.status in ('active','past_due') order by s.created_at desc limit 1));
 if daily_limit is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
 insert into public.orby_usage_daily(organization_id,user_id,usage_date,requests,input_characters) values(target_organization,current_user_id,current_date,1,submitted_characters)
 on conflict(organization_id,user_id,usage_date) do update set requests=public.orby_usage_daily.requests+1,input_characters=public.orby_usage_daily.input_characters+excluded.input_characters,updated_at=now()
 where (daily_limit=-1 or public.orby_usage_daily.requests<daily_limit) and (daily_limit=-1 or public.orby_usage_daily.input_characters+excluded.input_characters<=greatest(100000,daily_limit*5000))
 returning * into usage_row;
 if usage_row.user_id is null then raise exception 'ORBY_DAILY_LIMIT'; end if;
 return jsonb_build_object('requests',usage_row.requests,'limit',daily_limit,'remaining',case when daily_limit=-1 then -1 else greatest(daily_limit-usage_row.requests,0) end,'input_characters',usage_row.input_characters);
end $$;
revoke all on function private.consume_orby_quota_impl(uuid,integer) from public,anon,authenticated;
grant execute on function private.consume_orby_quota_impl(uuid,integer) to authenticated;

create table if not exists public.pricing_local_payment_requests (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 requested_by uuid not null references public.profiles(id) on delete restrict, variant_id uuid not null references public.pricing_variants(id) on delete restrict,
 price_book_id uuid not null references public.pricing_price_books(id) on delete restrict, payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
 currency text not null check(currency in ('SAR','USD','YER')), amount numeric(14,2) not null check(amount>=0), locked_entitlements jsonb not null,
 payment_reference text not null, storage_path text not null, original_filename text not null, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
 file_size bigint not null check(file_size between 1 and 10485760), status text not null default 'under_review' check(status in ('under_review','approved','rejected','cancelled')),
 reviewed_by uuid references public.profiles(id) on delete set null, reviewed_at timestamptz, review_note text, created_at timestamptz not null default now()
);
create unique index if not exists pricing_local_payment_one_review_idx on public.pricing_local_payment_requests(organization_id) where status='under_review';
create index if not exists pricing_local_payment_requested_idx on public.pricing_local_payment_requests(requested_by,created_at desc);
create index if not exists pricing_local_payment_method_idx on public.pricing_local_payment_requests(payment_method_id);

create or replace function private.submit_v2_local_payment_impl(target_organization uuid,target_variant uuid,target_method uuid,target_currency text,reference text,proof_path text,proof_name text,proof_mime text,proof_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; variant public.pricing_variants; current_variant public.pricing_variants; book public.pricing_price_books; price public.pricing_variant_prices; method public.payment_methods; entitlements jsonb; request_id uuid;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 select * into variant from public.pricing_variants where id=target_variant and is_active;
 if variant.id is null or variant.operating_mode<>(select operating_mode from public.organizations where id=target_organization) then raise exception 'PRICING_VARIANT_NOT_AVAILABLE'; end if;
 select v.* into current_variant from public.pricing_subscription_snapshots s join public.pricing_variants v on v.id=s.variant_id where s.organization_id=target_organization and s.status in ('trialing','active','past_due') order by s.created_at desc limit 1;
 if (case variant.level_code when 'BASIC' then 1 when 'PREMIUM' then 2 else 3 end)<(case current_variant.level_code when 'BASIC' then 1 when 'PREMIUM' then 2 else 3 end) then raise exception 'DOWNGRADE_MUST_BE_SCHEDULED'; end if;
 select * into book from public.pricing_price_books where is_default and status='active' order by valid_from desc limit 1;
 select * into price from public.pricing_variant_prices where price_book_id=book.id and variant_id=variant.id and currency=upper(target_currency);
 select * into method from public.payment_methods where id=target_method and is_active and currency=upper(target_currency);
 if price.variant_id is null or method.id is null then raise exception 'PAYMENT_METHOD_OR_PRICE_UNAVAILABLE'; end if;
 if char_length(trim(reference)) not between 3 and 120 or proof_mime not in ('image/jpeg','image/png','image/webp','application/pdf') or proof_size not between 1 and 10485760 then raise exception 'INVALID_PAYMENT_PROOF'; end if;
 if exists(select 1 from public.pricing_local_payment_requests where organization_id=target_organization and status='under_review') then raise exception 'PAYMENT_ALREADY_PENDING'; end if;
 select coalesce(jsonb_object_agg(entitlement_key,value),'{}'::jsonb) into entitlements from public.pricing_variant_entitlements where variant_id=variant.id;
 insert into public.pricing_local_payment_requests(organization_id,requested_by,variant_id,price_book_id,payment_method_id,currency,amount,locked_entitlements,payment_reference,storage_path,original_filename,mime_type,file_size)
 values(target_organization,actor,variant.id,book.id,method.id,upper(target_currency),price.amount,entitlements,trim(reference),proof_path,proof_name,proof_mime,proof_size) returning id into request_id;
 return request_id;
end $$;
revoke all on function private.submit_v2_local_payment_impl(uuid,uuid,uuid,text,text,text,text,text,bigint) from public,anon,authenticated;
grant execute on function private.submit_v2_local_payment_impl(uuid,uuid,uuid,text,text,text,text,text,bigint) to authenticated;
create or replace function public.submit_v2_local_payment(target_organization uuid,target_variant uuid,target_method uuid,target_currency text,reference text,proof_path text,proof_name text,proof_mime text,proof_size bigint)
returns uuid language sql security invoker set search_path='' as $$select private.submit_v2_local_payment_impl(target_organization,target_variant,target_method,target_currency,reference,proof_path,proof_name,proof_mime,proof_size)$$;
revoke all on function public.submit_v2_local_payment(uuid,uuid,uuid,text,text,text,text,text,bigint) from public,anon;
grant execute on function public.submit_v2_local_payment(uuid,uuid,uuid,text,text,text,text,text,bigint) to authenticated;

create or replace function private.review_v2_local_payment_impl(target_request uuid,decision text,note text)
returns public.pricing_local_payment_requests language plpgsql security definer set search_path='' as $$
declare request public.pricing_local_payment_requests; variant public.pricing_variants; current_sub public.pricing_subscription_snapshots;
begin
 if not private.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select * into request from public.pricing_local_payment_requests where id=target_request and status='under_review' for update;
 if request.id is null then raise exception 'PAYMENT_NOT_REVIEWABLE'; end if;
 if decision='approve' then
  select * into variant from public.pricing_variants where id=request.variant_id;
  select * into current_sub from public.pricing_subscription_snapshots where organization_id=request.organization_id and status in ('trialing','active','past_due') order by created_at desc limit 1 for update;
  if current_sub.id is not null then update public.pricing_subscription_snapshots set status='cancelled',ends_at=now(),updated_at=now() where id=current_sub.id; end if;
  insert into public.pricing_subscription_snapshots(organization_id,variant_id,price_book_id,currency,locked_amount,locked_entitlements,status,starts_at,ends_at,is_grandfathered)
  values(request.organization_id,request.variant_id,request.price_book_id,request.currency,request.amount,request.locked_entitlements,'active',now(),now()+(variant.term_months||' months')::interval,true);
  update public.pricing_local_payment_requests set status='approved',reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(trim(note),'') where id=request.id returning * into request;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'pricing.v2_payment.approved','organization',request.organization_id,jsonb_build_object('payment_request_id',request.id,'variant_id',request.variant_id,'amount',request.amount,'currency',request.currency));
 elsif decision='reject' then
  update public.pricing_local_payment_requests set status='rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(trim(note),'') where id=request.id returning * into request;
 else raise exception 'INVALID_DECISION'; end if;
 return request;
end $$;
revoke all on function private.review_v2_local_payment_impl(uuid,text,text) from public,anon,authenticated;
grant execute on function private.review_v2_local_payment_impl(uuid,text,text) to authenticated;
create or replace function public.review_v2_local_payment(target_request uuid,decision text,note text default null)
returns public.pricing_local_payment_requests language sql security invoker set search_path='' as $$select private.review_v2_local_payment_impl(target_request,decision,note)$$;
revoke all on function public.review_v2_local_payment(uuid,text,text) from public,anon;
grant execute on function public.review_v2_local_payment(uuid,text,text) to authenticated;

create or replace function public.apply_due_v2_subscription_changes(batch_limit integer default 100)
returns integer language plpgsql security invoker set search_path='' as $$
declare item record; variant public.pricing_variants; snapshot public.pricing_subscription_snapshots; book public.pricing_price_books; price public.pricing_variant_prices; entitlements jsonb; applied integer:=0;
begin
 for item in select * from public.pricing_subscription_changes where status='scheduled' and effective_at<=now() order by effective_at for update skip locked limit greatest(1,least(batch_limit,500)) loop
  select * into snapshot from public.pricing_subscription_snapshots where id=item.subscription_snapshot_id for update;
  select * into variant from public.pricing_variants where id=item.to_variant_id and is_active;
  select * into book from public.pricing_price_books where is_default and status='active' order by valid_from desc limit 1;
  select * into price from public.pricing_variant_prices where price_book_id=book.id and variant_id=variant.id and currency=snapshot.currency;
  select coalesce(jsonb_object_agg(entitlement_key,value),'{}'::jsonb) into entitlements from public.pricing_variant_entitlements where variant_id=variant.id;
  if variant.id is not null and price.variant_id is not null then
   update public.pricing_subscription_snapshots set status='cancelled',ends_at=coalesce(ends_at,now()),updated_at=now() where id=snapshot.id;
   insert into public.pricing_subscription_snapshots(organization_id,variant_id,price_book_id,currency,locked_amount,locked_entitlements,status,starts_at,ends_at)
   values(snapshot.organization_id,variant.id,book.id,snapshot.currency,price.amount,entitlements,'active',now(),now()+(variant.term_months||' months')::interval);
   update public.pricing_subscription_changes set status='applied',applied_at=now() where id=item.id; applied:=applied+1;
  end if;
 end loop;
 return applied;
end $$;
revoke all on function public.apply_due_v2_subscription_changes(integer) from public,anon,authenticated;
grant execute on function public.apply_due_v2_subscription_changes(integer) to service_role;

alter table public.pricing_local_payment_requests enable row level security;
create policy "members read v2 pricing payments" on public.pricing_local_payment_requests for select to authenticated using((select private.is_organization_member(organization_id)) or (select private.is_admin()));
grant select on public.pricing_local_payment_requests to authenticated;
grant all on public.pricing_local_payment_requests to service_role;

-- Orby receives the active sector contract and operational facts, not a forced
-- commerce-shaped representation of restaurant or hotel data.
create or replace function private.orby_business_context_impl(target_organization uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare analytics jsonb; stock jsonb; tasks jsonb; customers jsonb; activity jsonb; sector_context jsonb:='{}'::jsonb; allowed_tools jsonb; extension text; current_level text;
begin
 if (select auth.uid()) is null or not private.can_manage_business(target_organization,'financials') then raise exception 'NOT_AUTHORIZED'; end if;
 analytics:=private.business_analytics_impl(target_organization,current_date-29,current_date);
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'stock',p.stock_quantity,'threshold',p.low_stock_threshold) order by p.stock_quantity asc),'[]'::jsonb)
 into stock from (select * from public.business_products where organization_id=target_organization and is_active and stock_quantity<=low_stock_threshold order by stock_quantity limit 20) p;
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'priority',t.priority,'due_at',t.due_at) order by t.due_at),'[]'::jsonb)
 into tasks from (select * from public.business_tasks where organization_id=target_organization and status in ('todo','in_progress') and due_at<now() order by due_at limit 20) t;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'total_spent',c.total_spent,'last_order_at',c.last_order_at) order by c.total_spent desc),'[]'::jsonb)
 into customers from (select * from public.business_customers where organization_id=target_organization and status<>'inactive' and (last_order_at is null or last_order_at<now()-interval '60 days') order by total_spent desc limit 20) c;

 select p.extension_key,jsonb_build_object('family',f.code,'type',t.code,'specialization',s.code,'specialization_name',s.name_ar,'operating_mode',ap.operating_mode,'source_of_truth',o.source_of_truth,'terminology',s.terminology)
 into extension,activity from public.activity_profiles ap
 join public.activity_specializations s on s.id=ap.specialization_id join public.activity_types t on t.id=ap.activity_type_id join public.activity_families f on f.id=ap.family_id
 join public.activity_specialization_packages asp on asp.specialization_id=s.id join public.sector_packages p on p.id=asp.package_id
 join public.organizations o on o.id=ap.organization_id where ap.organization_id=target_organization and ap.status='active' order by asp.is_required desc limit 1;
 select v.level_code into current_level from public.pricing_subscription_snapshots ss join public.pricing_variants v on v.id=ss.variant_id
 where ss.organization_id=target_organization and ss.status in ('trialing','active','past_due') order by ss.created_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('key',tool.key,'name',tool.name_ar,'permission_mode',tool.permission_mode,'input_schema',tool.input_schema) order by tool.key),'[]'::jsonb)
 into allowed_tools from public.sector_orby_tools tool where tool.extension_key=extension and tool.status='approved' and coalesce(current_level,'BASIC')=any(tool.allowed_plan_levels);

 if extension='commerce' then
  select coalesce(to_jsonb(report),'{}'::jsonb) into sector_context from public.commerce_profit_report report where report.organization_id=target_organization;
 elsif extension='food_service' then
  sector_context:=jsonb_build_object(
   'profit',coalesce((select to_jsonb(report) from public.restaurant_profit_report report where report.organization_id=target_organization),'{}'::jsonb),
   'open_kitchen_tickets',(select count(*) from public.restaurant_kitchen_tickets where organization_id=target_organization and status in ('NEW','PREPARING')),
   'low_ingredients',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'stock',p.stock_quantity,'threshold',p.low_stock_threshold)) from public.business_products p where p.organization_id=target_organization and p.is_active and p.stock_quantity<=p.low_stock_threshold),'[]'::jsonb));
 elsif extension='hospitality' then
  sector_context:=jsonb_build_object(
   'daily',coalesce((select jsonb_agg(to_jsonb(report)) from public.hotel_daily_report report where report.organization_id=target_organization),'[]'::jsonb),
   'arrivals_today',(select count(*) from public.hotel_reservations r join public.hotel_properties p on p.id=r.property_id where p.organization_id=target_organization and r.check_in_date=current_date and r.status in ('CONFIRMED','CHECKED_IN')),
   'departures_today',(select count(*) from public.hotel_reservations r join public.hotel_properties p on p.id=r.property_id where p.organization_id=target_organization and r.check_out_date=current_date and r.status in ('CHECKED_IN','CHECKED_OUT')),
   'open_housekeeping',(select count(*) from public.hotel_housekeeping_tasks where organization_id=target_organization and status in ('PENDING','IN_PROGRESS')),
   'open_maintenance',(select count(*) from public.hotel_maintenance_requests where organization_id=target_organization and status in ('OPEN','IN_PROGRESS')));
 end if;
 return jsonb_build_object('analytics',analytics,'low_stock',stock,'overdue_tasks',tasks,'inactive_customers',customers,'activity',coalesce(activity,'{}'::jsonb),'sector_context',sector_context,'allowed_sector_tools',coalesce(allowed_tools,'[]'::jsonb));
end $$;
revoke all on function private.orby_business_context_impl(uuid) from public,anon,authenticated;
grant execute on function private.orby_business_context_impl(uuid) to authenticated;

-- Daily configuration RPCs for restaurant/hotel operators.
create or replace function private.create_restaurant_recipe_impl(target_organization uuid,recipe_name text,recipe_code text,menu_price numeric,yield_quantity numeric,preparation_minutes integer,ingredients jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; recipe_id uuid:=gen_random_uuid(); ingredient jsonb;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if char_length(trim(recipe_name))<2 or char_length(trim(recipe_code))<2 or menu_price<0 or yield_quantity<=0 then raise exception 'INVALID_RECIPE'; end if;
 if jsonb_typeof(ingredients)<>'array' or jsonb_array_length(ingredients)=0 then raise exception 'RECIPE_INGREDIENTS_REQUIRED'; end if;
 insert into public.restaurant_recipes(id,organization_id,name,recipe_code,menu_price,yield_quantity,preparation_minutes)
 values(recipe_id,target_organization,trim(recipe_name),upper(trim(recipe_code)),menu_price,yield_quantity,greatest(preparation_minutes,0));
 for ingredient in select value from jsonb_array_elements(ingredients) loop
  if not exists(select 1 from public.business_products where id=(ingredient->>'product_id')::uuid and organization_id=target_organization) or coalesce((ingredient->>'quantity')::numeric,0)<=0 then raise exception 'INVALID_RECIPE_INGREDIENT'; end if;
  insert into public.restaurant_recipe_ingredients(organization_id,recipe_id,product_id,quantity,waste_percent)
  values(target_organization,recipe_id,(ingredient->>'product_id')::uuid,(ingredient->>'quantity')::numeric,greatest(0,least(coalesce((ingredient->>'waste_percent')::numeric,0),100)));
 end loop;
 insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id) values(target_organization,'food_service','food_service.recipe.created','recipe',recipe_id,jsonb_build_object('menu_price',menu_price),actor);
 return recipe_id;
end $$;
revoke all on function private.create_restaurant_recipe_impl(uuid,text,text,numeric,numeric,integer,jsonb) from public,anon,authenticated;
grant execute on function private.create_restaurant_recipe_impl(uuid,text,text,numeric,numeric,integer,jsonb) to authenticated;
create or replace function public.create_restaurant_recipe(target_organization uuid,recipe_name text,recipe_code text,menu_price numeric,yield_quantity numeric,preparation_minutes integer,ingredients jsonb)
returns uuid language sql security invoker set search_path='' as $$select private.create_restaurant_recipe_impl(target_organization,recipe_name,recipe_code,menu_price,yield_quantity,preparation_minutes,ingredients)$$;
revoke all on function public.create_restaurant_recipe(uuid,text,text,numeric,numeric,integer,jsonb) from public,anon;
grant execute on function public.create_restaurant_recipe(uuid,text,text,numeric,numeric,integer,jsonb) to authenticated;

create or replace function private.create_hotel_room_rate_impl(target_organization uuid,target_property uuid,room_number text,room_type text,capacity integer,rate_code text,rate_name text,currency text,nightly_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; room_id uuid; rate_id uuid;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if not exists(select 1 from public.hotel_properties where id=target_property and organization_id=target_organization and is_active) then raise exception 'HOTEL_PROPERTY_NOT_FOUND'; end if;
 if char_length(trim(room_number))<1 or char_length(trim(room_type))<2 or capacity<1 or upper(currency) not in ('SAR','USD','YER') or nightly_amount<0 then raise exception 'INVALID_ROOM_RATE'; end if;
 insert into public.hotel_rooms(organization_id,property_id,room_number,room_type,capacity) values(target_organization,target_property,trim(room_number),trim(room_type),capacity) returning id into room_id;
 insert into public.hotel_rates(organization_id,property_id,code,name,room_type,currency,nightly_amount) values(target_organization,target_property,upper(trim(rate_code)),trim(rate_name),trim(room_type),upper(currency),nightly_amount)
 on conflict(property_id,code) do update set name=excluded.name,room_type=excluded.room_type,currency=excluded.currency,nightly_amount=excluded.nightly_amount,is_active=true returning id into rate_id;
 insert into public.hotel_rate_availability(organization_id,rate_id,stay_date,available_rooms)
 select target_organization,rate_id,day::date,1 from generate_series(current_date,current_date+365,interval '1 day') day
 on conflict(rate_id,stay_date) do update set available_rooms=public.hotel_rate_availability.available_rooms+1;
 insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id) values(target_organization,'hospitality','hospitality.room.created','hotel_room',room_id,jsonb_build_object('rate_id',rate_id),actor);
 return jsonb_build_object('room_id',room_id,'rate_id',rate_id);
end $$;
revoke all on function private.create_hotel_room_rate_impl(uuid,uuid,text,text,integer,text,text,text,numeric) from public,anon,authenticated;
grant execute on function private.create_hotel_room_rate_impl(uuid,uuid,text,text,integer,text,text,text,numeric) to authenticated;
create or replace function public.create_hotel_room_rate(target_organization uuid,target_property uuid,room_number text,room_type text,capacity integer,rate_code text,rate_name text,currency text,nightly_amount numeric)
returns jsonb language sql security invoker set search_path='' as $$select private.create_hotel_room_rate_impl(target_organization,target_property,room_number,room_type,capacity,rate_code,rate_name,currency,nightly_amount)$$;
revoke all on function public.create_hotel_room_rate(uuid,uuid,text,text,integer,text,text,text,numeric) from public,anon;
grant execute on function public.create_hotel_room_rate(uuid,uuid,text,text,integer,text,text,text,numeric) to authenticated;

create or replace function private.update_housekeeping_task_impl(target_organization uuid,target_task uuid,next_status text,task_notes text)
returns public.hotel_housekeeping_tasks language plpgsql security definer set search_path='' as $$
declare actor uuid; task public.hotel_housekeeping_tasks;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if upper(next_status) not in ('ASSIGNED','IN_PROGRESS','INSPECTION','COMPLETED','BLOCKED') then raise exception 'INVALID_HOUSEKEEPING_STATUS'; end if;
 update public.hotel_housekeeping_tasks set status=upper(next_status),notes=coalesce(nullif(trim(task_notes),''),notes),started_at=case when upper(next_status)='IN_PROGRESS' then coalesce(started_at,now()) else started_at end,completed_at=case when upper(next_status)='COMPLETED' then now() else completed_at end
 where id=target_task and organization_id=target_organization returning * into task;
 if task.id is null then raise exception 'HOUSEKEEPING_TASK_NOT_FOUND'; end if;
 if upper(next_status)='COMPLETED' then update public.hotel_rooms set status='AVAILABLE' where id=task.room_id and status in ('DIRTY','CLEANING'); else if upper(next_status)='IN_PROGRESS' then update public.hotel_rooms set status='CLEANING' where id=task.room_id and status='DIRTY'; end if; end if;
 return task;
end $$;
revoke all on function private.update_housekeeping_task_impl(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.update_housekeeping_task_impl(uuid,uuid,text,text) to authenticated;
create or replace function public.update_housekeeping_task(target_organization uuid,target_task uuid,next_status text,task_notes text default null)
returns public.hotel_housekeeping_tasks language sql security invoker set search_path='' as $$select private.update_housekeeping_task_impl(target_organization,target_task,next_status,task_notes)$$;
revoke all on function public.update_housekeeping_task(uuid,uuid,text,text) from public,anon;
grant execute on function public.update_housekeeping_task(uuid,uuid,text,text) to authenticated;

create or replace function private.manage_hotel_maintenance_impl(target_organization uuid,target_room uuid,request_title text,request_description text,request_priority text,target_request uuid,next_status text)
returns public.hotel_maintenance_requests language plpgsql security definer set search_path='' as $$
declare actor uuid; request public.hotel_maintenance_requests; normalized_status text:=upper(coalesce(next_status,'OPEN')); normalized_priority text:=upper(coalesce(request_priority,'NORMAL'));
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if target_request is null then
  if target_room is not null and not exists(select 1 from public.hotel_rooms where id=target_room and organization_id=target_organization) then raise exception 'HOTEL_ROOM_NOT_FOUND'; end if;
  if char_length(trim(request_title))<2 or normalized_priority not in ('LOW','NORMAL','HIGH','EMERGENCY') then raise exception 'INVALID_MAINTENANCE_REQUEST'; end if;
  insert into public.hotel_maintenance_requests(organization_id,room_id,title,description,priority,status,created_by)
  values(target_organization,target_room,trim(request_title),nullif(trim(request_description),''),normalized_priority,'OPEN',actor) returning * into request;
  if target_room is not null and normalized_priority in ('HIGH','EMERGENCY') then update public.hotel_rooms set status='MAINTENANCE' where id=target_room and status not in ('OCCUPIED','OUT_OF_SERVICE'); end if;
  insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
  values(target_organization,'hospitality','hospitality.maintenance.opened','hotel_room',target_room,jsonb_build_object('request_id',request.id,'priority',normalized_priority),actor);
 else
  if normalized_status not in ('ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED') then raise exception 'INVALID_MAINTENANCE_STATUS'; end if;
  update public.hotel_maintenance_requests set status=normalized_status,resolved_at=case when normalized_status in ('RESOLVED','CLOSED') then coalesce(resolved_at,now()) else resolved_at end
  where id=target_request and organization_id=target_organization returning * into request;
  if request.id is null then raise exception 'MAINTENANCE_REQUEST_NOT_FOUND'; end if;
  if request.room_id is not null and normalized_status in ('RESOLVED','CLOSED','CANCELLED') and not exists(
   select 1 from public.hotel_maintenance_requests active where active.organization_id=target_organization and active.room_id=request.room_id and active.id<>request.id and active.status in ('OPEN','ASSIGNED','IN_PROGRESS')
  ) then update public.hotel_rooms set status='AVAILABLE' where id=request.room_id and status='MAINTENANCE'; end if;
  insert into public.sector_operation_events(organization_id,extension_key,event_key,entity_type,entity_id,payload,actor_id)
  values(target_organization,'hospitality','hospitality.maintenance.updated','hotel_room',request.room_id,jsonb_build_object('request_id',request.id,'status',normalized_status),actor);
 end if;
 return request;
end $$;
revoke all on function private.manage_hotel_maintenance_impl(uuid,uuid,text,text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.manage_hotel_maintenance_impl(uuid,uuid,text,text,text,uuid,text) to authenticated;
create or replace function public.manage_hotel_maintenance(target_organization uuid,target_room uuid default null,request_title text default null,request_description text default null,request_priority text default 'NORMAL',target_request uuid default null,next_status text default null)
returns public.hotel_maintenance_requests language sql security invoker set search_path='' as $$select private.manage_hotel_maintenance_impl(target_organization,target_room,request_title,request_description,request_priority,target_request,next_status)$$;
revoke all on function public.manage_hotel_maintenance(uuid,uuid,text,text,text,uuid,text) from public,anon;
grant execute on function public.manage_hotel_maintenance(uuid,uuid,text,text,text,uuid,text) to authenticated;

create or replace function private.post_hotel_folio_charge_impl(target_organization uuid,target_folio uuid,charge_type text,description text,amount numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; charge_id uuid;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 if upper(charge_type) not in ('ROOM_SERVICE','MINIBAR','LAUNDRY','TAX','FEE','ADJUSTMENT') or amount=0 or char_length(trim(description))<2 then raise exception 'INVALID_FOLIO_CHARGE'; end if;
 if not exists(select 1 from public.hotel_folios where id=target_folio and organization_id=target_organization and status='OPEN') then raise exception 'FOLIO_NOT_OPEN'; end if;
 insert into public.hotel_folio_charges(organization_id,folio_id,charge_type,description,amount,posted_by) values(target_organization,target_folio,upper(charge_type),trim(description),amount,actor) returning id into charge_id;
 update public.hotel_folios set total_charges=total_charges+amount where id=target_folio;
 return charge_id;
end $$;
revoke all on function private.post_hotel_folio_charge_impl(uuid,uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function private.post_hotel_folio_charge_impl(uuid,uuid,text,text,numeric) to authenticated;
create or replace function public.post_hotel_folio_charge(target_organization uuid,target_folio uuid,charge_type text,description text,amount numeric)
returns uuid language sql security invoker set search_path='' as $$select private.post_hotel_folio_charge_impl(target_organization,target_folio,charge_type,description,amount)$$;
revoke all on function public.post_hotel_folio_charge(uuid,uuid,text,text,numeric) from public,anon;
grant execute on function public.post_hotel_folio_charge(uuid,uuid,text,text,numeric) to authenticated;

create or replace function private.complete_v2_setup_impl(target_organization uuid,answers jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid; profile_id uuid; item record; question public.activity_onboarding_questions; numeric_value numeric;
begin
 actor:=private.assert_v2_organization_access(target_organization,true);
 select id into profile_id from public.activity_profiles where organization_id=target_organization and status='active';
 if profile_id is null then raise exception 'ACTIVITY_PROFILE_REQUIRED'; end if;
 for item in select key,value from jsonb_each(coalesce(answers,'{}'::jsonb)) loop
  select q.* into question from public.activity_onboarding_questions q join public.activity_profiles p on p.id=profile_id and p.specialization_id=q.specialization_id where q.key=item.key and q.is_active;
  if question.id is null then raise exception 'ACTIVITY_QUESTION_NOT_AVAILABLE'; end if;
  if question.field_type in ('text','select') and jsonb_typeof(item.value)<>'string' then raise exception 'INVALID_ACTIVITY_ANSWER_TYPE'; end if;
  if question.field_type='boolean' and jsonb_typeof(item.value)<>'boolean' then raise exception 'INVALID_ACTIVITY_ANSWER_TYPE'; end if;
  if question.field_type='number' then
   if jsonb_typeof(item.value)<>'number' then raise exception 'INVALID_ACTIVITY_ANSWER_TYPE'; end if;
   numeric_value:=(item.value#>>'{}')::numeric;
   if question.validation ? 'min' and numeric_value<(question.validation->>'min')::numeric then raise exception 'ACTIVITY_ANSWER_BELOW_MINIMUM'; end if;
   if question.validation ? 'max' and numeric_value>(question.validation->>'max')::numeric then raise exception 'ACTIVITY_ANSWER_ABOVE_MAXIMUM'; end if;
  end if;
  if question.field_type='text' and question.validation ? 'maxLength' and char_length(item.value#>>'{}')>(question.validation->>'maxLength')::integer then raise exception 'ACTIVITY_ANSWER_TOO_LONG'; end if;
  if question.field_type='select' and not question.options @> jsonb_build_array(item.value) then raise exception 'INVALID_ACTIVITY_OPTION'; end if;
  if question.field_type='multiselect' then
   if jsonb_typeof(item.value)<>'array' or (question.is_required and jsonb_array_length(item.value)=0) then raise exception 'INVALID_ACTIVITY_ANSWER_TYPE'; end if;
   if exists(select 1 from jsonb_array_elements(item.value) as selected(value) where not question.options @> jsonb_build_array(selected.value)) then raise exception 'INVALID_ACTIVITY_OPTION'; end if;
  end if;
  if question.is_required and question.field_type in ('text','select') and char_length(trim(item.value#>>'{}'))=0 then raise exception 'REQUIRED_ACTIVITY_ANSWERS_MISSING'; end if;
  insert into public.activity_profile_answers(activity_profile_id,question_id,answer) values(profile_id,question.id,item.value)
  on conflict(activity_profile_id,question_id) do update set answer=excluded.answer,answered_at=now();
 end loop;
 if exists(
  select 1 from public.activity_onboarding_questions q join public.activity_profiles p on p.specialization_id=q.specialization_id and p.id=profile_id
  where q.is_active and q.is_required and (
   q.condition='{}'::jsonb or
   (q.condition ? 'equals' and exists(select 1 from public.activity_onboarding_questions dependency join public.activity_profile_answers answer on answer.question_id=dependency.id and answer.activity_profile_id=profile_id where dependency.specialization_id=p.specialization_id and dependency.key=q.condition->>'field' and answer.answer=q.condition->'equals')) or
   (q.condition ? 'in' and exists(select 1 from public.activity_onboarding_questions dependency join public.activity_profile_answers answer on answer.question_id=dependency.id and answer.activity_profile_id=profile_id where dependency.specialization_id=p.specialization_id and dependency.key=q.condition->>'field' and q.condition->'in' @> jsonb_build_array(answer.answer)))
  ) and not exists(select 1 from public.activity_profile_answers a where a.activity_profile_id=profile_id and a.question_id=q.id)
 ) then raise exception 'REQUIRED_ACTIVITY_ANSWERS_MISSING'; end if;
 update public.organizations set setup_status='ready',onboarding_completed_at=now() where id=target_organization;
 return true;
end $$;
revoke all on function private.complete_v2_setup_impl(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.complete_v2_setup_impl(uuid,jsonb) to authenticated;
create or replace function public.complete_v2_setup(target_organization uuid,answers jsonb default '{}'::jsonb)
returns boolean language sql security invoker set search_path='' as $$select private.complete_v2_setup_impl(target_organization,answers)$$;
revoke all on function public.complete_v2_setup(uuid,jsonb) from public,anon;
grant execute on function public.complete_v2_setup(uuid,jsonb) to authenticated;
