-- MADAR Store Engine: permanent catalog, subscriptions, media, visibility and seed data.
-- This migration is additive and keeps the existing product/service data compatible.
begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.store_visibility as enum ('visible','hidden');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_item_type as enum ('digital_product','ready_system','service','subscription','bundle','template','student_resource');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.store_delivery_type as enum ('instant_download','manual_delivery','external_link','account_activation','scheduled_service');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.catalog_status add value if not exists 'coming_soon';
  alter type public.catalog_status add value if not exists 'sold_out';
  alter type public.catalog_status add value if not exists 'disabled';
exception when duplicate_object then null; end $$;

alter table public.categories
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists visibility public.store_visibility not null default 'hidden',
  add column if not exists deleted_at timestamptz;

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  seo_title text,
  seo_description text,
  visibility public.store_visibility not null default 'hidden',
  is_active boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(category_id,name)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists product_type public.store_item_type not null default 'digital_product',
  add column if not exists visibility public.store_visibility not null default 'hidden',
  add column if not exists is_active boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists view_count bigint not null default 0,
  add column if not exists sales_count bigint not null default 0,
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0,
  add column if not exists video_url text,
  add column if not exists external_url text,
  add column if not exists purchase_url text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists delivery_duration text,
  add column if not exists requires_approval boolean not null default false,
  add column if not exists is_free boolean not null default false,
  add column if not exists show_in_store boolean not null default false,
  add column if not exists show_on_home boolean not null default false,
  add column if not exists allow_reviews boolean not null default true,
  add column if not exists allow_comments boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.services
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null,
  add column if not exists service_type public.store_item_type not null default 'service',
  add column if not exists visibility public.store_visibility not null default 'hidden',
  add column if not exists is_active boolean not null default false,
  add column if not exists sort_order integer not null default 0,
  add column if not exists view_count bigint not null default 0,
  add column if not exists sales_count bigint not null default 0,
  add column if not exists rating_average numeric(3,2) not null default 0,
  add column if not exists rating_count integer not null default 0,
  add column if not exists video_url text,
  add column if not exists external_url text,
  add column if not exists purchase_url text,
  add column if not exists keywords text[] not null default '{}',
  add column if not exists delivery_duration text,
  add column if not exists delivery_type public.store_delivery_type not null default 'scheduled_service',
  add column if not exists requires_approval boolean not null default true,
  add column if not exists is_free boolean not null default false,
  add column if not exists show_in_store boolean not null default false,
  add column if not exists show_on_home boolean not null default false,
  add column if not exists allow_reviews boolean not null default true,
  add column if not exists allow_comments boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.product_images
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.product_files
  add column if not exists title text,
  add column if not exists file_kind text not null default 'download',
  add column if not exists is_public boolean not null default false,
  add column if not exists download_limit integer,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table public.service_images
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

