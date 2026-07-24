begin;

create table if not exists public.plan_tags (
  plan_id uuid not null references public.plans(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(plan_id,tag_id)
);

alter table public.plan_tags enable row level security;
create policy "visible plan tags public" on public.plan_tags for select using(
  exists(select 1 from public.plans p where p.id=plan_id and p.status='published' and p.visibility='visible' and p.is_active and p.show_in_store and p.deleted_at is null)
  or public.is_admin()
);
create policy "admins plan tags" on public.plan_tags for all using(public.is_admin()) with check(public.is_admin());

commit;
