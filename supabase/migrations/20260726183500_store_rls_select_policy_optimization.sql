DO $$
DECLARE
  policy_row record;
  base_name text;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND roles = ARRAY['authenticated']::name[]
      AND qual = '( SELECT private.is_admin() AS is_admin)'
      AND with_check = '( SELECT private.is_admin() AS is_admin)'
      AND tablename IN (
        'featured_items','offer_items','offers','plan_features','plan_tags','plans',
        'product_gallery','product_tags','service_tags','store_settings','subcategories','tags'
      )
  LOOP
    base_name := policy_row.policyname;
    EXECUTE format('drop policy %I on public.%I', base_name, policy_row.tablename);
    EXECUTE format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))',
      base_name || ' insert', policy_row.tablename
    );
    EXECUTE format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',
      base_name || ' update', policy_row.tablename
    );
    EXECUTE format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))',
      base_name || ' delete', policy_row.tablename
    );
  END LOOP;
END
$$;

notify pgrst, 'reload schema';
