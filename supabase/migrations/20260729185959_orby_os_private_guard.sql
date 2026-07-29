-- Compatibility guard used by ORBY OS administrative RPCs.
create or replace function private.raise_forbidden()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
 raise exception 'Not authorized' using errcode='42501';
end
$$;
revoke all on function private.raise_forbidden() from public,anon,authenticated,service_role;
