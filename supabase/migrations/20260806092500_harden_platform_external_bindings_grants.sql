begin;

revoke all privileges on table public.platform_external_bindings from anon;
revoke all privileges on table public.platform_external_bindings from authenticated;
grant select on table public.platform_external_bindings to authenticated;
grant all privileges on table public.platform_external_bindings to service_role;

commit;
