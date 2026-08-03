-- Force existing customers through the MADAR V2 account, activity and plan
-- selection flow without deleting or replacing their operational data.

alter table public.profiles
  add column if not exists reonboarding_required boolean not null default false;

create index if not exists profiles_reonboarding_required_idx
  on public.profiles(reonboarding_required)
  where reonboarding_required;

create or replace function public.complete_existing_customer_onboarding(
  selected_account_type text,
  selected_specialization_code text default null,
  selected_operating_mode text default null,
  selected_plan_level text default null,
  selected_term_months integer default null,
  selected_currency text default null,
  selected_business_name text default null
) returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  actor_profile public.profiles;
  commercial_org public.organizations;
  student_org public.organizations;
  specialization public.activity_specializations;
  variant public.pricing_variants;
  price_book public.pricing_price_books;
  variant_price public.pricing_variant_prices;
  entitlements jsonb;
  current_subscription public.pricing_subscription_snapshots;
  normalized_account text:=upper(coalesce(selected_account_type,''));
  normalized_mode text:=upper(coalesce(selected_operating_mode,''));
  normalized_plan text:=upper(coalesce(selected_plan_level,''));
  normalized_currency text:=upper(coalesce(selected_currency,''));
  generated_slug text;
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;

  select * into actor_profile from public.profiles where id=actor for update;
  if actor_profile.id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  if actor_profile.role='SUPER_ADMIN' then raise exception 'FOUNDER_REONBOARDING_FORBIDDEN'; end if;
  if not actor_profile.reonboarding_required then raise exception 'REONBOARDING_NOT_REQUIRED'; end if;

  select o.* into commercial_org
  from public.organization_members m
  join public.organizations o on o.id=m.organization_id
  where m.user_id=actor and m.role='OWNER' and o.type<>'STUDENT'
  order by m.created_at limit 1
  for update of o;

  select o.* into student_org
  from public.organization_members m
  join public.organizations o on o.id=m.organization_id
  where m.user_id=actor and m.role='OWNER' and o.type='STUDENT'
  order by m.created_at limit 1
  for update of o;

  if normalized_account='PERSONAL' then
    if commercial_org.id is not null then
      raise exception 'EXISTING_BUSINESS_DATA_REQUIRES_BUSINESS_ACCOUNT';
    end if;

    if student_org.id is null then
      generated_slug:='student-'||substr(replace(actor::text,'-',''),1,16);
      insert into public.organizations(
        name,slug,type,status,created_by,currency,operating_mode,source_of_truth,setup_status
      ) values(
        coalesce(nullif(trim(actor_profile.full_name),''),'مساحة الطالب'),generated_slug,
        'STUDENT','active',actor,'SAR','MADAR_NATIVE','MADAR','ready'
      ) returning * into student_org;
      insert into public.organization_members(organization_id,user_id,role)
      values(student_org.id,actor,'OWNER');
    else
      update public.organizations set status='active',setup_status='ready',updated_at=now()
      where id=student_org.id;
    end if;

    update public.profiles set
      account_type='PERSONAL',
      account_type_selected_at=now(),
      account_migration_source='V2_EXISTING_CUSTOMER_REONBOARDING',
      default_commercial_organization_id=null,
      reonboarding_required=false
    where id=actor;

    insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(actor,'v2.customer_reonboarding.completed','profile',actor,
      jsonb_build_object('accountType','PERSONAL','preservedStudentOrganization',student_org.id));
    return 'PERSONAL';
  end if;

  if normalized_account<>'BUSINESS' then raise exception 'INVALID_ACCOUNT_TYPE'; end if;
  if student_org.id is not null and commercial_org.id is null then
    raise exception 'EXISTING_STUDENT_DATA_REQUIRES_PERSONAL_ACCOUNT';
  end if;
  if normalized_mode not in ('MADAR_NATIVE','CONNECTED_EXTERNAL') then raise exception 'INVALID_OPERATING_MODE'; end if;
  if normalized_plan not in ('BASIC','PREMIUM','FULL') then raise exception 'INVALID_PLAN_LEVEL'; end if;
  if selected_term_months not in (1,6,12) then raise exception 'INVALID_PLAN_TERM'; end if;
  if normalized_currency not in ('SAR','USD','YER') then raise exception 'INVALID_CURRENCY'; end if;
  if coalesce(length(trim(selected_business_name)),0)<2 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;

  select * into specialization
  from public.activity_specializations
  where code=upper(coalesce(selected_specialization_code,''))
    and status='approved' and is_visible and launch_enabled;
  if specialization.id is null then raise exception 'VERTICAL_NOT_APPROVED'; end if;

  update public.profiles set
    account_type='BUSINESS',
    account_type_selected_at=now(),
    account_migration_source='V2_EXISTING_CUSTOMER_REONBOARDING'
  where id=actor;

  if commercial_org.id is null then
    generated_slug:='business-'||substr(replace(actor::text,'-',''),1,16);
    insert into public.organizations(
      name,slug,type,status,created_by,currency,operating_mode,source_of_truth,setup_status
    ) values(
      trim(selected_business_name),generated_slug,'MERCHANT','active',actor,normalized_currency,
      normalized_mode,case when normalized_mode='CONNECTED_EXTERNAL' then 'EXTERNAL' else 'MADAR' end,'not_started'
    ) returning * into commercial_org;
    insert into public.organization_members(organization_id,user_id,role)
    values(commercial_org.id,actor,'OWNER');
  else
    update public.organizations set
      name=trim(selected_business_name),
      status='active',
      currency=normalized_currency,
      operating_mode=normalized_mode,
      source_of_truth=case when normalized_mode='CONNECTED_EXTERNAL' then 'EXTERNAL' else 'MADAR' end,
      setup_status='not_started',
      updated_at=now()
    where id=commercial_org.id
    returning * into commercial_org;
  end if;

  update public.profiles set default_commercial_organization_id=commercial_org.id where id=actor;
  perform private.activate_sector_package_impl(commercial_org.id,specialization.id,actor);

  select * into variant from public.pricing_variants
  where level_code=normalized_plan and term_months=selected_term_months
    and operating_mode=normalized_mode and is_active
  limit 1;
  if variant.id is null then raise exception 'PRICING_VARIANT_NOT_AVAILABLE'; end if;

  select * into price_book from public.pricing_price_books
  where is_default and status='active' order by valid_from desc limit 1;
  select * into variant_price from public.pricing_variant_prices
  where price_book_id=price_book.id and variant_id=variant.id and currency=normalized_currency;
  if variant_price.variant_id is null then raise exception 'PRICING_PRICE_NOT_AVAILABLE'; end if;

  select coalesce(jsonb_object_agg(entitlement_key,value),'{}'::jsonb) into entitlements
  from public.pricing_variant_entitlements where variant_id=variant.id;

  select * into current_subscription
  from public.pricing_subscription_snapshots
  where organization_id=commercial_org.id and status in ('trialing','active','past_due')
  order by created_at desc limit 1 for update;

  if current_subscription.id is null then
    insert into public.pricing_subscription_snapshots(
      organization_id,variant_id,price_book_id,currency,locked_amount,locked_entitlements,
      trial_starts_at,trial_ends_at,ends_at,status
    ) values(
      commercial_org.id,variant.id,price_book.id,normalized_currency,variant_price.amount,entitlements,
      now(),now()+(variant.trial_days||' days')::interval,
      now()+(variant.trial_days||' days')::interval,'trialing'
    );
  else
    update public.pricing_subscription_snapshots set
      variant_id=variant.id,
      price_book_id=price_book.id,
      currency=normalized_currency,
      locked_amount=variant_price.amount,
      locked_entitlements=entitlements,
      updated_at=now()
    where id=current_subscription.id;
  end if;

  update public.profiles set reonboarding_required=false where id=actor;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(actor,'v2.customer_reonboarding.completed','organization',commercial_org.id,
    jsonb_build_object(
      'accountType','BUSINESS','specialization',specialization.code,'planLevel',normalized_plan,
      'termMonths',selected_term_months,'operatingMode',normalized_mode,'preservedOrganization',true
    ));

  return 'BUSINESS';
end;
$$;

revoke all on function public.complete_existing_customer_onboarding(text,text,text,text,integer,text,text)
from public,anon;
grant execute on function public.complete_existing_customer_onboarding(text,text,text,text,integer,text,text)
to authenticated;