create table if not exists public.product_tags (
  product_id uuid not null references public.products(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(product_id,tag_id)
);

create table if not exists public.service_tags (
  service_id uuid not null references public.services(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(service_id,tag_id)
);

create table if not exists public.product_gallery (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null default 'image' check(media_type in ('image','video')),
  storage_path text,
  external_url text,
  alt_text text,
  caption text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(storage_path is not null or external_url is not null)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  long_description text,
  price numeric(12,2) not null default 0 check(price>=0),
  compare_at_price numeric(12,2) check(compare_at_price is null or compare_at_price>=0),
  currency text not null default 'SAR',
  billing_interval text not null default 'monthly' check(billing_interval in ('one_time','monthly','quarterly','yearly')),
  trial_days integer not null default 0 check(trial_days>=0),
  status public.catalog_status not null default 'draft',
  visibility public.store_visibility not null default 'hidden',
  is_active boolean not null default false,
  is_featured boolean not null default false,
  show_in_store boolean not null default false,
  show_on_home boolean not null default false,
  requires_approval boolean not null default true,
  sort_order integer not null default 0,
  max_workspaces integer,
  max_users integer,
  seo_title text,
  seo_description text,
  keywords text[] not null default '{}',
  purchase_url text,
  published_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  name text not null,
  description text,
  feature_key text,
  value jsonb not null default 'true'::jsonb,
  is_highlighted boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  discount_type text not null default 'percentage' check(discount_type in ('percentage','fixed','override_price')),
  discount_value numeric(12,2) not null default 0 check(discount_value>=0),
  starts_at timestamptz,
  ends_at timestamptz,
  status public.catalog_status not null default 'draft',
  visibility public.store_visibility not null default 'hidden',
  is_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_items (
  offer_id uuid not null references public.offers(id) on delete cascade,
  entity_type text not null check(entity_type in ('product','service','plan')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(offer_id,entity_type,entity_id)
);

create table if not exists public.featured_items (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check(entity_type in ('product','service','plan','category')),
  entity_id uuid not null,
  placement text not null default 'store' check(placement in ('store','home','offers','category')),
  title_override text,
  subtitle_override text,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type,entity_id,placement)
);

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  deleted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subcategories_category_active_idx on public.subcategories(category_id,is_active,sort_order) where deleted_at is null;
create index if not exists tags_active_name_idx on public.tags(is_active,name) where deleted_at is null;
create index if not exists products_store_listing_idx on public.products(status,visibility,is_active,show_in_store,sort_order,published_at desc) where deleted_at is null;
create index if not exists products_store_category_idx on public.products(category_id,subcategory_id,status,visibility) where deleted_at is null;
create index if not exists products_store_sales_idx on public.products(sales_count desc,rating_average desc) where deleted_at is null;
create index if not exists services_store_listing_idx on public.services(status,visibility,is_active,show_in_store,sort_order,published_at desc) where deleted_at is null;
create index if not exists services_store_category_idx on public.services(category_id,subcategory_id,status,visibility) where deleted_at is null;
create index if not exists plans_store_listing_idx on public.plans(status,visibility,is_active,sort_order,published_at desc) where deleted_at is null;
create index if not exists product_gallery_product_idx on public.product_gallery(product_id,sort_order) where deleted_at is null;
create index if not exists plan_features_plan_idx on public.plan_features(plan_id,sort_order) where deleted_at is null;
create index if not exists offers_active_window_idx on public.offers(is_active,starts_at,ends_at) where deleted_at is null;
create index if not exists featured_items_placement_idx on public.featured_items(placement,is_active,sort_order) where deleted_at is null;
create index if not exists store_settings_public_idx on public.store_settings(is_public,setting_key) where deleted_at is null;
create index if not exists products_search_idx on public.products using gin(to_tsvector('simple',coalesce(name,'')||' '||coalesce(short_description,'')||' '||coalesce(long_description,'')||' '||coalesce(seo_title,'')||' '||coalesce(seo_description,'')||' '||array_to_string(keywords,' ')));
create index if not exists services_search_idx on public.services using gin(to_tsvector('simple',coalesce(name,'')||' '||coalesce(short_description,'')||' '||coalesce(long_description,'')||' '||coalesce(seo_title,'')||' '||coalesce(seo_description,'')||' '||array_to_string(keywords,' ')));

create trigger subcategories_updated before update on public.subcategories for each row execute function public.touch_updated_at();
create trigger tags_updated before update on public.tags for each row execute function public.touch_updated_at();
create trigger product_images_updated before update on public.product_images for each row execute function public.touch_updated_at();
create trigger product_files_updated before update on public.product_files for each row execute function public.touch_updated_at();
create trigger service_images_updated before update on public.service_images for each row execute function public.touch_updated_at();
create trigger product_gallery_updated before update on public.product_gallery for each row execute function public.touch_updated_at();
create trigger plans_updated before update on public.plans for each row execute function public.touch_updated_at();
create trigger plan_features_updated before update on public.plan_features for each row execute function public.touch_updated_at();
create trigger offers_updated before update on public.offers for each row execute function public.touch_updated_at();
create trigger featured_items_updated before update on public.featured_items for each row execute function public.touch_updated_at();
create trigger store_settings_updated before update on public.store_settings for each row execute function public.touch_updated_at();

alter table public.subcategories enable row level security;
alter table public.tags enable row level security;
alter table public.product_tags enable row level security;
alter table public.service_tags enable row level security;
alter table public.product_gallery enable row level security;
alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.offers enable row level security;
alter table public.offer_items enable row level security;
alter table public.featured_items enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "active categories public" on public.categories;
drop policy if exists "published products public" on public.products;
drop policy if exists "published services public" on public.services;
drop policy if exists "published product images public" on public.product_images;
drop policy if exists "published service images public" on public.service_images;

create policy "visible categories public" on public.categories for select using((is_active and visibility='visible' and deleted_at is null) or public.is_admin());
create policy "visible products public" on public.products for select using((status='published' and visibility='visible' and is_active and show_in_store and deleted_at is null) or public.is_admin());
create policy "visible services public" on public.services for select using((status='published' and visibility='visible' and is_active and show_in_store and deleted_at is null) or public.is_admin());
create policy "visible product images public" on public.product_images for select using(deleted_at is null and exists(select 1 from public.products p where p.id=product_id and ((p.status='published' and p.visibility='visible' and p.is_active and p.show_in_store and p.deleted_at is null) or public.is_admin())));
create policy "visible service images public" on public.service_images for select using(deleted_at is null and exists(select 1 from public.services s where s.id=service_id and ((s.status='published' and s.visibility='visible' and s.is_active and s.show_in_store and s.deleted_at is null) or public.is_admin())));

create policy "visible subcategories public" on public.subcategories for select using((is_active and visibility='visible' and deleted_at is null) or public.is_admin());
create policy "admins subcategories" on public.subcategories for all using(public.is_admin()) with check(public.is_admin());
create policy "visible tags public" on public.tags for select using((is_active and deleted_at is null) or public.is_admin());
create policy "admins tags" on public.tags for all using(public.is_admin()) with check(public.is_admin());
create policy "visible product tags public" on public.product_tags for select using(exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.visibility='visible' and p.is_active and p.show_in_store and p.deleted_at is null) or public.is_admin());
create policy "admins product tags" on public.product_tags for all using(public.is_admin()) with check(public.is_admin());
create policy "visible service tags public" on public.service_tags for select using(exists(select 1 from public.services s where s.id=service_id and s.status='published' and s.visibility='visible' and s.is_active and s.show_in_store and s.deleted_at is null) or public.is_admin());
create policy "admins service tags" on public.service_tags for all using(public.is_admin()) with check(public.is_admin());
create policy "visible gallery public" on public.product_gallery for select using(deleted_at is null and exists(select 1 from public.products p where p.id=product_id and p.status='published' and p.visibility='visible' and p.is_active and p.show_in_store and p.deleted_at is null) or public.is_admin());
create policy "admins gallery" on public.product_gallery for all using(public.is_admin()) with check(public.is_admin());
create policy "visible plans public" on public.plans for select using((status='published' and visibility='visible' and is_active and show_in_store and deleted_at is null) or public.is_admin());
create policy "admins plans" on public.plans for all using(public.is_admin()) with check(public.is_admin());
create policy "visible plan features public" on public.plan_features for select using(deleted_at is null and exists(select 1 from public.plans p where p.id=plan_id and p.status='published' and p.visibility='visible' and p.is_active and p.show_in_store and p.deleted_at is null) or public.is_admin());
create policy "admins plan features" on public.plan_features for all using(public.is_admin()) with check(public.is_admin());
create policy "visible offers public" on public.offers for select using((status='published' and visibility='visible' and is_active and deleted_at is null and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())) or public.is_admin());
create policy "admins offers" on public.offers for all using(public.is_admin()) with check(public.is_admin());
create policy "visible offer items public" on public.offer_items for select using(exists(select 1 from public.offers o where o.id=offer_id and o.status='published' and o.visibility='visible' and o.is_active and o.deleted_at is null) or public.is_admin());
create policy "admins offer items" on public.offer_items for all using(public.is_admin()) with check(public.is_admin());
create policy "visible featured public" on public.featured_items for select using((is_active and deleted_at is null and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())) or public.is_admin());
create policy "admins featured" on public.featured_items for all using(public.is_admin()) with check(public.is_admin());
create policy "public store settings" on public.store_settings for select using((is_public and deleted_at is null) or public.is_admin());
create policy "admins store settings" on public.store_settings for all using(public.is_admin()) with check(public.is_admin());

