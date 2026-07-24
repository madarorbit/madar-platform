create or replace function private.submit_subscription_renewal_impl(target_organization uuid,target_method uuid,reference text,proof_path text,proof_name text,proof_mime text,proof_size bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare subscription public.workspace_subscriptions;plan public.subscription_plans;method public.payment_methods%rowtype;request_id uuid;
begin
 if not private.has_organization_role(target_organization,array['OWNER','ADMIN']::public.organization_role[]) then raise exception 'NOT_AUTHORIZED';end if;
 select * into subscription from public.workspace_subscriptions where organization_id=target_organization order by created_at desc limit 1 for update;
 if subscription.id is null then raise exception 'SUBSCRIPTION_NOT_FOUND';end if;
 select * into plan from public.subscription_plans where id=subscription.plan_id and is_active;
 select * into method from public.payment_methods where id=target_method and is_active;
 if method.id is null then raise exception 'PAYMENT_METHOD_UNAVAILABLE';end if;
 if exists(select 1 from public.subscription_renewal_requests where organization_id=target_organization and status='under_review') then raise exception 'RENEWAL_ALREADY_PENDING';end if;
 if char_length(trim(reference)) not between 3 and 120 or proof_mime not in ('image/jpeg','image/png','image/webp','application/pdf') or proof_size not between 1 and 10485760 then raise exception 'INVALID_PAYMENT_PROOF';end if;
 insert into public.subscription_renewal_requests(organization_id,subscription_id,user_id,payment_method_id,amount,currency,payment_reference,storage_path,original_filename,mime_type,file_size)
 values(target_organization,subscription.id,(select auth.uid()),method.id,plan.price,plan.currency,trim(reference),proof_path,proof_name,proof_mime,proof_size) returning id into request_id;
 return request_id;
end $$;
revoke all on function private.submit_subscription_renewal_impl(uuid,uuid,text,text,text,text,bigint) from public,anon,authenticated;
create or replace function public.submit_subscription_renewal(target_organization uuid,target_method uuid,reference text,proof_path text,proof_name text,proof_mime text,proof_size bigint)
returns uuid language sql security invoker set search_path='' as $$select private.submit_subscription_renewal_impl(target_organization,target_method,reference,proof_path,proof_name,proof_mime,proof_size)$$;
revoke all on function public.submit_subscription_renewal(uuid,uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.submit_subscription_renewal(uuid,uuid,text,text,text,text,bigint) to authenticated;
grant execute on function private.submit_subscription_renewal_impl(uuid,uuid,text,text,text,text,bigint) to authenticated;

create or replace function private.review_subscription_renewal_impl(target_renewal uuid,decision text,note text default null)
returns public.subscription_renewal_requests language plpgsql security definer set search_path='' as $$
declare renewal public.subscription_renewal_requests;subscription public.workspace_subscriptions;plan public.subscription_plans;new_end timestamptz;
begin
 if not private.is_admin() then raise exception 'Admin required';end if;
 select * into renewal from public.subscription_renewal_requests where id=target_renewal for update;
 if renewal.id is null or renewal.status<>'under_review' then raise exception 'RENEWAL_NOT_REVIEWABLE';end if;
 if decision='approve' then
  select * into subscription from public.workspace_subscriptions where id=renewal.subscription_id for update;
  select * into plan from public.subscription_plans where id=subscription.plan_id;
  new_end:=greatest(subscription.ends_at,now())+(plan.billing_months||' months')::interval;
  update public.workspace_subscriptions set status='active',ends_at=new_end,grace_ends_at=new_end+(plan.grace_days||' days')::interval,renewal_count=renewal_count+1,last_payment_at=now(),updated_at=now() where id=subscription.id;
  update public.subscription_renewal_requests set status='approved',reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(trim(note),'') where id=renewal.id returning * into renewal;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'subscription.renewal.approved','workspace_subscription',subscription.id,jsonb_build_object('renewal_id',renewal.id,'organization_id',renewal.organization_id,'new_end',new_end));
 elsif decision='reject' then
  update public.subscription_renewal_requests set status='rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),review_note=nullif(trim(note),'') where id=renewal.id returning * into renewal;
 else raise exception 'INVALID_DECISION';end if;
 return renewal;
end $$;
revoke all on function private.review_subscription_renewal_impl(uuid,text,text) from public,anon,authenticated;
create or replace function public.review_subscription_renewal(target_renewal uuid,decision text,note text default null)
returns public.subscription_renewal_requests language sql security invoker set search_path='' as $$select private.review_subscription_renewal_impl(target_renewal,decision,note)$$;
revoke all on function public.review_subscription_renewal(uuid,text,text) from public,anon;
grant execute on function public.review_subscription_renewal(uuid,text,text) to authenticated;
grant execute on function private.review_subscription_renewal_impl(uuid,text,text) to authenticated;

create or replace function private.refresh_workspace_subscription_impl(target_organization uuid)
returns text language plpgsql security definer set search_path='' as $$
declare subscription public.workspace_subscriptions;new_status text;
begin
 if not private.is_organization_member(target_organization) and not private.is_admin() then raise exception 'NOT_AUTHORIZED';end if;
 select * into subscription from public.workspace_subscriptions where organization_id=target_organization order by created_at desc limit 1 for update;
 if subscription.id is null then return 'missing';end if;
 new_status:=case when now()<=subscription.ends_at then 'active' when now()<=coalesce(subscription.grace_ends_at,subscription.ends_at) then 'past_due' else 'expired' end;
 if subscription.status<>new_status then update public.workspace_subscriptions set status=new_status,updated_at=now() where id=subscription.id;end if;
 return new_status;
end $$;
revoke all on function private.refresh_workspace_subscription_impl(uuid) from public,anon,authenticated;
create or replace function public.refresh_workspace_subscription(target_organization uuid)
returns text language sql security invoker set search_path='' as $$select private.refresh_workspace_subscription_impl(target_organization)$$;
revoke all on function public.refresh_workspace_subscription(uuid) from public,anon;
grant execute on function public.refresh_workspace_subscription(uuid) to authenticated;
grant execute on function private.refresh_workspace_subscription_impl(uuid) to authenticated;

create or replace function private.enforce_workspace_product_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare allowed integer;current_count integer;
begin
 select p.product_limit into allowed from public.workspace_subscriptions s join public.subscription_plans p on p.id=s.plan_id where s.organization_id=new.organization_id and s.status in ('active','past_due') order by s.created_at desc limit 1;
 if allowed is null then raise exception 'SUBSCRIPTION_REQUIRED';end if;
 select count(*) into current_count from public.business_products where organization_id=new.organization_id;
 if current_count>=allowed then raise exception 'PRODUCT_LIMIT_REACHED';end if;
 return new;
end $$;
revoke all on function private.enforce_workspace_product_limit() from public,anon,authenticated;
create trigger enforce_business_product_limit before insert on public.business_products for each row execute function private.enforce_workspace_product_limit();

create or replace function private.enforce_workspace_member_limit()
returns trigger language plpgsql security definer set search_path='' as $$
declare org_type public.organization_type;allowed integer;current_count integer;
begin
 select type into org_type from public.organizations where id=new.organization_id;
 if org_type='STUDENT' then return new;end if;
 select p.member_limit into allowed from public.workspace_subscriptions s join public.subscription_plans p on p.id=s.plan_id where s.organization_id=new.organization_id and s.status in ('active','past_due') order by s.created_at desc limit 1;
 if allowed is null then
  if new.role='OWNER' and not exists(select 1 from public.organization_members where organization_id=new.organization_id) then return new;end if;
  raise exception 'SUBSCRIPTION_REQUIRED';
 end if;
 select count(*) into current_count from public.organization_members where organization_id=new.organization_id;
 if current_count>=allowed then raise exception 'MEMBER_LIMIT_REACHED';end if;
 return new;
end $$;
revoke all on function private.enforce_workspace_member_limit() from public,anon,authenticated;
create trigger enforce_organization_member_limit before insert on public.organization_members for each row execute function private.enforce_workspace_member_limit();

create or replace function private.consume_orby_quota_impl(target_organization uuid,submitted_characters integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=(select auth.uid());usage_row public.orby_usage_daily%rowtype;daily_limit integer:=20;
begin
 if current_user_id is null or not private.is_organization_member(target_organization) then raise exception 'NOT_AUTHORIZED';end if;
 if submitted_characters<1 or submitted_characters>12000 then raise exception 'INVALID_PROMPT_SIZE';end if;
 select p.orby_daily_limit into daily_limit from public.workspace_subscriptions s join public.subscription_plans p on p.id=s.plan_id where s.organization_id=target_organization and s.status in ('active','past_due') order by s.created_at desc limit 1;
 if daily_limit is null then raise exception 'SUBSCRIPTION_REQUIRED';end if;
 insert into public.orby_usage_daily(organization_id,user_id,usage_date,requests,input_characters) values(target_organization,current_user_id,current_date,1,submitted_characters)
 on conflict(organization_id,user_id,usage_date) do update set requests=public.orby_usage_daily.requests+1,input_characters=public.orby_usage_daily.input_characters+excluded.input_characters,updated_at=now()
 where public.orby_usage_daily.requests<daily_limit and public.orby_usage_daily.input_characters+excluded.input_characters<=greatest(100000,daily_limit*5000)
 returning * into usage_row;
 if usage_row.user_id is null then raise exception 'ORBY_DAILY_LIMIT';end if;
 return jsonb_build_object('requests',usage_row.requests,'limit',daily_limit,'remaining',greatest(daily_limit-usage_row.requests,0),'input_characters',usage_row.input_characters);
end $$;

alter table public.payment_methods enable row level security;
alter table public.beta_founder_slots enable row level security;
alter table public.workspace_payment_submissions enable row level security;
alter table public.subscription_renewal_requests enable row level security;
create policy "authenticated read active payment methods" on public.payment_methods for select to authenticated using(is_active or private.is_admin());
create policy "admins insert payment methods" on public.payment_methods for insert to authenticated with check(private.is_admin());
create policy "admins update payment methods" on public.payment_methods for update to authenticated using(private.is_admin()) with check(private.is_admin());
create policy "admins delete payment methods" on public.payment_methods for delete to authenticated using(private.is_admin());
create policy "admins read beta slots" on public.beta_founder_slots for select to authenticated using(private.is_admin());
create policy "users read own workspace payments" on public.workspace_payment_submissions for select to authenticated using(user_id=(select auth.uid()) or private.is_admin());
create policy "members read renewal requests" on public.subscription_renewal_requests for select to authenticated using(user_id=(select auth.uid()) or private.is_admin() or private.is_organization_member(organization_id));
revoke all on table public.payment_methods,public.beta_founder_slots,public.workspace_payment_submissions,public.subscription_renewal_requests from anon,authenticated;
grant select,insert,update,delete on public.payment_methods to authenticated;
grant select on public.beta_founder_slots,public.workspace_payment_submissions,public.subscription_renewal_requests to authenticated;

with existing as (
 select o.id organization_id,m.user_id,o.type,row_number() over(order by o.created_at,o.id) ordinal
 from public.organizations o join public.organization_members m on m.organization_id=o.id and m.role='OWNER'
 where o.type<>'STUDENT' and not exists(select 1 from public.workspace_subscriptions s where s.organization_id=o.id)
),assigned as (
 update public.beta_founder_slots b set status='activated',user_id=e.user_id,organization_id=e.organization_id,activated_at=now()
 from existing e where e.ordinal=b.ordinal and e.ordinal<=10 and b.status='available'
 returning b.ordinal,b.organization_id
)
insert into public.workspace_subscriptions(organization_id,plan_id,ends_at,grace_ends_at,is_beta_founder)
select a.organization_id,p.id,now()+interval '90 days',now()+interval '97 days',true
from assigned a join public.organizations o on o.id=a.organization_id join public.subscription_plans p on p.organization_type=o.type and p.is_active
on conflict do nothing;
