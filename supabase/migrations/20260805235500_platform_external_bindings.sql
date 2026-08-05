begin;

create table if not exists public.platform_external_bindings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('nango')),
  external_key text not null,
  external_id text not null,
  status text not null default 'active' check (status in ('active','paused','error','revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_external_bindings_provider_external_id_key unique (provider, external_id)
);

create index if not exists platform_external_bindings_org_provider_idx
  on public.platform_external_bindings (organization_id, provider, external_key);

alter table public.platform_external_bindings enable row level security;

revoke all on table public.platform_external_bindings from anon;
revoke insert, update, delete on table public.platform_external_bindings from authenticated;
grant select on table public.platform_external_bindings to authenticated;
grant all on table public.platform_external_bindings to service_role;

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
        and membership.user_id = auth.uid()
    )
  );

comment on table public.platform_external_bindings is
  'Non-secret references to externally managed integration connections. OAuth credentials remain with the provider.';

commit;
