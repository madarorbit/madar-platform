create type public.job_application_status as enum ('new','reviewing','shortlisted','rejected','hired');

create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_slug text not null check (job_slug in ('growth-marketing','platform-developer')),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) between 5 and 254),
  phone text check (phone is null or char_length(phone) between 7 and 30),
  location text check (location is null or char_length(location) <= 120),
  portfolio_url text check (portfolio_url is null or char_length(portfolio_url) <= 500),
  experience_summary text not null check (char_length(experience_summary) between 40 and 4000),
  status public.job_application_status not null default 'new',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index job_applications_status_created_idx on public.job_applications(status,created_at desc);
create index job_applications_reviewed_by_idx on public.job_applications(reviewed_by);
alter table public.job_applications enable row level security;
revoke all on public.job_applications from anon, authenticated;
grant insert (job_slug,full_name,email,phone,location,portfolio_url,experience_summary) on public.job_applications to anon, authenticated;
grant select, update on public.job_applications to authenticated;

create policy "public can submit job applications" on public.job_applications
for insert to anon, authenticated with check (status='new' and reviewed_by is null and reviewed_at is null);

create policy "admins can review job applications" on public.job_applications
for select to authenticated using ((select public.is_admin()));

create policy "admins can update job applications" on public.job_applications
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

comment on table public.job_applications is 'Private career applications submitted through MADAR Platform.';
