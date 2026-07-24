begin;
alter table public.plans
  add column if not exists allow_reviews boolean not null default true,
  add column if not exists allow_comments boolean not null default false;
commit;
