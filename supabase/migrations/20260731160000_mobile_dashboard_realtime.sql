-- Enable tenant-scoped Postgres Changes for the read-only mobile dashboard.
-- RLS remains the authorization boundary; the app only uses events to refetch
-- the server-composed snapshot and never trusts event payloads as business data.
do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array[
      'business_products',
      'business_customers',
      'business_sales',
      'business_expenses',
      'business_tasks',
      'orby_insights'
    ]
    loop
      if to_regclass(format('public.%I', target_table)) is not null
        and not exists (
          select 1
          from pg_publication_tables
          where pubname = 'supabase_realtime'
            and schemaname = 'public'
            and tablename = target_table
        )
      then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end
$$;
