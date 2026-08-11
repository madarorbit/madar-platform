-- The integrated product has one trust boundary: MADAR Platform.
-- Retire direct Retail-auth RPC execution while preserving every RLS policy as
-- defense in depth. The service-only bridge invokes the underlying functions as
-- their owner and retains the original authorization checks via the actor claim.

do $$
declare
  target record;
begin
  for target in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proname <> 'retail_platform_execute'
  loop
    execute format('revoke execute on function %s from authenticated', target.signature);
  end loop;
end;
$$;