insert into public.categories(name,slug,description,is_active,visibility,sort_order)
values
 ('التجارة والأعمال','commerce-business','أنظمة وأدوات تشغيل التجارة والأعمال.',false,'hidden',10),
 ('الذكاء الاصطناعي','artificial-intelligence','أدوات وبرومبتات وحلول الذكاء الاصطناعي.',false,'hidden',20),
 ('القوالب','templates','قوالب رقمية احترافية قابلة للتخصيص.',false,'hidden',30),
 ('الطلاب','students','موارد وأدوات مخصصة للطلاب الجامعيين.',false,'hidden',40),
 ('الأنظمة','systems','أنظمة ومواقع جاهزة وقابلة للتخصيص.',false,'hidden',50),
 ('الخدمات','services','خدمات مَدار البرمجية والتقنية والإبداعية.',false,'hidden',60)
on conflict(slug) do nothing;

insert into public.subcategories(category_id,name,slug,description,is_active,visibility,sort_order)
select c.id,v.name,v.slug,v.description,false,'hidden',v.sort_order
from (values
 ('services','البرمجة','programming-services','تطوير وإصلاح وتحسين البرمجيات.',10),
 ('services','الذكاء الاصطناعي','ai-services','بناء ودمج وأتمتة حلول الذكاء الاصطناعي.',20),
 ('services','التصميم','design-services','الشعارات والهويات وتجربة المستخدم والمحتوى البصري.',30),
 ('services','التسويق','marketing-services','إدارة وتسويق المحتوى والحملات والظهور.',40),
 ('services','التجارة الإلكترونية','ecommerce-services','إنشاء وربط وتحسين المتاجر الإلكترونية.',50),
 ('services','الاستشارات','consulting-services','استشارات أعمال وتقنية وذكاء اصطناعي وتسويق.',60),
 ('templates','Notion','notion-templates','قوالب Notion.',10),
 ('templates','Excel','excel-templates','قوالب Excel.',20),
 ('templates','Google Sheets','google-sheets-templates','قوالب Google Sheets.',30),
 ('templates','Word','word-templates','قوالب Word.',40),
 ('templates','PowerPoint','powerpoint-templates','قوالب PowerPoint.',50),
 ('templates','Canva','canva-templates','قوالب Canva.',60)
) as v(category_slug,name,slug,description,sort_order)
join public.categories c on c.slug=v.category_slug
on conflict(slug) do nothing;

