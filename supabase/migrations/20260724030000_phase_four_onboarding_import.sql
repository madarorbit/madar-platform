-- Phase 4.2: business onboarding and reversible CSV imports.

create table public.business_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('products','customers','suppliers','expenses','sales')),
  status text not null default 'uploaded' check (status in ('uploaded','imported','rolled_back','failed')),
  file_name text not null check (char_length(file_name) between 1 and 255),
  headers jsonb not null check (jsonb_typeof(headers)='array' and jsonb_array_length(headers) between 1 and 100),
  rows jsonb not null check (jsonb_typeof(rows)='array' and jsonb_array_length(rows) between 1 and 500),
  mapping jsonb,
  imported_count integer not null default 0 check (imported_count>=0),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  committed_at timestamptz,
  rolled_back_at timestamptz
);
create index business_imports_org_created_idx on public.business_imports(organization_id,created_at desc);
create index business_imports_created_by_idx on public.business_imports(created_by);

alter table public.business_products add column source_import_id uuid references public.business_imports(id) on delete set null;
alter table public.business_customers add column source_import_id uuid references public.business_imports(id) on delete set null;
alter table public.business_suppliers add column source_import_id uuid references public.business_imports(id) on delete set null;
alter table public.business_expenses add column source_import_id uuid references public.business_imports(id) on delete set null;
alter table public.business_sales add column source_import_id uuid references public.business_imports(id) on delete set null;
create index business_products_source_import_idx on public.business_products(source_import_id);
create index business_customers_source_import_idx on public.business_customers(source_import_id);
create index business_suppliers_source_import_idx on public.business_suppliers(source_import_id);
create index business_expenses_source_import_idx on public.business_expenses(source_import_id);
create index business_sales_source_import_idx on public.business_sales(source_import_id);

create or replace function private.safe_numeric(value text, fallback numeric default 0)
returns numeric language plpgsql immutable set search_path='' as $$
begin
  if value is null or btrim(value)='' then return fallback; end if;
  return replace(replace(btrim(value),',',''),'٬','')::numeric;
exception when others then return fallback;
end $$;
revoke all on function private.safe_numeric(text,numeric) from public,anon,authenticated;

create or replace function private.safe_date(value text, fallback date default current_date)
returns date language plpgsql stable set search_path='' as $$
begin
  if value is null or btrim(value)='' then return fallback; end if;
  return btrim(value)::date;
exception when others then return fallback;
end $$;
revoke all on function private.safe_date(text,date) from public,anon,authenticated;

create or replace function private.safe_timestamptz(value text, fallback timestamptz default now())
returns timestamptz language plpgsql stable set search_path='' as $$
begin
  if value is null or btrim(value)='' then return fallback; end if;
  return btrim(value)::timestamptz;
exception when others then return fallback;
end $$;
revoke all on function private.safe_timestamptz(text,timestamptz) from public,anon,authenticated;

create or replace function private.import_capability(kind text)
returns text language sql immutable set search_path='' as $$
 select case kind
  when 'products' then 'products'
  when 'customers' then 'customers'
  when 'suppliers' then 'suppliers'
  when 'expenses' then 'expenses'
  when 'sales' then 'sales'
  else '' end
$$;
revoke all on function private.import_capability(text) from public,anon,authenticated;

create or replace function private.commit_business_import_impl(target_import uuid, column_mapping jsonb)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
 current_user_id uuid := (select auth.uid());
 import_record public.business_imports%rowtype;
 source_row jsonb;
 inserted_count integer := 0;
 item_id uuid;
 item_name text;
 item_sku text;
 item_cost numeric;
 item_price numeric;
 item_stock numeric;
 item_threshold numeric;
 item_amount numeric;
 item_discount numeric;
 item_total numeric;
 item_status text;
 item_payment text;
 item_date date;
 item_time timestamptz;
 generated_number text;
