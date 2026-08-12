-- The integrated product has one trust boundary: MADAR Platform.
-- Retire direct Retail-auth RPC execution while preserving every RLS policy as
-- defense in depth. The service-only bridge invokes the underlying functions as
-- their owner and retains the original authorization checks via the actor claim.

do $$
declare
  target record;
begin
  for target in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proname = any(array[
        'complete_retail_onboarding',
        'retail_create_product',
        'retail_adjust_inventory',
        'retail_adjust_cash',
        'retail_create_expense',
        'retail_create_sale',
        'retail_create_purchase',
        'retail_collect_receivable',
        'retail_pay_payable',
        'retail_record_sale_return',
        'retail_submit_payment_request',
        'admin_review_retail_payment',
        'admin_set_retail_workspace_status',
        'register_retail_sync_device',
        'pull_retail_sync_changes',
        'retail_analytics_snapshot',
        'retail_customer_summaries',
        'retail_supplier_summaries',
        'update_my_retail_profile',
        'set_active_retail_workspace',
        'retail_update_workspace_settings',
        'retail_upsert_category',
        'retail_update_product',
        'retail_upsert_customer',
        'retail_upsert_supplier',
        'admin_upsert_retail_plan',
        'record_orby_retail_exchange',
        'reserve_orby_retail_request',
        'admin_upsert_retail_payment_method'
      ])
  loop
    execute format('revoke execute on function %s from authenticated', target.signature);
  end loop;
end;
$$;
