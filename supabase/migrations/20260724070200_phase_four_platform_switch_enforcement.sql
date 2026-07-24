-- Enforce founder-controlled platform switches at the database boundary.
create or replace function private.enforce_registration_switch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.platform_settings where id=1 and not beta_registration_open) then raise exception 'REGISTRATION_CLOSED';end if;
 return new;
end $$;
revoke all on function private.enforce_registration_switch() from public,anon,authenticated;
drop trigger if exists enforce_registration_switch on public.profiles;
create trigger enforce_registration_switch before insert on public.profiles for each row execute function private.enforce_registration_switch();

create or replace function private.enforce_workspace_creation_switch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.platform_settings where id=1 and not workspace_creation_enabled) then raise exception 'WORKSPACE_CREATION_CLOSED';end if;
 return new;
end $$;
revoke all on function private.enforce_workspace_creation_switch() from public,anon,authenticated;
drop trigger if exists enforce_workspace_creation_switch on public.workspace_requests;
create trigger enforce_workspace_creation_switch before insert on public.workspace_requests for each row execute function private.enforce_workspace_creation_switch();

create or replace function private.enforce_store_switch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.platform_settings where id=1 and not store_enabled) then raise exception 'STORE_DISABLED';end if;
 return new;
end $$;
revoke all on function private.enforce_store_switch() from public,anon,authenticated;
drop trigger if exists enforce_store_switch on public.orders;
create trigger enforce_store_switch before insert on public.orders for each row execute function private.enforce_store_switch();

create or replace function private.enforce_orby_switch()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.platform_settings where id=1 and not orby_enabled) then raise exception 'ORBY_DISABLED';end if;
 return new;
end $$;
revoke all on function private.enforce_orby_switch() from public,anon,authenticated;
drop trigger if exists enforce_orby_switch on public.orby_usage_daily;
create trigger enforce_orby_switch before insert or update on public.orby_usage_daily for each row execute function private.enforce_orby_switch();
