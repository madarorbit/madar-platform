-- Read-only Phase 1 verification. Run in Supabase SQL Editor; it makes no changes.
select c.relname as table_name, c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('profiles','categories','products','product_images','product_files','services','service_images','audit_logs') order by c.relname;
select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('profiles','categories','products','product_images','product_files','services','service_images','audit_logs') order by table_name,ordinal_position;
select tablename,policyname,cmd from pg_policies where schemaname in ('public','storage') and (tablename in ('profiles','categories','products','product_images','product_files','services','service_images','audit_logs','objects')) order by tablename,policyname;
select event_object_table as table_name,trigger_name from information_schema.triggers where event_object_schema='public' order by 1,2;
select id,public from storage.buckets where id in ('catalog-images','digital-products','avatars') order by id;
