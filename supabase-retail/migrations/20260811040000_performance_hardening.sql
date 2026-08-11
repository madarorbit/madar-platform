-- Cover every foreign key used by operational joins or referential actions.
-- These indexes are deliberately explicit so a tenant growing beyond V0 does not
-- pay for sequential scans when parent rows are updated or removed.

create index audit_logs_actor_idx
  on public.audit_logs(actor_id);

create index cash_accounts_workspace_currency_idx
  on public.cash_accounts(workspace_id, currency);

create index cash_transactions_created_by_idx
  on public.cash_transactions(created_by);

create index cash_transactions_account_idx
  on public.cash_transactions(workspace_id, cash_account_id);

create index categories_created_by_idx
  on public.categories(created_by);

create index customers_created_by_idx
  on public.customers(created_by);

create index debt_transactions_created_by_idx
  on public.debt_transactions(created_by);

create index debt_transactions_payable_idx
  on public.debt_transactions(workspace_id, payable_id);

create index debt_transactions_receivable_idx
  on public.debt_transactions(workspace_id, receivable_id);

create index expenses_created_by_idx
  on public.expenses(created_by);

create index expenses_workspace_currency_idx
  on public.expenses(workspace_id, currency);

create index inventory_movements_created_by_idx
  on public.inventory_movements(created_by);

create index onboarding_drafts_plan_idx
  on public.onboarding_drafts(selected_plan_id);

create index orby_conversations_created_by_idx
  on public.orby_conversations(created_by);

create index orby_messages_created_by_idx
  on public.orby_messages(created_by);

create index payment_requests_method_idx
  on public.payment_requests(payment_method_id);

create index payment_requests_plan_idx
  on public.payment_requests(plan_id);

create index payment_requests_requested_by_idx
  on public.payment_requests(requested_by);

create index payment_requests_reviewed_by_idx
  on public.payment_requests(reviewed_by);

create index payment_requests_subscription_idx
  on public.payment_requests(subscription_id);

create index products_created_by_idx
  on public.products(created_by);

create index products_category_idx
  on public.products(workspace_id, category_id);

create index profiles_active_workspace_idx
  on public.profiles(active_workspace_id);

create index purchases_created_by_idx
  on public.purchases(created_by);

create index purchases_workspace_currency_idx
  on public.purchases(workspace_id, currency);

create index retail_workspaces_created_by_idx
  on public.retail_workspaces(created_by);

create index sale_return_items_product_idx
  on public.sale_return_items(workspace_id, product_id);

create index sale_return_items_sale_item_idx
  on public.sale_return_items(workspace_id, sale_item_id);

create index sale_return_items_return_idx
  on public.sale_return_items(workspace_id, sale_return_id);

create index sale_returns_created_by_idx
  on public.sale_returns(created_by);

create index sales_created_by_idx
  on public.sales(created_by);

create index sales_workspace_currency_idx
  on public.sales(workspace_id, currency);

create index subscriptions_approved_by_idx
  on public.subscriptions(approved_by);

create index subscriptions_plan_idx
  on public.subscriptions(plan_id);

create index suppliers_created_by_idx
  on public.suppliers(created_by);

create index sync_devices_user_idx
  on public.sync_devices(user_id);

create index sync_operations_user_idx
  on public.sync_operations(user_id);

-- Keep one permissive SELECT policy per role. Administrators retain visibility
-- of inactive configuration while regular users see only active entries.
drop policy plans_public_select on public.plans;
drop policy plans_admin_select on public.plans;

create policy plans_anon_select on public.plans
for select to anon
using (status = 'active' and is_public);

create policy plans_authenticated_select on public.plans
for select to authenticated
using ((status = 'active' and is_public) or private.is_platform_admin());

drop policy payment_methods_select on public.payment_methods;
drop policy payment_methods_admin_select on public.payment_methods;

create policy payment_methods_anon_select on public.payment_methods
for select to anon
using (status = 'active');

create policy payment_methods_authenticated_select on public.payment_methods
for select to authenticated
using (status = 'active' or private.is_platform_admin());
