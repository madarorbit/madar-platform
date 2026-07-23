-- Explicit Data API privilege lockdown for Phase 4 business tables.
revoke all on table public.organization_member_permissions from anon,authenticated;
revoke all on table public.business_products from anon,authenticated;
revoke all on table public.business_customers from anon,authenticated;
revoke all on table public.business_suppliers from anon,authenticated;
revoke all on table public.business_expenses from anon,authenticated;
revoke all on table public.business_sales from anon,authenticated;
revoke all on table public.business_sale_items from anon,authenticated;
revoke all on table public.inventory_movements from anon,authenticated;
revoke all on table public.business_tasks from anon,authenticated;

grant select,insert,update,delete on public.organization_member_permissions to authenticated;
grant select,insert,delete on public.business_products to authenticated;
grant update(name,sku,description,category,cost,price,low_stock_threshold,is_active) on public.business_products to authenticated;
grant select,insert,update,delete on public.business_customers to authenticated;
grant select,insert,update,delete on public.business_suppliers to authenticated;
grant select,insert,update,delete on public.business_expenses to authenticated;
grant select on public.business_sales,public.business_sale_items,public.inventory_movements to authenticated;
grant select,insert,update,delete on public.business_tasks to authenticated;

-- Career applications remain write-only for visitors.
revoke all on table public.job_applications from anon;
grant insert on table public.job_applications to anon;
