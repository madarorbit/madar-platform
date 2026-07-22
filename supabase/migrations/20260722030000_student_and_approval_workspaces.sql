create type public.workspace_request_status as enum ('pending_payment','pending_review','approved','rejected');

create table public.workspace_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'),
 type public.organization_type not null check(type <> 'STUDENT'),
 status public.workspace_request_status not null default 'pending_payment',
 payment_reference text check(payment_reference is null or char_length(payment_reference) between 3 and 120),
 payment_submitted_at timestamptz,
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 rejection_reason text,
 organization_id uuid references public.organizations(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index workspace_requests_user_idx on public.workspace_requests(user_id,created_at desc);
create index workspace_requests_status_idx on public.workspace_requests(status,created_at desc);
create index workspace_requests_reviewed_by_idx on public.workspace_requests(reviewed_by);
create unique index workspace_requests_one_pending_user_idx on public.workspace_requests(user_id) where status in ('pending_payment','pending_review');
create trigger workspace_requests_updated before update on public.workspace_requests for each row execute function public.touch_updated_at();

create or replace function public.create_organization(workspace_name text, workspace_slug text, workspace_type public.organization_type)
returns public.organizations language plpgsql security definer set search_path='' as $$
declare created public.organizations;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if workspace_type <> 'STUDENT' then raise exception 'Paid workspaces require an approved request'; end if;
 if workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Invalid slug'; end if;
 if exists(select 1 from public.organization_members where user_id=(select auth.uid())) then raise exception 'Workspace already exists'; end if;
 insert into public.organizations(name,slug,type,created_by)
 values(trim(workspace_name),workspace_slug,workspace_type,(select auth.uid())) returning * into created;
 insert into public.organization_members(organization_id,user_id,role)
 values(created.id,(select auth.uid()),'OWNER');
 return created;
end; $$;

revoke all on function public.create_organization(text,text,public.organization_type) from public,anon;
grant execute on function public.create_organization(text,text,public.organization_type) to authenticated;

create or replace function public.create_workspace_request(workspace_name text,workspace_slug text,workspace_type public.organization_type)
returns public.workspace_requests language plpgsql security definer set search_path='' as $$
declare created public.workspace_requests;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if workspace_type='STUDENT' then raise exception 'Student workspace does not require payment'; end if;
 if workspace_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then raise exception 'Invalid slug'; end if;
 if exists(select 1 from public.organization_members where user_id=(select auth.uid())) then raise exception 'Workspace already exists'; end if;
 if exists(select 1 from public.workspace_requests where user_id=(select auth.uid()) and status in ('pending_payment','pending_review')) then raise exception 'A pending request already exists'; end if;
 insert into public.workspace_requests(user_id,name,slug,type)
 values((select auth.uid()),trim(workspace_name),workspace_slug,workspace_type) returning * into created;
 return created;
end; $$;

create or replace function public.submit_workspace_payment(target_request uuid,reference text)
returns public.workspace_requests language plpgsql security definer set search_path='' as $$
declare changed public.workspace_requests;
begin
 update public.workspace_requests set payment_reference=trim(reference),payment_submitted_at=now(),status='pending_review'
 where id=target_request and user_id=(select auth.uid()) and status='pending_payment' and char_length(trim(reference)) between 3 and 120
 returning * into changed;
 if changed.id is null then raise exception 'Request cannot be submitted'; end if;
 return changed;
end; $$;

create or replace function public.review_workspace_request(target_request uuid,decision text,reason text default null)
returns public.workspace_requests language plpgsql security definer set search_path='' as $$
declare request public.workspace_requests; created public.organizations;
begin
 if not (select private.is_admin()) then raise exception 'Admin required'; end if;
 select * into request from public.workspace_requests where id=target_request for update;
 if request.id is null or request.status <> 'pending_review' then raise exception 'Request is not reviewable'; end if;
 if decision='approve' then
   insert into public.organizations(name,slug,type,created_by) values(request.name,request.slug,request.type,request.user_id) returning * into created;
   insert into public.organization_members(organization_id,user_id,role) values(created.id,request.user_id,'OWNER');
   update public.workspace_requests set status='approved',reviewed_by=(select auth.uid()),reviewed_at=now(),organization_id=created.id,rejection_reason=null where id=request.id returning * into request;
 elsif decision='reject' then
   update public.workspace_requests set status='rejected',reviewed_by=(select auth.uid()),reviewed_at=now(),rejection_reason=nullif(trim(reason),'') where id=request.id returning * into request;
 else raise exception 'Invalid decision'; end if;
 return request;
end; $$;

revoke all on function public.create_workspace_request(text,text,public.organization_type) from public,anon;
revoke all on function public.submit_workspace_payment(uuid,text) from public,anon;
revoke all on function public.review_workspace_request(uuid,text,text) from public,anon;
grant execute on function public.create_workspace_request(text,text,public.organization_type) to authenticated;
grant execute on function public.submit_workspace_payment(uuid,text) to authenticated;
grant execute on function public.review_workspace_request(uuid,text,text) to authenticated;

alter table public.workspace_requests enable row level security;
create policy "request owner read" on public.workspace_requests for select to authenticated using(user_id=(select auth.uid()) or (select private.is_admin()));
revoke all on public.workspace_requests from anon,authenticated;
grant select on public.workspace_requests to authenticated;
grant all on public.workspace_requests to service_role;

create table public.student_courses (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 2 and 120),credits numeric(5,2) not null check(credits>0 and credits<=30),grade numeric(5,2) not null check(grade>=0 and grade<=100),semester text,created_at timestamptz not null default now()
);
create table public.student_tasks (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 240),due_at timestamptz,is_done boolean not null default false,created_at timestamptz not null default now()
);
create table public.student_notes (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 160),content text not null check(char_length(trim(content)) between 1 and 5000),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.student_schedule (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 160),weekday smallint not null check(weekday between 0 and 6),starts_at time not null,ends_at time not null check(ends_at>starts_at),location text,created_at timestamptz not null default now()
);
create table public.student_documents (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 2 and 160),subject text,storage_path text not null unique,original_filename text not null,file_size bigint not null check(file_size>0 and file_size<=20971520),created_at timestamptz not null default now()
);
create index student_courses_org_idx on public.student_courses(organization_id);
create index student_tasks_org_idx on public.student_tasks(organization_id,due_at);
create index student_notes_org_idx on public.student_notes(organization_id,updated_at desc);
create index student_schedule_org_idx on public.student_schedule(organization_id,weekday,starts_at);
create index student_documents_org_idx on public.student_documents(organization_id,created_at desc);
create trigger student_notes_updated before update on public.student_notes for each row execute function public.touch_updated_at();