begin
 select * into import_record from public.business_imports where id=target_import for update;
 if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
 if import_record.status <> 'uploaded' then raise exception 'IMPORT_ALREADY_PROCESSED'; end if;
 if current_user_id is null or not private.can_manage_business(import_record.organization_id,private.import_capability(import_record.entity_type)) then
  raise exception 'NOT_AUTHORIZED';
 end if;
 if jsonb_typeof(column_mapping)<>'object' then raise exception 'INVALID_MAPPING'; end if;

 for source_row in select value from jsonb_array_elements(import_record.rows)
 loop
  if import_record.entity_type='products' then
   item_name=nullif(btrim(source_row->>(column_mapping->>'name')),'');
   if item_name is null then raise exception 'MISSING_PRODUCT_NAME_AT_ROW:%',inserted_count+2; end if;
   item_sku=nullif(btrim(source_row->>(column_mapping->>'sku')),'');
   item_cost=greatest(private.safe_numeric(source_row->>(column_mapping->>'cost'),0),0);
   item_price=greatest(private.safe_numeric(source_row->>(column_mapping->>'price'),0),0);
   item_stock=greatest(private.safe_numeric(source_row->>(column_mapping->>'stock_quantity'),0),0);
   item_threshold=greatest(private.safe_numeric(source_row->>(column_mapping->>'low_stock_threshold'),0),0);
   insert into public.business_products(organization_id,name,sku,description,category,cost,price,stock_quantity,low_stock_threshold,created_by,source_import_id)
   values(import_record.organization_id,item_name,item_sku,nullif(btrim(source_row->>(column_mapping->>'description')),''),nullif(btrim(source_row->>(column_mapping->>'category')),''),item_cost,item_price,item_stock,item_threshold,current_user_id,target_import)
   returning id into item_id;
   if item_stock>0 then
    insert into public.inventory_movements(organization_id,product_id,movement_type,quantity_delta,balance_after,reference_type,reference_id,note,created_by)
    values(import_record.organization_id,item_id,'opening',item_stock,item_stock,'import',target_import,'رصيد افتتاحي مستورد',current_user_id);
   end if;

  elsif import_record.entity_type='customers' then
   item_name=nullif(btrim(source_row->>(column_mapping->>'name')),'');
   if item_name is null then raise exception 'MISSING_CUSTOMER_NAME_AT_ROW:%',inserted_count+2; end if;
   item_status=lower(coalesce(nullif(btrim(source_row->>(column_mapping->>'status')),''),'active'));
   if item_status not in ('new','active','vip','inactive') then item_status='active'; end if;
   insert into public.business_customers(organization_id,name,phone,email,address,status,notes,created_by,source_import_id)
   values(import_record.organization_id,item_name,nullif(btrim(source_row->>(column_mapping->>'phone')),''),nullif(lower(btrim(source_row->>(column_mapping->>'email'))),''),nullif(btrim(source_row->>(column_mapping->>'address')),''),item_status,nullif(btrim(source_row->>(column_mapping->>'notes')),''),current_user_id,target_import);

  elsif import_record.entity_type='suppliers' then
   item_name=nullif(btrim(source_row->>(column_mapping->>'name')),'');
   if item_name is null then raise exception 'MISSING_SUPPLIER_NAME_AT_ROW:%',inserted_count+2; end if;
   item_amount=greatest(private.safe_numeric(source_row->>(column_mapping->>'balance_due'),0),0);
   insert into public.business_suppliers(organization_id,name,contact_name,phone,email,address,notes,balance_due,created_by,source_import_id)
   values(import_record.organization_id,item_name,nullif(btrim(source_row->>(column_mapping->>'contact_name')),''),nullif(btrim(source_row->>(column_mapping->>'phone')),''),nullif(lower(btrim(source_row->>(column_mapping->>'email'))),''),nullif(btrim(source_row->>(column_mapping->>'address')),''),nullif(btrim(source_row->>(column_mapping->>'notes')),''),item_amount,current_user_id,target_import);

  elsif import_record.entity_type='expenses' then
   item_name=nullif(btrim(source_row->>(column_mapping->>'title')),'');
   if item_name is null then raise exception 'MISSING_EXPENSE_TITLE_AT_ROW:%',inserted_count+2; end if;
   item_amount=private.safe_numeric(source_row->>(column_mapping->>'amount'),0);
   if item_amount<=0 then raise exception 'INVALID_EXPENSE_AMOUNT_AT_ROW:%',inserted_count+2; end if;
   item_payment=lower(coalesce(nullif(btrim(source_row->>(column_mapping->>'payment_status')),''),'paid'));
   if item_payment not in ('unpaid','partial','paid') then item_payment='paid'; end if;
   item_date=private.safe_date(source_row->>(column_mapping->>'incurred_at'),current_date);
   insert into public.business_expenses(organization_id,title,category,amount,currency,incurred_at,payment_status,notes,created_by,source_import_id)
   select import_record.organization_id,item_name,coalesce(nullif(btrim(source_row->>(column_mapping->>'category')),''),'other'),item_amount,o.currency,item_date,item_payment,nullif(btrim(source_row->>(column_mapping->>'notes')),''),current_user_id,target_import
   from public.organizations o where o.id=import_record.organization_id;

  elsif import_record.entity_type='sales' then
   item_total=greatest(private.safe_numeric(source_row->>(column_mapping->>'total'),0),0);
   if item_total<=0 then raise exception 'INVALID_SALE_TOTAL_AT_ROW:%',inserted_count+2; end if;
   item_discount=greatest(private.safe_numeric(source_row->>(column_mapping->>'discount_total'),0),0);
   item_payment=lower(coalesce(nullif(btrim(source_row->>(column_mapping->>'payment_status')),''),'paid'));
   if item_payment not in ('unpaid','partial','paid','refunded') then item_payment='paid'; end if;
   item_status=lower(coalesce(nullif(btrim(source_row->>(column_mapping->>'status')),''),'completed'));
   if item_status not in ('draft','completed','cancelled','refunded') then item_status='completed'; end if;
   item_time=private.safe_timestamptz(source_row->>(column_mapping->>'sold_at'),now());
   generated_number=coalesce(nullif(btrim(source_row->>(column_mapping->>'sale_number')),''),'IMP-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));
   insert into public.business_sales(organization_id,sale_number,status,payment_status,subtotal,discount_total,total,currency,notes,sold_at,created_by,source_import_id)
   select import_record.organization_id,generated_number,item_status,item_payment,item_total+item_discount,item_discount,item_total,o.currency,nullif(btrim(source_row->>(column_mapping->>'notes')),''),item_time,current_user_id,target_import
   from public.organizations o where o.id=import_record.organization_id;
  end if;
  inserted_count=inserted_count+1;
 end loop;

 update public.business_imports
 set status='imported',mapping=column_mapping,imported_count=inserted_count,
     summary=jsonb_build_object('entity_type',entity_type,'imported',inserted_count),
     committed_at=now(),error_message=null
 where id=target_import;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(current_user_id,'business.import.committed','business_import',target_import,jsonb_build_object('organization_id',import_record.organization_id,'entity_type',import_record.entity_type,'count',inserted_count));
 return inserted_count;
exception when others then
 if import_record.id is not null then
  update public.business_imports set status='failed',error_message=sqlerrm where id=target_import;
 end if;
 raise;
end $$;
revoke all on function private.commit_business_import_impl(uuid,jsonb) from public,anon,authenticated;

create or replace function public.commit_business_import(target_import uuid,column_mapping jsonb)
returns integer language sql security invoker set search_path='' as $$
 select private.commit_business_import_impl(target_import,column_mapping)
$$;
revoke all on function public.commit_business_import(uuid,jsonb) from public,anon;
grant execute on function public.commit_business_import(uuid,jsonb) to authenticated;

create or replace function private.rollback_business_import_impl(target_import uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
 current_user_id uuid := (select auth.uid());
 import_record public.business_imports%rowtype;
 affected integer := 0;
begin
 select * into import_record from public.business_imports where id=target_import for update;
 if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
 if import_record.status <> 'imported' then raise exception 'IMPORT_NOT_ROLLBACKABLE'; end if;
 if current_user_id is null or not private.can_manage_business(import_record.organization_id,private.import_capability(import_record.entity_type)) then raise exception 'NOT_AUTHORIZED'; end if;

 if import_record.entity_type='products' then
  if exists(select 1 from public.business_sale_items i join public.business_products p on p.id=i.product_id where p.source_import_id=target_import) then raise exception 'IMPORTED_PRODUCTS_ALREADY_USED'; end if;
  delete from public.business_products where source_import_id=target_import and organization_id=import_record.organization_id;
 elsif import_record.entity_type='customers' then
  if exists(select 1 from public.business_sales s join public.business_customers c on c.id=s.customer_id where c.source_import_id=target_import) then raise exception 'IMPORTED_CUSTOMERS_ALREADY_USED'; end if;
  delete from public.business_customers where source_import_id=target_import and organization_id=import_record.organization_id;
 elsif import_record.entity_type='suppliers' then
  if exists(select 1 from public.business_expenses e join public.business_suppliers s on s.id=e.supplier_id where s.source_import_id=target_import) then raise exception 'IMPORTED_SUPPLIERS_ALREADY_USED'; end if;
  delete from public.business_suppliers where source_import_id=target_import and organization_id=import_record.organization_id;
 elsif import_record.entity_type='expenses' then
  delete from public.business_expenses where source_import_id=target_import and organization_id=import_record.organization_id;
 elsif import_record.entity_type='sales' then
  if exists(select 1 from public.business_sale_items where sale_id in(select id from public.business_sales where source_import_id=target_import)) then raise exception 'IMPORTED_SALES_HAVE_ITEMS'; end if;
  delete from public.business_sales where source_import_id=target_import and organization_id=import_record.organization_id;
 end if;
 get diagnostics affected=row_count;
 update public.business_imports set status='rolled_back',rolled_back_at=now(),summary=summary||jsonb_build_object('rolled_back',affected) where id=target_import;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(current_user_id,'business.import.rolled_back','business_import',target_import,jsonb_build_object('organization_id',import_record.organization_id,'count',affected));
 return affected;
end $$;
revoke all on function private.rollback_business_import_impl(uuid) from public,anon,authenticated;

create or replace function public.rollback_business_import(target_import uuid)
returns integer language sql security invoker set search_path='' as $$
 select private.rollback_business_import_impl(target_import)
$$;
revoke all on function public.rollback_business_import(uuid) from public,anon;
grant execute on function public.rollback_business_import(uuid) to authenticated;

alter table public.business_imports enable row level security;
create policy "members read business imports" on public.business_imports for select to authenticated
using (private.is_admin() or private.is_organization_member(organization_id));
create policy "authorized members upload business imports" on public.business_imports for insert to authenticated
with check(created_by=(select auth.uid()) and private.can_manage_business(organization_id,private.import_capability(entity_type)));
create trigger business_imports_updated before update on public.business_imports for each row execute function public.touch_updated_at();

revoke all on table public.business_imports from anon,authenticated;
grant select,insert on table public.business_imports to authenticated;
