grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

DO $$
DECLARE
  policy_row record;
  using_expression text;
  check_expression text;
  statement text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%( SELECT is_admin() AS is_admin)%'
        OR coalesce(with_check, '') LIKE '%( SELECT is_admin() AS is_admin)%'
      )
  LOOP
    using_expression := CASE
      WHEN policy_row.qual IS NULL THEN NULL
      ELSE replace(policy_row.qual, '( SELECT is_admin() AS is_admin)', '( SELECT private.is_admin() AS is_admin)')
    END;
    check_expression := CASE
      WHEN policy_row.with_check IS NULL THEN NULL
      ELSE replace(policy_row.with_check, '( SELECT is_admin() AS is_admin)', '( SELECT private.is_admin() AS is_admin)')
    END;

    statement := format('alter policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
    IF using_expression IS NOT NULL THEN
      statement := statement || format(' using (%s)', using_expression);
    END IF;
    IF check_expression IS NOT NULL THEN
      statement := statement || format(' with check (%s)', check_expression);
    END IF;
    EXECUTE statement;
  END LOOP;
END
$$;

revoke execute on function public.is_admin() from public, anon, authenticated;

DO $$
DECLARE
  table_row record;
BEGIN
  FOR table_row IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'revoke truncate, references, trigger on table %I.%I from anon, authenticated',
      table_row.schemaname,
      table_row.tablename
    );
  END LOOP;
END
$$;

notify pgrst, 'reload schema';
