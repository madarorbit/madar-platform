-- Phase 2: additive customer workspaces. Apply with the official Supabase CLI only.
create type public.organization_type as enum ('INDIVIDUAL','MERCHANT','COMPANY');
create type public.organization_status as enum ('active','suspended','archived');
create type public.organization_role as enum ('OWNER','ADMIN','MEMBER');
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check (char_length(trim(name)) between 2 and 120),
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'), type public.organization_type not null,
 status public.organization_status not null default 'active', created_by uuid not null references public.profiles(id) on delete restrict,
 country text, city text, whatsapp text, website text, description text, logo_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
 role public.organization_role not null default 'MEMBER', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key (organization_id,user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);
create trigger organizations_updated before update on public.organizations for each row execute function public.touch_updated_at();
create trigger organization_members_updated before update on public.organization_members for each row execute function public.touch_updated_at();
create or replace function public.is_organization_member(target uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members where organization_id=target and user_id=auth.uid()) $$;
create or replace function public.has_organization_role(target uuid, allowed public.organization_role[]) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.organization_members where organization_id=target and user_id=auth.uid() and role=any(allowed)) $$;
create or replace function public.create_organization(workspace_name text, workspace_slug text, workspace_type public.organization_type) returns public.organizations language plpgsql security definer set search_path=public as $$
declare created public.organizations; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Invalid slug'; end if;
 insert into public.organizations(name,slug,type,created_by) values(trim(workspace_name),workspace_slug,workspace_type,auth.uid()) returning * into created;
 insert into public.organization_members(organization_id,user_id,role) values(created.id,auth.uid(),'OWNER');
 return created;
end; $$;
revoke all on function public.create_organization(text,text,public.organization_type) from public;
grant execute on function public.create_organization(text,text,public.organization_type) to authenticated;
alter table public.organizations enable row level security; alter table public.organization_members enable row level security;
create policy "organization member read" on public.organizations for select using(public.is_organization_member(id));
create policy "organization owner update" on public.organizations for update using(public.has_organization_role(id,array['OWNER']::public.organization_role[])) with check(public.has_organization_role(id,array['OWNER']::public.organization_role[]));
create policy "organization member list" on public.organization_members for select using(public.is_organization_member(organization_id));
create policy "organization owner manage members" on public.organization_members for all using(public.has_organization_role(organization_id,array['OWNER']::public.organization_role[])) with check(public.has_organization_role(organization_id,array['OWNER']::public.organization_role[]));
create or replace function public.prevent_last_organization_owner() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if old.role='OWNER' and (tg_op='DELETE' or new.role <> 'OWNER') and not exists(select 1 from public.organization_members where organization_id=old.organization_id and user_id<>old.user_id and role='OWNER') then raise exception 'An organization must retain an owner'; end if; return coalesce(new,old); end; $$;
create trigger organization_owner_required before update or delete on public.organization_members for each row execute function public.prevent_last_organization_owner();
