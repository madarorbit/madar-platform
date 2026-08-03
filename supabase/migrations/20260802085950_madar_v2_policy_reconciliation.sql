-- Reconcile a production database where the additive V2 migration created
-- schema objects and RLS policies before a later statement exposed a SQL bug.
-- Only V2-owned policies are removed; P0-P11 recreates them in the same
-- transaction immediately after this migration.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public'
      and (
        tablename=any(array[
          'platform_release_decisions','activity_families','activity_types','activity_specializations','activity_onboarding_questions',
          'sector_packages','sector_package_versions','activity_specialization_packages','udm_entity_definitions','udm_mapping_contracts',
          'sector_event_definitions','sector_kpi_definitions','sector_orby_tools','pricing_price_books','pricing_plan_levels','pricing_variants',
          'pricing_variant_prices','pricing_entitlement_definitions','pricing_variant_entitlements','native_module_definitions','sector_module_bindings',
          'activity_profiles','activity_profile_answers','organization_sector_packages','pricing_subscription_snapshots','pricing_subscription_changes',
          'organization_modules','sector_dashboard_configs','sector_report_configs','commerce_purchase_orders','commerce_purchase_order_items',
          'commerce_goods_receipts','commerce_goods_receipt_items','commerce_sales_returns','commerce_sales_return_items','sector_operation_events',
          'integration_connector_requests','integration_schema_snapshots','integration_mapping_previews','integration_sync_previews',
          'integration_inbound_endpoints','integration_inbound_deliveries','integration_health_incidents','integration_permission_grants',
          'integration_consent_log','integration_write_commands','integration_write_attempts','integration_write_conflicts',
          'integration_compensations','integration_reverse_sync_records','restaurant_locations','restaurant_recipes',
          'restaurant_recipe_ingredients','restaurant_orders','restaurant_order_items','restaurant_kitchen_tickets','hotel_properties',
          'hotel_rooms','hotel_rates','hotel_rate_availability','hotel_reservations','hotel_stays','hotel_housekeeping_tasks',
          'hotel_maintenance_requests','hotel_folios','hotel_folio_charges','pricing_local_payment_requests'
        ])
        or (tablename='integration_connectors' and policyname in (
          'integration connector catalog read','certified integration connector catalog read'
        ))
      )
      and (
        policyname like 'approved %'
        or policyname like 'active %'
        or policyname like 'certified %'
        or policyname like 'admin manage %'
        or policyname like 'organization member read %'
        or policyname in (
          'specialization packages read','pricing prices read','entitlement definitions read','variant entitlements read',
          'module definitions read','sector module bindings read','members read v2 pricing payments',
          'integration connector catalog read','certified integration connector catalog read'
        )
      )
  loop
    execute format('drop policy if exists %I on %I.%I',policy_row.policyname,policy_row.schemaname,policy_row.tablename);
  end loop;
end $$;
