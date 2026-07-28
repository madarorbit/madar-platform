-- ORBY Initial Architecture & Build Roadmap — Stage 1
-- Additive persistence boundary for runtime configuration and sessions.
-- Provider credentials are intentionally excluded and remain server-side environment secrets.

create extension if not exists pgcrypto;

create table if not exists public.orby_runtime_config (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id) on delete cascade,
 config jsonb not null default '{}'::jsonb,
 revision integer not null default 1 check (revision > 0),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(config) = 'object')
);
create unique index if not exists orby_runtime_config_scope_uidx on public.orby_runtime_config (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.orby_sessions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid,
 status text not null default 'active' check (status in ('active','closed','expired')),
 metadata jsonb not null default '{}'::jsonb,
 expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(metadata) = 'object')
);
create index if not exists orby_sessions_owner_idx on public.orby_sessions (organization_id,user_id,updated_at desc);
create index if not exists orby_sessions_expiry_idx on public.orby_sessions (expires_at) where status='active';

create table if not exists public.orby_session_messages (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.orby_sessions(id) on delete cascade,
 role text not null check (role in ('system','user','assistant')),
 content text not null check (char_length(content) between 1 and 100000),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 check (jsonb_typeof(metadata) = 'object')
);
create index if not exists orby_session_messages_history_idx on public.orby_session_messages (session_id,created_at,id);

create table if not exists public.orby_model_registry (
 id text primary key,
 provider_id text not null,
 provider_model text not null,
 display_name text not null,
 enabled boolean not null default false,
 priority integer not null default 0,
 capabilities jsonb not null default '{}'::jsonb,
 limits jsonb not null default '{}'::jsonb,
 pricing jsonb not null default '{}'::jsonb,
 metadata jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(capabilities)='object' and jsonb_typeof(limits)='object' and jsonb_typeof(pricing)='object' and jsonb_typeof(metadata)='object')
);
create index if not exists orby_model_registry_routing_idx on public.orby_model_registry (enabled,priority desc,provider_id);

create table if not exists public.orby_provider_health (
 provider_id text primary key,
 ok boolean not null,
 latency_ms integer not null default 0 check (latency_ms >= 0),
 message text,
 metadata jsonb not null default '{}'::jsonb,
 checked_at timestamptz not null default now(),
 check (jsonb_typeof(metadata)='object')
);

alter table public.orby_runtime_config enable row level security;
alter table public.orby_sessions enable row level security;
alter table public.orby_session_messages enable row level security;
alter table public.orby_model_registry enable row level security;
alter table public.orby_provider_health enable row level security;

drop policy if exists orby_runtime_config_select on public.orby_runtime_config;
create policy orby_runtime_config_select on public.orby_runtime_config for select to authenticated using (
 (organization_id is not null and exists (select 1 from public.organization_members m where m.organization_id=orby_runtime_config.organization_id and m.user_id=auth.uid())) or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='SUPER_ADMIN')
);
drop policy if exists orby_runtime_config_manage on public.orby_runtime_config;
create policy orby_runtime_config_manage on public.orby_runtime_config for all to authenticated using (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='SUPER_ADMIN') or (organization_id is not null and exists (select 1 from public.organization_members m where m.organization_id=orby_runtime_config.organization_id and m.user_id=auth.uid() and m.role in ('OWNER','ADMIN')))
) with check (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='SUPER_ADMIN') or (organization_id is not null and exists (select 1 from public.organization_members m where m.organization_id=orby_runtime_config.organization_id and m.user_id=auth.uid() and m.role in ('OWNER','ADMIN')))
);

drop policy if exists orby_sessions_owner on public.orby_sessions;
create policy orby_sessions_owner on public.orby_sessions for all to authenticated using (
 user_id=auth.uid() and exists (select 1 from public.organization_members m where m.organization_id=orby_sessions.organization_id and m.user_id=auth.uid())
) with check (
 user_id=auth.uid() and exists (select 1 from public.organization_members m where m.organization_id=orby_sessions.organization_id and m.user_id=auth.uid())
);

drop policy if exists orby_session_messages_owner on public.orby_session_messages;
create policy orby_session_messages_owner on public.orby_session_messages for all to authenticated using (
 exists (select 1 from public.orby_sessions s where s.id=orby_session_messages.session_id and s.user_id=auth.uid())
) with check (
 exists (select 1 from public.orby_sessions s where s.id=orby_session_messages.session_id and s.user_id=auth.uid())
);

drop policy if exists orby_model_registry_admin on public.orby_model_registry;
create policy orby_model_registry_admin on public.orby_model_registry for all to authenticated using (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('SUPER_ADMIN','ADMIN'))
) with check (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('SUPER_ADMIN','ADMIN'))
);

drop policy if exists orby_provider_health_admin on public.orby_provider_health;
create policy orby_provider_health_admin on public.orby_provider_health for all to authenticated using (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('SUPER_ADMIN','ADMIN'))
) with check (
 exists (select 1 from public.profiles p where p.id=auth.uid() and p.role in ('SUPER_ADMIN','ADMIN'))
);

revoke all on public.orby_runtime_config,public.orby_sessions,public.orby_session_messages,public.orby_model_registry,public.orby_provider_health from anon;
grant select,insert,update,delete on public.orby_runtime_config,public.orby_sessions,public.orby_session_messages,public.orby_model_registry,public.orby_provider_health to authenticated;
