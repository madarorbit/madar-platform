-- Resolve the safe global + organization ORBY runtime settings for a member.
-- Only an explicit allow-list of routing/runtime fields is returned. Provider
-- credentials remain server-side environment variables and never enter this RPC.

create or replace function public.orby_resolve_runtime_config(target_organization uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
 global_config jsonb;
 organization_config jsonb;
 resolved jsonb;
begin
 if auth.uid() is null then perform private.raise_forbidden(); end if;
 if not private.is_admin() and not exists(
  select 1
  from public.organization_members m
  where m.organization_id=target_organization
   and m.user_id=auth.uid()
 ) then
  perform private.raise_forbidden();
 end if;

 select c.config into global_config
 from public.orby_runtime_config c
 where c.organization_id is null
 order by c.updated_at desc,c.id desc
 limit 1;

 select c.config into organization_config
 from public.orby_runtime_config c
 where c.organization_id=target_organization
 order by c.updated_at desc,c.id desc
 limit 1;

 resolved:=coalesce(global_config,'{}'::jsonb)||coalesce(organization_config,'{}'::jsonb);
 return jsonb_strip_nulls(jsonb_build_object(
  'enabled',resolved->'enabled',
  'defaultModelId',resolved->'defaultModelId',
  'maxContextCharacters',resolved->'maxContextCharacters',
  'sessionHistoryLimit',resolved->'sessionHistoryLimit',
  'sessionTtlSeconds',resolved->'sessionTtlSeconds',
  'requestTimeoutMs',resolved->'requestTimeoutMs',
  'maxAttempts',resolved->'maxAttempts',
  'retryBaseDelayMs',resolved->'retryBaseDelayMs',
  'logLevel',resolved->'logLevel',
  'allowedProviderIds',resolved->'allowedProviderIds',
  'allowedModelIds',resolved->'allowedModelIds'
 ));
end $$;

revoke all on function public.orby_resolve_runtime_config(uuid) from public,anon;
grant execute on function public.orby_resolve_runtime_config(uuid) to authenticated,service_role;