create function private.is_student_organization_member(target_organization uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id where m.organization_id=target_organization and m.user_id=(select auth.uid()) and o.type='STUDENT' and o.status='active')
$$;
revoke all on function private.is_student_organization_member(uuid) from public,anon;
grant execute on function private.is_student_organization_member(uuid) to authenticated;

alter table public.student_courses enable row level security;alter table public.student_tasks enable row level security;alter table public.student_notes enable row level security;alter table public.student_schedule enable row level security;alter table public.student_documents enable row level security;
do $$ declare table_name text; begin foreach table_name in array array['student_courses','student_tasks','student_notes','student_schedule','student_documents'] loop
 execute format('create policy "student member access" on public.%I for all to authenticated using((select private.is_student_organization_member(organization_id))) with check((select private.is_student_organization_member(organization_id)))',table_name);
 execute format('revoke all on public.%I from anon,authenticated',table_name);
 execute format('grant select,insert,update,delete on public.%I to authenticated',table_name);
 execute format('grant all on public.%I to service_role',table_name);
 end loop; end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('student-library','student-library',false,20971520,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "student library member read" on storage.objects for select to authenticated using(bucket_id='student-library' and (select private.is_student_organization_member(((storage.foldername(name))[1])::uuid)));
create policy "student library member insert" on storage.objects for insert to authenticated with check(bucket_id='student-library' and (select private.is_student_organization_member(((storage.foldername(name))[1])::uuid)));
create policy "student library member delete" on storage.objects for delete to authenticated using(bucket_id='student-library' and (select private.is_student_organization_member(((storage.foldername(name))[1])::uuid)));