insert into public.tags(name,slug,description,is_active)
values
 ('منتج رقمي','digital-product','تسليم رقمي.',false),
 ('نظام جاهز','ready-system','نظام جاهز للتخصيص.',false),
 ('ذكاء اصطناعي','ai','حلول وموارد ذكاء اصطناعي.',false),
 ('أعمال','business','أدوات موجهة للأعمال.',false),
 ('طلاب','students','موارد طلابية.',false),
 ('قالب','template','قالب قابل للتعديل.',false)
on conflict(slug) do nothing;

insert into public.products(name,slug,short_description,price,currency,category_id,product_type,status,visibility,is_active,show_in_store,show_on_home,is_featured,requires_approval,is_free,sort_order)
select v.name,v.slug,v.description,0,'SAR',c.id,v.kind::public.store_item_type,'draft','hidden',false,false,false,false,true,false,v.sort_order
from (values
 ('commerce-business','نظام إدارة واتساب للأعمال Lite','whatsapp-business-lite','إصدار مبسط لتنظيم محادثات وعمليات واتساب للأعمال.','ready_system',10),
 ('commerce-business','نظام إدارة واتساب للأعمال Pro','whatsapp-business-pro','إصدار متقدم لإدارة واتساب للأعمال.','ready_system',20),
 ('commerce-business','نظام CRM','crm-system','نظام لإدارة العملاء والعلاقات والفرص.','ready_system',30),
 ('commerce-business','نظام إدارة الطلبات','order-management-system','نظام لتنظيم الطلبات وحالاتها.','ready_system',40),
 ('commerce-business','نظام إدارة المخزون','inventory-management-system','نظام لمتابعة المخزون والحركات والتنبيهات.','ready_system',50),
 ('commerce-business','نظام الفواتير','invoice-management-system','نظام لإنشاء الفواتير وتنظيمها.','ready_system',60),
 ('commerce-business','نظام إدارة المبيعات','sales-management-system','نظام لتسجيل المبيعات ومتابعة الأداء.','ready_system',70),
 ('commerce-business','نظام الموردين','supplier-management-system','نظام لإدارة الموردين والمشتريات.','ready_system',80),
 ('commerce-business','لوحة الأرباح','profit-dashboard','لوحة لمتابعة الأرباح والهوامش.','digital_product',90),
 ('commerce-business','لوحة التحليلات','analytics-dashboard','لوحة تحليلات تشغيلية للأعمال.','digital_product',100),
 ('artificial-intelligence','مكتبة البرومبتات','prompt-library','مكتبة منظمة من البرومبتات العملية.','digital_product',110),
 ('artificial-intelligence','برومبتات التسويق','marketing-prompts','برومبتات للتسويق وصناعة المحتوى.','digital_product',120),
 ('artificial-intelligence','برومبتات التجارة','commerce-prompts','برومبتات لإدارة وتنمية التجارة.','digital_product',130),
 ('artificial-intelligence','برومبتات البرمجة','programming-prompts','برومبتات للمساعدة في التطوير البرمجي.','digital_product',140),
 ('artificial-intelligence','برومبتات الإدارة','management-prompts','برومبتات للإدارة والتخطيط واتخاذ القرار.','digital_product',150),
 ('artificial-intelligence','برومبتات خدمة العملاء','customer-service-prompts','برومبتات لخدمة العملاء والدعم.','digital_product',160),
 ('artificial-intelligence','برومبتات التعليم','education-prompts','برومبتات للتعليم والتعلم.','digital_product',170),
 ('artificial-intelligence','برومبتات البحث العلمي','research-prompts','برومبتات منظمة للبحث العلمي.','digital_product',180),
 ('templates','قوالب Notion','notion-templates','قوالب Notion احترافية.','template',190),
 ('templates','قوالب Excel','excel-templates','قوالب Excel للأعمال والإدارة.','template',200),
 ('templates','قوالب Google Sheets','google-sheets-templates','قوالب Google Sheets مرنة.','template',210),
 ('templates','قوالب Word','word-templates','قوالب Word رسمية وعملية.','template',220),
 ('templates','قوالب PowerPoint','powerpoint-templates','قوالب عروض تقديمية احترافية.','template',230),
 ('templates','قوالب Canva','canva-templates','قوالب Canva قابلة للتخصيص.','template',240),
 ('templates','قوالب العقود','contract-templates','قوالب عقود قابلة للتعديل.','template',250),
 ('templates','قوالب SOP','sop-templates','قوالب إجراءات تشغيل قياسية.','template',260),
 ('students','ملخصات','student-summaries','ملخصات ومواد دراسية منظمة.','student_resource',270),
 ('students','قوالب أبحاث','research-templates','قوالب أكاديمية للأبحاث.','student_resource',280),
 ('students','CV','student-cv','قوالب سيرة ذاتية للطلاب والخريجين.','student_resource',290),
 ('students','مشاريع تخرج','graduation-projects','نماذج وأدوات لمشاريع التخرج.','student_resource',300),
 ('students','جداول مذاكرة','study-schedules','جداول وخطط لتنظيم المذاكرة.','student_resource',310),
 ('systems','متجر إلكتروني','ecommerce-store-system','متجر إلكتروني جاهز للتخصيص.','ready_system',320),
 ('systems','موقع شركة','company-website-system','موقع شركة مؤسسي جاهز للتخصيص.','ready_system',330),
 ('systems','موقع شخصي','personal-website-system','موقع شخصي احترافي.','ready_system',340),
 ('systems','ERP','erp-system','نظام تخطيط موارد المؤسسة.','ready_system',350),
 ('systems','CRM','crm-ready-system','نظام إدارة علاقات العملاء.','ready_system',360),
 ('systems','POS','pos-system','نظام نقاط بيع.','ready_system',370),
 ('systems','LMS','lms-system','نظام إدارة تعلم.','ready_system',380),
 ('systems','نظام إدارة مطعم','restaurant-management-system','نظام لإدارة عمليات المطاعم.','ready_system',390),
 ('systems','نظام إدارة صيدلية','pharmacy-management-system','نظام لإدارة الصيدليات.','ready_system',400),
 ('systems','نظام إدارة مدرسة','school-management-system','نظام لإدارة المدارس.','ready_system',410),
 ('systems','نظام إدارة مستشفى','hospital-management-system','نظام لإدارة المنشآت الصحية.','ready_system',420),
 ('systems','نظام حجوزات','booking-system','نظام للحجوزات والمواعيد.','ready_system',430)
) as v(category_slug,name,slug,description,kind,sort_order)
join public.categories c on c.slug=v.category_slug
on conflict(slug) do nothing;

