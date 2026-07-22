-- Madar Platform phase 3: transactional commerce operations.
create type public.order_status as enum ('awaiting_payment','payment_review','paid','processing','completed','cancelled','rejected');
create type public.payment_status as enum ('unpaid','under_review','approved','rejected','refunded');
create type public.order_item_type as enum ('product','service');

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,30}$'),
  description text,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
  maximum_discount numeric(12,2) check (maximum_discount is null or maximum_discount > 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  status public.order_status not null default 'awaiting_payment',
  payment_status public.payment_status not null default 'unpaid',
  currency text not null default 'SAR' check (currency = 'SAR'),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  total numeric(12,2) not null check (total >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  customer_phone text check (customer_phone is null or char_length(customer_phone) between 7 and 30),
  customer_notes text check (customer_notes is null or char_length(customer_notes) <= 2000),
  payment_reference text check (payment_reference is null or char_length(payment_reference) between 3 and 120),
  payment_submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  paid_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_total <= subtotal),
  check (total = subtotal - discount_total)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type public.order_item_type not null,
  product_id uuid references public.products(id) on delete restrict,
  service_id uuid references public.services(id) on delete restrict,
  title text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity between 1 and 20),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored,
  service_requirements text check (service_requirements is null or char_length(service_requirements) <= 4000),
  created_at timestamptz not null default now(),
  check ((item_type = 'product' and product_id is not null and service_id is null) or (item_type = 'service' and service_id is not null and product_id is null))
);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  discount_amount numeric(12,2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  body text not null check (char_length(body) between 2 and 1000),
  link text check (link is null or link ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.digital_downloads (
  id bigint generated always as identity primary key,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  downloaded_at timestamptz not null default now()
);

create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_created_idx on public.orders(status, created_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index notifications_user_unread_idx on public.notifications(user_id, created_at desc) where read_at is null;
create index coupon_redemptions_coupon_user_idx on public.coupon_redemptions(coupon_id,user_id);
create index digital_downloads_item_user_idx on public.digital_downloads(order_item_id,user_id,downloaded_at desc);

create trigger coupons_updated before update on public.coupons for each row execute function public.touch_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.touch_updated_at();

alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.order_status_history enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.notifications enable row level security;
alter table public.digital_downloads enable row level security;

create policy "customers read own orders" on public.orders for select to authenticated using ((select auth.uid()) = user_id or public.is_admin());
create policy "admins update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customers read own items" on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_admin())));
create policy "customers read own proofs" on public.payment_proofs for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());
create policy "customers insert own proofs" on public.payment_proofs for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid()) and o.payment_status in ('unpaid','rejected')));
create policy "customers read own history" on public.order_status_history for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=(select auth.uid()) or public.is_admin())));
create policy "admins read coupons" on public.coupons for select to authenticated using (public.is_admin());
create policy "admins manage coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "customers read own redemptions" on public.coupon_redemptions for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());
create policy "users read notifications" on public.notifications for select to authenticated using (user_id=(select auth.uid()));
create policy "users update notifications" on public.notifications for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "admins read notifications" on public.notifications for select to authenticated using (public.is_admin());
create policy "users read own downloads" on public.digital_downloads for select to authenticated using (user_id=(select auth.uid()) or public.is_admin());
create policy "users log owned downloads" on public.digital_downloads for insert to authenticated with check (user_id=(select auth.uid()) and exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where oi.id=order_item_id and o.user_id=(select auth.uid()) and o.payment_status='approved'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-proofs','payment-proofs',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "payment proof owner insert" on storage.objects for insert to authenticated with check (bucket_id='payment-proofs' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "payment proof owner read" on storage.objects for select to authenticated using (bucket_id='payment-proofs' and ((storage.foldername(name))[1]=(select auth.uid())::text or public.is_admin()));
create policy "paid customers download products" on storage.objects for select to authenticated using (
 bucket_id='digital-products' and (public.is_admin() or exists(
   select 1 from public.product_files pf join public.order_items oi on oi.product_id=pf.product_id join public.orders o on o.id=oi.order_id
   where pf.storage_path=name and pf.is_active and o.user_id=(select auth.uid()) and o.payment_status='approved'
 ))
);
create policy "paid customers read purchased files" on public.product_files for select to authenticated using (is_active and exists(select 1 from public.order_items oi join public.orders o on o.id=oi.order_id where oi.product_id=product_id and o.user_id=(select auth.uid()) and o.payment_status='approved'));

create or replace function public.create_customer_order(p_items jsonb,p_coupon_code text default null,p_customer_phone text default null,p_customer_notes text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=(select auth.uid()); v_profile public.profiles%rowtype; v_order uuid:=gen_random_uuid(); v_item jsonb; v_product public.products%rowtype; v_service public.services%rowtype; v_subtotal numeric(12,2):=0; v_discount numeric(12,2):=0; v_coupon public.coupons%rowtype; v_count int:=0; v_qty int;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into v_profile from public.profiles where id=v_user and status='active'; if not found or v_profile.email is null then raise exception 'PROFILE_REQUIRED'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>20 then raise exception 'INVALID_ITEMS'; end if;
 insert into public.orders(id,order_number,user_id,subtotal,total,customer_name,customer_email,customer_phone,customer_notes)
 values(v_order,'MDR-'||upper(substr(replace(v_order::text,'-',''),1,10)),v_user,0,0,coalesce(nullif(trim(v_profile.full_name),''),'عميل مدار'),v_profile.email,nullif(trim(p_customer_phone),''),nullif(trim(p_customer_notes),''));
 for v_item in select * from jsonb_array_elements(p_items) loop
   v_qty:=coalesce((v_item->>'quantity')::int,1); if v_qty<1 or v_qty>20 then raise exception 'INVALID_QUANTITY'; end if;
   if v_item->>'type'='product' then
     select * into v_product from public.products where id=(v_item->>'id')::uuid and status='published' for share; if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
     insert into public.order_items(order_id,item_type,product_id,title,unit_price,quantity) values(v_order,'product',v_product.id,v_product.name,v_product.price,v_qty);
     v_subtotal:=v_subtotal+(v_product.price*v_qty);
   elsif v_item->>'type'='service' then
     select * into v_service from public.services where id=(v_item->>'id')::uuid and status='published' for share; if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
     insert into public.order_items(order_id,item_type,service_id,title,unit_price,quantity,service_requirements) values(v_order,'service',v_service.id,v_service.name,v_service.price_from,v_qty,nullif(trim(v_item->>'requirements'),''));
     v_subtotal:=v_subtotal+(v_service.price_from*v_qty);
   else raise exception 'INVALID_ITEM_TYPE'; end if;
   v_count:=v_count+1;
 end loop;
 if p_coupon_code is not null and trim(p_coupon_code)<>'' then
   select * into v_coupon from public.coupons where code=upper(trim(p_coupon_code)) and is_active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()) for update;
   if not found then raise exception 'INVALID_COUPON'; end if;
   if v_subtotal<v_coupon.minimum_order then raise exception 'COUPON_MINIMUM'; end if;
   if v_coupon.usage_limit is not null and (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id)>=v_coupon.usage_limit then raise exception 'COUPON_EXHAUSTED'; end if;
   if (select count(*) from public.coupon_redemptions where coupon_id=v_coupon.id and user_id=v_user)>=v_coupon.per_user_limit then raise exception 'COUPON_USER_LIMIT'; end if;
   v_discount:=case when v_coupon.discount_type='percent' then round(v_subtotal*v_coupon.discount_value/100,2) else least(v_coupon.discount_value,v_subtotal) end;
   if v_coupon.maximum_discount is not null then v_discount:=least(v_discount,v_coupon.maximum_discount); end if;
   insert into public.coupon_redemptions(coupon_id,order_id,user_id,discount_amount) values(v_coupon.id,v_order,v_user,v_discount);
 end if;
 update public.orders set subtotal=v_subtotal,discount_total=v_discount,total=v_subtotal-v_discount,coupon_id=v_coupon.id where id=v_order;
 insert into public.order_status_history(order_id,to_status,actor_id,note) values(v_order,'awaiting_payment',v_user,'تم إنشاء الطلب');
 insert into public.notifications(user_id,title,body,link) values(v_user,'تم إنشاء طلبك','تم إنشاء الطلب وهو بانتظار إثبات التحويل.','/account/orders/'||v_order);
 return v_order;
end $$;

create or replace function public.submit_order_payment(p_order_id uuid,p_payment_reference text)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=(select auth.uid()); v_old public.order_status;
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 select status into v_old from public.orders where id=p_order_id and user_id=v_user and payment_status in ('unpaid','rejected') for update; if not found then raise exception 'ORDER_NOT_PAYABLE'; end if;
 if not exists(select 1 from public.payment_proofs where order_id=p_order_id and user_id=v_user) then raise exception 'PROOF_REQUIRED'; end if;
 update public.orders set status='payment_review',payment_status='under_review',payment_reference=nullif(trim(p_payment_reference),''),payment_submitted_at=now(),admin_note=null where id=p_order_id;
 insert into public.order_status_history(order_id,from_status,to_status,actor_id,note) values(p_order_id,v_old,'payment_review',v_user,'تم إرسال إثبات الدفع للمراجعة');
end $$;

create or replace function public.review_order_payment(p_order_id uuid,p_approved boolean,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=(select auth.uid()); v_user uuid; v_old public.order_status; v_next public.order_status;
begin
 if v_actor is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 select user_id,status into v_user,v_old from public.orders where id=p_order_id and payment_status='under_review' for update; if not found then raise exception 'ORDER_NOT_REVIEWABLE'; end if;
 v_next:=case when p_approved then 'paid'::public.order_status else 'rejected'::public.order_status end;
 update public.orders set status=v_next,payment_status=case when p_approved then 'approved'::public.payment_status else 'rejected'::public.payment_status end,reviewed_by=v_actor,reviewed_at=now(),admin_note=nullif(trim(p_note),''),paid_at=case when p_approved then now() else paid_at end where id=p_order_id;
 insert into public.order_status_history(order_id,from_status,to_status,actor_id,note) values(p_order_id,v_old,v_next,v_actor,nullif(trim(p_note),''));
 insert into public.notifications(user_id,title,body,link) values(v_user,case when p_approved then 'تم اعتماد دفعتك' else 'تعذر اعتماد دفعتك' end,case when p_approved then 'أصبح طلبك مدفوعًا وسيبدأ تنفيذه.' else 'راجع ملاحظة الإدارة وأعد إرسال إثبات الدفع.' end,'/account/orders/'||p_order_id);
end $$;

create or replace function public.update_order_fulfillment(p_order_id uuid,p_status public.order_status,p_note text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=(select auth.uid()); v_user uuid; v_old public.order_status;
begin
 if v_actor is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 if p_status not in ('processing','completed','cancelled') then raise exception 'INVALID_STATUS'; end if;
 select user_id,status into v_user,v_old from public.orders where id=p_order_id for update; if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 if p_status in ('processing','completed') and not exists(select 1 from public.orders where id=p_order_id and payment_status='approved') then raise exception 'PAYMENT_NOT_APPROVED'; end if;
 update public.orders set status=p_status,completed_at=case when p_status='completed' then now() else completed_at end,admin_note=coalesce(nullif(trim(p_note),''),admin_note) where id=p_order_id;
 insert into public.order_status_history(order_id,from_status,to_status,actor_id,note) values(p_order_id,v_old,p_status,v_actor,nullif(trim(p_note),''));
 insert into public.notifications(user_id,title,body,link) values(v_user,'تحديث على طلبك','تم تحديث حالة الطلب إلى '||p_status::text||'.','/account/orders/'||p_order_id);
end $$;

revoke all on function public.create_customer_order(jsonb,text,text,text) from public,anon;
revoke all on function public.submit_order_payment(uuid,text) from public,anon;
revoke all on function public.review_order_payment(uuid,boolean,text) from public,anon;
revoke all on function public.update_order_fulfillment(uuid,public.order_status,text) from public,anon;
grant execute on function public.create_customer_order(jsonb,text,text,text) to authenticated;
grant execute on function public.submit_order_payment(uuid,text) to authenticated;
grant execute on function public.review_order_payment(uuid,boolean,text) to authenticated;
grant execute on function public.update_order_fulfillment(uuid,public.order_status,text) to authenticated;
grant select,insert,update on public.orders,public.order_items,public.payment_proofs,public.order_status_history,public.coupon_redemptions,public.notifications,public.digital_downloads to authenticated;
grant select,insert,update,delete on public.coupons to authenticated;
grant usage,select on sequence public.order_status_history_id_seq,public.digital_downloads_id_seq to authenticated;

-- Workspace commercial plans and lifecycle (student workspaces remain free).
create table public.subscription_plans (
 id uuid primary key default gen_random_uuid(),code text not null unique,name text not null,organization_type public.organization_type not null,
 price numeric(12,2) not null check(price>=0),currency text not null default 'SAR' check(currency='SAR'),billing_months integer not null default 1 check(billing_months>0),is_active boolean not null default true,created_at timestamptz not null default now()
);
insert into public.subscription_plans(code,name,organization_type,price) values
 ('INDIVIDUAL-MONTHLY','خطة الفرد','INDIVIDUAL',99),('MERCHANT-MONTHLY','خطة المتجر والتجارة','MERCHANT',199),('COMPANY-MONTHLY','خطة الشركة والمؤسسة','COMPANY',399);
alter table public.workspace_requests add column plan_id uuid references public.subscription_plans(id) on delete restrict;
create table public.workspace_subscriptions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,plan_id uuid not null references public.subscription_plans(id) on delete restrict,
 status text not null default 'active' check(status in ('active','past_due','cancelled','expired')),starts_at timestamptz not null default now(),ends_at timestamptz not null,approved_request_id uuid unique references public.workspace_requests(id) on delete set null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(ends_at>starts_at)
);
create unique index workspace_one_active_subscription_idx on public.workspace_subscriptions(organization_id) where status='active';
create trigger workspace_subscriptions_updated before update on public.workspace_subscriptions for each row execute function public.touch_updated_at();
alter table public.subscription_plans enable row level security;alter table public.workspace_subscriptions enable row level security;
create policy "public reads active plans" on public.subscription_plans for select using(is_active or public.is_admin());
create policy "admins manage plans" on public.subscription_plans for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "members read subscriptions" on public.workspace_subscriptions for select to authenticated using(public.is_admin() or exists(select 1 from public.organization_members m where m.organization_id=organization_id and m.user_id=(select auth.uid())));
create policy "admins manage subscriptions" on public.workspace_subscriptions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create or replace function public.assign_workspace_plan() returns trigger language plpgsql security definer set search_path=public as $$ begin if new.plan_id is null then select id into new.plan_id from public.subscription_plans where organization_type=new.type and is_active order by price limit 1; end if;if new.plan_id is null then raise exception 'PLAN_NOT_AVAILABLE';end if;return new;end $$;
create trigger workspace_request_assign_plan before insert on public.workspace_requests for each row execute function public.assign_workspace_plan();
create or replace function public.activate_workspace_subscription() returns trigger language plpgsql security definer set search_path=public as $$ declare v_plan public.subscription_plans%rowtype;begin if new.status='approved' and old.status is distinct from new.status and new.organization_id is not null then select * into v_plan from public.subscription_plans where id=new.plan_id;insert into public.workspace_subscriptions(organization_id,plan_id,ends_at,approved_request_id) values(new.organization_id,new.plan_id,now()+(v_plan.billing_months||' months')::interval,new.id) on conflict(approved_request_id) do nothing;end if;return new;end $$;
create trigger workspace_request_activate_subscription after update on public.workspace_requests for each row execute function public.activate_workspace_subscription();
revoke all on function public.assign_workspace_plan() from public,anon,authenticated;revoke all on function public.activate_workspace_subscription() from public,anon,authenticated;
grant select on public.subscription_plans,public.workspace_subscriptions to anon,authenticated;grant insert,update,delete on public.subscription_plans,public.workspace_subscriptions to authenticated;
