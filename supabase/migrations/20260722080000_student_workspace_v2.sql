-- Madar student workspace v2: one free private study space for every account.

alter table public.student_courses
  add column if not exists code text,
  add column if not exists instructor text,
  add column if not exists color text not null default '#6C3BFF',
  add column if not exists target_grade numeric(5,2) check (target_grade between 0 and 100);

alter table public.student_tasks
  add column if not exists course_id uuid references public.student_courses(id) on delete set null,
  add column if not exists description text,
  add column if not exists priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  add column if not exists reminder_at timestamptz,
  add column if not exists completed_at timestamptz;

alter table public.student_notes
  add column if not exists color text not null default 'amber',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists tags text[] not null default '{}';

alter table public.student_schedule
  add column if not exists course_id uuid references public.student_courses(id) on delete set null,
  add column if not exists kind text not null default 'LECTURE' check (kind in ('LECTURE','LAB','STUDY','OTHER'));

alter table public.student_documents
  add column if not exists category text not null default 'REFERENCE' check (category in ('SUMMARY','HANDOUT','BOOK','RESEARCH','REFERENCE')),
  add column if not exists description text,
  add column if not exists is_favorite boolean not null default false;

create table public.student_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid references public.student_courses(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  kind text not null default 'EXAM' check (kind in ('EXAM','ASSIGNMENT','PRESENTATION','DEADLINE','OTHER')),
  starts_at timestamptz not null,
  location text,
  notes text,
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.student_study_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id uuid references public.student_courses(id) on delete set null,
  title text not null check (char_length(trim(title)) between 2 and 180),
  minutes integer not null check (minutes between 1 and 1440),
  studied_on date not null default current_date,
  focus_score smallint check (focus_score between 1 and 5),
  notes text,
  created_at timestamptz not null default now()
);

create table public.student_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 180),
  target_value integer not null check (target_value > 0),
  current_value integer not null default 0 check (current_value >= 0),
  unit text not null default 'ساعة' check (char_length(trim(unit)) between 1 and 40),
  deadline date,
  is_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_ai_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('PLAN','SUMMARY','QUIZ','EXPLAIN')),
  prompt_excerpt text not null,
  response text not null,
  created_at timestamptz not null default now()
);

create index student_tasks_course_idx on public.student_tasks(course_id);
create index student_tasks_reminder_idx on public.student_tasks(organization_id, reminder_at) where reminder_at is not null and is_done = false;
create index student_schedule_course_idx on public.student_schedule(course_id);
create index student_events_org_start_idx on public.student_events(organization_id, starts_at);
create index student_events_course_idx on public.student_events(course_id);
create index student_study_sessions_org_date_idx on public.student_study_sessions(organization_id, studied_on desc);
create index student_study_sessions_course_idx on public.student_study_sessions(course_id);
create index student_goals_org_idx on public.student_goals(organization_id, is_done, deadline);
create index student_ai_history_org_idx on public.student_ai_history(organization_id, created_at desc);
create index student_ai_history_user_idx on public.student_ai_history(user_id);
create trigger student_goals_updated before update on public.student_goals for each row execute function public.touch_updated_at();

