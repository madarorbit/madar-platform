-- Use the full UUID entropy in generated workspace slugs.

create or replace function public.complete_retail_onboarding(target_operation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  draft public.onboarding_drafts%rowtype;
  selected_plan public.plans%rowtype;
  existing_workspace uuid;
  workspace_id uuid;
  workspace_slug text;
  result jsonb;
begin
  if actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
  select active_workspace_id into existing_workspace
  from public.profiles where id = actor and status = 'active';
  if existing_workspace is not null then
    return jsonb_build_object('workspace_id', existing_workspace, 'idempotent', true);
  end if;

  select * into draft from public.onboarding_drafts where user_id = actor for update;
  if draft.user_id is null then raise exception 'ONBOARDING_DRAFT_REQUIRED'; end if;
  if draft.trade_name is null or char_length(btrim(draft.trade_name)) < 2 then raise exception 'TRADE_NAME_REQUIRED'; end if;
  if draft.subtype is null then raise exception 'RETAIL_SUBTYPE_REQUIRED'; end if;
  if draft.selected_plan_id is null then raise exception 'PLAN_REQUIRED'; end if;

  select * into selected_plan
  from public.plans
  where id = draft.selected_plan_id and status = 'active' and is_public
  for share;
  if selected_plan.id is null then raise exception 'PLAN_UNAVAILABLE'; end if;

  workspace_id := draft.reserved_workspace_id;
  workspace_slug := 'retail-' || replace(workspace_id::text, '-', '');

  insert into public.retail_workspaces(
    id, name, slug, subtype, owner_name, phone, city, country, currency,
    logo_path, price_display, inventory_policy, allow_credit_sales,
    invoice_prefix, created_by
  ) values (
    workspace_id, btrim(draft.trade_name), workspace_slug, draft.subtype,
    nullif(btrim(draft.owner_name), ''), nullif(btrim(draft.phone), ''),
    nullif(btrim(draft.city), ''), draft.country, draft.currency,
    draft.logo_path, draft.price_display, draft.inventory_policy,
    draft.allow_credit_sales, upper(draft.invoice_prefix), actor
  );

  insert into public.workspace_members(workspace_id, user_id, role, status)
  values(workspace_id, actor, 'OWNER', 'active');

  insert into public.cash_accounts(workspace_id, currency, is_primary)
  values(workspace_id, draft.currency, true);

  insert into public.subscriptions(
    workspace_id, plan_id, status, starts_at, trial_ends_at, ends_at
  ) values (
    workspace_id,
    selected_plan.id,
    case when selected_plan.trial_days > 0 then 'trialing' else 'expired' end,
    now(),
    case when selected_plan.trial_days > 0 then now() + make_interval(days => selected_plan.trial_days) end,
    case when selected_plan.billing_months is not null and coalesce(selected_plan.price_amount, 0) = 0
      then now() + make_interval(months => selected_plan.billing_months)
    end
  );

  update public.profiles set active_workspace_id = workspace_id where id = actor;
  update public.onboarding_drafts
  set current_step = 5, completed_at = now()
  where user_id = actor;

  result := jsonb_build_object('workspace_id', workspace_id, 'idempotent', false);
  insert into public.sync_operations(
    workspace_id, user_id, operation_id, operation_type, entity_type,
    entity_id, status, applied_at, result
  ) values (
    workspace_id, actor, target_operation, 'ONBOARDING_COMPLETE', 'workspace',
    workspace_id, 'applied', now(), result
  );
  perform private.write_audit(
    workspace_id, actor, 'workspace.created', 'workspace', workspace_id,
    target_operation, jsonb_build_object('domain_model', 'RETAIL', 'plan_id', selected_plan.id)
  );
  return result;
end;
$$;

revoke all on function public.complete_retail_onboarding(uuid) from public, anon, authenticated;
grant execute on function public.complete_retail_onboarding(uuid) to authenticated;
