begin;

create index if not exists platform_external_bindings_created_by_idx
  on public.platform_external_bindings (created_by)
  where created_by is not null;

drop policy if exists platform_external_bindings_member_read on public.platform_external_bindings;
create policy platform_external_bindings_member_read
  on public.platform_external_bindings
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_members membership
      where membership.organization_id = platform_external_bindings.organization_id
        and membership.user_id = (select auth.uid())
    )
  );

commit;