alter table public.student_events enable row level security;
alter table public.student_study_sessions enable row level security;
alter table public.student_goals enable row level security;
alter table public.student_ai_history enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['student_events','student_study_sessions','student_goals'] loop
    execute format('create policy "student member access" on public.%I for all to authenticated using ((select private.is_student_organization_member(organization_id))) with check ((select private.is_student_organization_member(organization_id)))', table_name);
    execute format('revoke all on public.%I from anon,authenticated', table_name);
    execute format('grant select,insert,update,delete on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end $$;

create policy "student ai owner access" on public.student_ai_history for all to authenticated
using (user_id = (select auth.uid()) and (select private.is_student_organization_member(organization_id)))
with check (user_id = (select auth.uid()) and (select private.is_student_organization_member(organization_id)));
revoke all on public.student_ai_history from anon,authenticated;
grant select,insert,delete on public.student_ai_history to authenticated;
grant all on public.student_ai_history to service_role;

create or replace function private.ensure_student_workspace_impl()
returns public.organizations language plpgsql security definer set search_path = '' as $$
declare existing public.organizations; created public.organizations; base_slug text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select o.* into existing from public.organizations o
  join public.organization_members m on m.organization_id=o.id
  where m.user_id=(select auth.uid()) and o.type='STUDENT' and o.status='active'
  order by o.created_at limit 1;
  if existing.id is not null then return existing; end if;
  base_slug := 'student-' || left(replace((select auth.uid())::text,'-',''), 12);
  insert into public.organizations(name,slug,type,created_by)
  values('مساحتي الجامعية', base_slug, 'STUDENT', (select auth.uid())) returning * into created;
  insert into public.organization_members(organization_id,user_id,role)
  values(created.id,(select auth.uid()),'OWNER');
  return created;
end; $$;
revoke all on function private.ensure_student_workspace_impl() from public,anon;
grant execute on function private.ensure_student_workspace_impl() to authenticated;

create or replace function public.ensure_student_workspace()
returns public.organizations language sql security invoker set search_path = '' as $$
  select private.ensure_student_workspace_impl()
$$;
revoke all on function public.ensure_student_workspace() from public,anon;
grant execute on function public.ensure_student_workspace() to authenticated;

create or replace function private.sync_student_reminders_impl(target_organization uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted_count integer := 0;
begin
  if not (select private.is_student_organization_member(target_organization)) then raise exception 'Forbidden'; end if;
  insert into public.notifications(user_id,title,body,link)
  select (select auth.uid()),'تذكير دراسي: '||t.title,
         coalesce('موعد المهمة: '||to_char(t.due_at at time zone 'Asia/Aden','YYYY-MM-DD HH24:MI'),'راجع مساحة الطالب.'),'/student?section=tasks'
  from public.student_tasks t
  where t.organization_id=target_organization and not t.is_done and t.reminder_at is not null and t.reminder_at<=now()
    and not exists(select 1 from public.notifications n where n.user_id=(select auth.uid()) and n.title='تذكير دراسي: '||t.title and n.link='/student?section=tasks');
  get diagnostics inserted_count = row_count;
  insert into public.notifications(user_id,title,body,link)
  select (select auth.uid()),'موعد جامعي قريب: '||e.title,
         'الموعد: '||to_char(e.starts_at at time zone 'Asia/Aden','YYYY-MM-DD HH24:MI'),'/student?section=calendar'
  from public.student_events e
  where e.organization_id=target_organization and e.reminder_at is not null and e.reminder_at<=now() and e.reminder_sent_at is null;
  update public.student_events set reminder_sent_at=now()
  where organization_id=target_organization and reminder_at is not null and reminder_at<=now() and reminder_sent_at is null;
  return inserted_count;
end; $$;
revoke all on function private.sync_student_reminders_impl(uuid) from public,anon;
grant execute on function private.sync_student_reminders_impl(uuid) to authenticated;
create or replace function public.sync_student_reminders(target_organization uuid)
returns integer language sql security invoker set search_path = '' as $$ select private.sync_student_reminders_impl(target_organization) $$;
revoke all on function public.sync_student_reminders(uuid) from public,anon;
grant execute on function public.sync_student_reminders(uuid) to authenticated;

create or replace function private.create_workspace_request_impl(workspace_name text,workspace_slug text,workspace_type public.organization_type)
returns public.workspace_requests language plpgsql security definer set search_path='' as $$
declare created public.workspace_requests;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if workspace_type='STUDENT' then raise exception 'Student workspace does not require payment'; end if;
 if workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Invalid slug'; end if;
 if exists(
   select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
   where m.user_id=(select auth.uid()) and o.type<>'STUDENT'
 ) then raise exception 'Business workspace already exists'; end if;
 if exists(select 1 from public.workspace_requests where user_id=(select auth.uid()) and status in ('pending_payment','pending_review')) then raise exception 'A pending request already exists'; end if;
 insert into public.workspace_requests(user_id,name,slug,type)
 values((select auth.uid()),trim(workspace_name),workspace_slug,workspace_type) returning * into created;
 return created;
end; $$;
revoke all on function private.create_workspace_request_impl(text,text,public.organization_type) from public,anon;
grant execute on function private.create_workspace_request_impl(text,text,public.organization_type) to authenticated;

grant select,insert,update,delete on public.student_courses,public.student_tasks,public.student_notes,public.student_schedule,public.student_documents to authenticated;