insert into public.services(name,slug,short_description,price_from,currency,category_id,subcategory_id,service_type,status,visibility,is_active,show_in_store,show_on_home,is_featured,requires_approval,is_free,sort_order)
select v.name,v.slug,v.description,0,'SAR',c.id,sc.id,'service','draft','hidden',false,false,false,false,true,false,v.sort_order
from (values
 ('programming-services','تطوير موقع','website-development','تطوير موقع احترافي حسب الاحتياج.',10),
 ('programming-services','تطوير متجر','store-development','تطوير متجر إلكتروني قابل للتوسع.',20),
 ('programming-services','تطوير نظام','system-development','تطوير نظام مخصص للأعمال.',30),
 ('programming-services','إصلاح أخطاء','bug-fixing','تحليل وإصلاح الأخطاء البرمجية.',40),
 ('programming-services','تحسين الأداء','performance-optimization','تحسين سرعة وكفاءة الأنظمة والمواقع.',50),
 ('ai-services','بناء وكيل AI','ai-agent-development','بناء وكيل ذكاء اصطناعي مخصص.',60),
 ('ai-services','دمج ChatGPT','chatgpt-integration','دمج ChatGPT داخل الأنظمة والعمليات.',70),
 ('ai-services','دمج Gemini','gemini-integration','دمج Gemini داخل الأنظمة والعمليات.',80),
 ('ai-services','أتمتة الأعمال','business-automation-service','أتمتة العمليات المتكررة وربط الأدوات.',90),
 ('design-services','شعار','logo-design','تصميم شعار احترافي.',100),
 ('design-services','هوية بصرية','visual-identity','تصميم هوية بصرية متكاملة.',110),
 ('design-services','UI','ui-design','تصميم واجهات مستخدم احترافية.',120),
 ('design-services','UX','ux-design','تصميم وتحسين تجربة المستخدم.',130),
 ('design-services','منشورات','social-post-design','تصميم منشورات رقمية.',140),
 ('design-services','إعلانات','advertising-design','تصميم مواد إعلانية.',150),
 ('marketing-services','إدارة الحسابات','social-account-management','إدارة حسابات التواصل الاجتماعي.',160),
 ('marketing-services','كتابة المحتوى','content-writing','كتابة محتوى تسويقي ومؤسسي.',170),
 ('marketing-services','SEO','seo-service','تحسين الظهور في محركات البحث.',180),
 ('marketing-services','حملات إعلانية','advertising-campaigns','تخطيط وإدارة الحملات الإعلانية.',190),
 ('ecommerce-services','إنشاء متجر','create-online-store','إنشاء متجر إلكتروني متكامل.',200),
 ('ecommerce-services','ربط الدفع','payment-integration','ربط وسائل الدفع بالمتجر أو النظام.',210),
 ('ecommerce-services','تحسين المتجر','store-optimization','تحسين تجربة وأداء المتجر.',220),
 ('consulting-services','استشارة أعمال','business-consulting','استشارة لتطوير وتشغيل الأعمال.',230),
 ('consulting-services','استشارة تقنية','technical-consulting','استشارة تقنية للأنظمة والمنتجات.',240),
 ('consulting-services','استشارة AI','ai-consulting','استشارة لاستخدام الذكاء الاصطناعي بفعالية.',250),
 ('consulting-services','استشارة تسويق','marketing-consulting','استشارة للتسويق والنمو.',260)
) as v(subcategory_slug,name,slug,description,sort_order)
join public.subcategories sc on sc.slug=v.subcategory_slug
join public.categories c on c.id=sc.category_id
on conflict(slug) do nothing;

insert into public.store_settings(setting_key,setting_value,description,is_public)
values
 ('general','{"store_name":"متجر مَدار | ORBIT","default_currency":"SAR","items_per_page":12,"search_debounce_ms":250}'::jsonb,'الإعدادات العامة لمحرك المتجر.',true),
 ('display','{"show_ratings":true,"show_sales_count":false,"show_categories":true,"show_filters":true}'::jsonb,'إعدادات العرض العامة.',true),
 ('checkout','{"mode":"manual_approval","allow_external_purchase_links":true}'::jsonb,'إعدادات الطلب والدفع.',false)
on conflict(setting_key) do nothing;

commit;
