-- Cover every foreign key used by operational joins or referential actions.
-- These indexes are deliberately explicit so a tenant growing beyond V0 does not
-- pay for sequential scans when parent rows are updated or removed.

create index retail_audit_logs_actor_idx
  on public.retail_audit_logs(actor_id);

create index retail_cash_accounts_workspace_currency_idx
  on public.retail_cash_accounts(workspace_id, currency);

create index retail_cash_transactions_created_by_idx
  on public.retail_cash_transactions(created_by);

create index retail_cash_transactions_account_idx
  on public.retail_cash_transactions(workspace_id, cash_account_id);

create index retail_categories_created_by_idx
  on public.retail_categories(created_by);

create index retail_customers_created_by_idx
  on public.retail_customers(created_by);

create index retail_debt_transactions_created_by_idx
  on public.retail_debt_transactions(created_by);

create index retail_debt_transactions_payable_idx
  on public.retail_debt_transactions(workspace_id, payable_id);

create index retail_debt_transactions_receivable_idx
  on public.retail_debt_transactions(workspace_id, receivable_id);

create index retail_expenses_created_by_idx
  on public.retail_expenses(created_by);

create index retail_expenses_workspace_currency_idx
  on public.retail_expenses(workspace_id, currency);

create index retail_inventory_movements_created_by_idx
  on public.retail_inventory_movements(created_by);

create index retail_onboarding_drafts_plan_idx
  on public.retail_onboarding_drafts(selected_plan_id);

create index retail_orby_conversations_created_by_idx
  on public.retail_orby_conversations(created_by);

create index retail_orby_messages_created_by_idx
  on public.retail_orby_messages(created_by);

create index retail_payment_requests_method_idx
  on public.retail_payment_requests(payment_method_id);

create index retail_payment_requests_plan_idx
  on public.retail_payment_requests(plan_id);

create index retail_payment_requests_requested_by_idx
  on public.retail_payment_requests(requested_by);

create index retail_payment_requests_reviewed_by_idx
  on public.retail_payment_requests(reviewed_by);

create index retail_payment_requests_subscription_idx
  on public.retail_payment_requests(subscription_id);

create index retail_products_created_by_idx
  on public.retail_products(created_by);

create index retail_products_category_idx
  on public.retail_products(workspace_id, category_id);

create index retail_profiles_active_workspace_idx
  on public.retail_profiles(active_workspace_id);

create index retail_purchases_created_by_idx
  on public.retail_purchases(created_by);

create index retail_purchases_workspace_currency_idx
  on public.retail_purchases(workspace_id, currency);

create index retail_workspaces_created_by_idx
  on public.retail_workspaces(created_by);

create index retail_sale_return_items_product_idx
  on public.retail_sale_return_items(workspace_id, product_id);

create index retail_sale_return_items_sale_item_idx
  on public.retail_sale_return_items(workspace_id, sale_item_id);

create index retail_sale_return_items_return_idx
  on public.retail_sale_return_items(workspace_id, sale_return_id);

create index retail_sale_returns_created_by_idx
  on public.retail_sale_returns(created_by);

create index retail_sales_created_by_idx
  on public.retail_sales(created_by);

create index retail_sales_workspace_currency_idx
  on public.retail_sales(workspace_id, currency);

create index retail_subscriptions_approved_by_idx
  on public.retail_subscriptions(approved_by);

create index retail_subscriptions_plan_idx
  on public.retail_subscriptions(plan_id);

create index retail_suppliers_created_by_idx
  on public.retail_suppliers(created_by);

create index retail_sync_devices_user_idx
  on public.retail_sync_devices(user_id);

create index retail_sync_operations_user_idx
  on public.retail_sync_operations(user_id);

-- Keep one permissive SELECT policy per role. Administrators retain visibility
-- of inactive configuration while regular users see only active entries.
drop policy plans_public_select on public.retail_plans;
drop policy plans_admin_select on public.retail_plans;

create policy plans_anon_select on public.retail_plans
for select to anon
using (status = 'active' and is_public);

create policy plans_authenticated_select on public.retail_plans
for select to authenticated
using ((status = 'active' and is_public) or private.retail_is_platform_admin());

drop policy payment_methods_select on public.retail_payment_methods;
drop policy payment_methods_admin_select on public.retail_payment_methods;

create policy payment_methods_anon_select on public.retail_payment_methods
for select to anon
using (status = 'active');

create policy payment_methods_authenticated_select on public.retail_payment_methods
for select to authenticated
using (status = 'active' or private.retail_is_platform_admin());
