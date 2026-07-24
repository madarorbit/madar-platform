-- Keep PostgreSQL extensions out of the public API schema.
begin;

create schema if not exists extensions;

do $$
begin
  if exists (select 1 from pg_extension where extname='pg_trgm') then
    alter extension pg_trgm set schema extensions;
  end if;
end $$;

commit;
