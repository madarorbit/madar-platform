-- MADAR Retail V0 — explicit Data API grants, tenant RLS and storage policies.

create or replace function private.shares_workspace(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and mine.status = 'active'
      and theirs.user_id = target_user and theirs.status = 'active'
  )
$$;

revoke all on function private.shares_workspace(uuid) from public, anon, authenticated;

create or replace function private.owns_onboarding_workspace(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.onboarding_drafts
    where reserved_workspace_id = target_workspace
      and user_id = (select auth.uid())
      and completed_at is null
  )
$$;

revoke all on function private.owns_onboarding_workspace(uuid) from public, anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'retail_workspaces', 'workspace_members', 'onboarding_drafts',
    'plans', 'subscriptions', 'payment_methods', 'payment_requests', 'audit_logs',
    'categories', 'products', 'customers', 'suppliers', 'sync_devices',
    'sync_operations', 'cash_accounts', 'sales', 'sale_items', 'purchases',
    'purchase_items', 'expenses', 'receivables', 'payables', 'debt_transactions',
    'inventory_movements', 'cash_transactions', 'sale_returns',
    'sale_return_items', 'sync_changes', 'orby_conversations', 'orby_messages',
    'orby_usage_daily'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or private.shares_workspace(id)
  or private.is_platform_admin()
);

create policy workspaces_select on public.retail_workspaces
for select to authenticated
using (private.is_workspace_member(id) or private.is_platform_admin());

create policy members_select on public.workspace_members
for select to authenticated
using (private.is_workspace_member(workspace_id) or private.is_platform_admin());

create policy onboarding_select on public.onboarding_drafts
for select to authenticated using (user_id = (select auth.uid()));
create policy onboarding_insert on public.onboarding_drafts
for insert to authenticated with check (user_id = (select auth.uid()));
create policy onboarding_update on public.onboarding_drafts
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy plans_public_select on public.plans
for select to anon, authenticated
using (status = 'active' and is_public);
create policy plans_admin_select on public.plans
for select to authenticated
using (private.is_platform_admin());

create policy subscriptions_select on public.subscriptions
for select to authenticated
using (private.is_workspace_member(workspace_id) or private.is_platform_admin());

create policy payment_methods_select on public.payment_methods
for select to anon, authenticated
using (status = 'active');
create policy payment_methods_admin_select on public.payment_methods
for select to authenticated
using (private.is_platform_admin());

create policy payment_requests_select on public.payment_requests
for select to authenticated
using (private.is_workspace_member(workspace_id) or private.is_platform_admin());

create policy audit_logs_select on public.audit_logs
for select to authenticated
using (
  private.is_platform_admin()
  or (workspace_id is not null and private.has_workspace_role(workspace_id, array['OWNER', 'MANAGER']::text[]))
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'categories', 'products', 'customers', 'suppliers', 'sync_devices',
    'sync_operations', 'cash_accounts', 'sales', 'sale_items', 'purchases',
    'purchase_items', 'expenses', 'receivables', 'payables', 'debt_transactions',
    'inventory_movements', 'cash_transactions', 'sale_returns',
    'sale_return_items', 'sync_changes'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_workspace_member(workspace_id) or private.is_platform_admin())',
      table_name || '_workspace_select', table_name
    );
  end loop;
end;
$$;

create policy orby_conversations_select on public.orby_conversations
for select to authenticated
using (
  private.is_platform_admin()
  or created_by = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['OWNER', 'MANAGER']::text[])
);

create policy orby_messages_select on public.orby_messages
for select to authenticated
using (
  private.is_platform_admin()
  or created_by = (select auth.uid())
  or private.has_workspace_role(workspace_id, array['OWNER', 'MANAGER']::text[])
);

create policy orby_usage_select on public.orby_usage_daily
for select to authenticated
using (
  private.is_platform_admin()
  or private.has_workspace_role(workspace_id, array['OWNER', 'MANAGER']::text[])
);

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.plans, public.payment_methods to anon, authenticated;
grant select on public.profiles, public.retail_workspaces, public.workspace_members,
  public.onboarding_drafts, public.subscriptions, public.payment_requests,
  public.audit_logs, public.categories, public.products, public.customers,
  public.suppliers, public.sync_devices, public.sync_operations,
  public.cash_accounts, public.sales, public.sale_items, public.purchases,
  public.purchase_items, public.expenses, public.receivables, public.payables,
  public.debt_transactions, public.inventory_movements, public.cash_transactions,
  public.sale_returns, public.sale_return_items, public.orby_conversations,
  public.orby_messages, public.orby_usage_daily
to authenticated;

grant insert, update on public.onboarding_drafts to authenticated;

grant usage on schema private to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;
grant execute on function private.owns_onboarding_workspace(uuid) to authenticated;

grant execute on function public.complete_retail_onboarding(uuid) to authenticated;
grant execute on function public.retail_create_product(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_adjust_inventory(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_adjust_cash(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_create_expense(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_create_sale(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_create_purchase(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_collect_receivable(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_pay_payable(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_record_sale_return(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_submit_payment_request(uuid, uuid, jsonb) to authenticated;
grant execute on function public.admin_review_retail_payment(uuid, text, text) to authenticated;
grant execute on function public.admin_set_retail_workspace_status(uuid, text, text) to authenticated;
grant execute on function public.register_retail_sync_device(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.pull_retail_sync_changes(uuid, uuid, bigint, integer) to authenticated;
grant execute on function public.retail_analytics_snapshot(uuid, date, date) to authenticated;
grant execute on function public.retail_customer_summaries(uuid) to authenticated;
grant execute on function public.retail_supplier_summaries(uuid) to authenticated;
grant execute on function public.update_my_retail_profile(jsonb) to authenticated;
grant execute on function public.set_active_retail_workspace(uuid) to authenticated;
grant execute on function public.retail_update_workspace_settings(uuid, jsonb) to authenticated;
grant execute on function public.retail_upsert_category(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_update_product(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_upsert_customer(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.retail_upsert_supplier(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.admin_upsert_retail_plan(jsonb) to authenticated;
grant execute on function public.record_orby_retail_exchange(uuid, uuid, text, text, jsonb, text, text, text, integer, integer) to authenticated;
grant execute on function public.reserve_orby_retail_request(uuid) to authenticated;
grant execute on function public.admin_upsert_retail_payment_method(jsonb) to authenticated;

create policy retail_files_select on storage.objects
for select to authenticated
using (
  bucket_id in ('workspace-assets', 'product-images', 'payment-proofs')
  and (
    private.is_workspace_member(((storage.foldername(name))[1])::uuid)
    or (bucket_id = 'workspace-assets' and private.owns_onboarding_workspace(((storage.foldername(name))[1])::uuid))
  )
);

create policy retail_images_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('workspace-assets', 'product-images')
  and (
    private.has_workspace_role(((storage.foldername(name))[1])::uuid, array['OWNER', 'MANAGER', 'STAFF']::text[])
    or (bucket_id = 'workspace-assets' and private.owns_onboarding_workspace(((storage.foldername(name))[1])::uuid))
  )
  and lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp')
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 5242880
);

create policy retail_proofs_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and private.has_workspace_role(((storage.foldername(name))[1])::uuid, array['OWNER', 'MANAGER']::text[])
  and lower(coalesce(metadata->>'mimetype', '')) in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  and coalesce((metadata->>'size')::bigint, 0) between 1 and 10485760
);

create policy retail_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('workspace-assets', 'product-images', 'payment-proofs')
  and private.has_workspace_role(((storage.foldername(name))[1])::uuid, array['OWNER', 'MANAGER']::text[])
);
