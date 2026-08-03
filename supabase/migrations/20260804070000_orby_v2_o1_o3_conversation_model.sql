-- ORBY V2.0 O1-O3: additive conversation model and feedback surface.
-- Keeps V1 tables and RPCs compatible while adding V2 message states and data-policy controls.

alter table if exists public.orby_conversations
 add column if not exists channel text not null default 'web',
 add column if not exists kernel_session_id uuid,
 add column if not exists archived_at timestamptz,
 add column if not exists deleted_at timestamptz,
 add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.orby_messages
 add column if not exists status text not null default 'completed',
 add column if not exists content_parts jsonb not null default '[]'::jsonb,
 add column if not exists parent_message_id uuid references public.orby_messages(id) on delete set null,
 add column if not exists updated_at timestamptz not null default now();

do $$
begin
 if not exists(select 1 from pg_constraint where conname='orby_conversations_channel_check') then
  alter table public.orby_conversations add constraint orby_conversations_channel_check check(channel in ('web','mobile'));
 end if;
 if not exists(select 1 from pg_constraint where conname='orby_conversations_metadata_object_check') then
  alter table public.orby_conversations add constraint orby_conversations_metadata_object_check check(jsonb_typeof(metadata)='object');
 end if;
 if not exists(select 1 from pg_constraint where conname='orby_messages_status_check') then
  alter table public.orby_messages add constraint orby_messages_status_check check(status in ('sending','streaming','completed','failed','stopped'));
 end if;
 if not exists(select 1 from pg_constraint where conname='orby_messages_content_parts_array_check') then
  alter table public.orby_messages add constraint orby_messages_content_parts_array_check check(jsonb_typeof(content_parts)='array');
 end if;
end $$;

create index if not exists orby_conversations_user_status_last_idx on public.orby_conversations(organization_id,user_id,status,last_message_at desc);
create index if not exists orby_messages_parent_idx on public.orby_messages(parent_message_id) where parent_message_id is not null;
create index if not exists orby_messages_conversation_status_idx on public.orby_messages(conversation_id,status,created_at);

create table if not exists public.orby_message_feedback(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null references public.orby_conversations(id) on delete cascade,
 message_id uuid not null references public.orby_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 rating text not null check(rating in ('helpful','problem')),
 issue_type text,
 note text check(note is null or length(note)<=2000),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(message_id,user_id)
);
create index if not exists orby_message_feedback_org_created_idx on public.orby_message_feedback(organization_id,created_at desc);
create index if not exists orby_message_feedback_conversation_idx on public.orby_message_feedback(conversation_id,created_at desc);

alter table public.orby_message_feedback enable row level security;

drop policy if exists orby_message_feedback_user_select on public.orby_message_feedback;
create policy orby_message_feedback_user_select on public.orby_message_feedback for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists orby_message_feedback_user_insert on public.orby_message_feedback;
create policy orby_message_feedback_user_insert on public.orby_message_feedback for insert to authenticated with check(
 user_id=(select auth.uid()) and exists(select 1 from public.organization_members m where m.organization_id=orby_message_feedback.organization_id and m.user_id=(select auth.uid()))
);
drop policy if exists orby_message_feedback_user_update on public.orby_message_feedback;
create policy orby_message_feedback_user_update on public.orby_message_feedback for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists orby_message_feedback_user_delete on public.orby_message_feedback;
create policy orby_message_feedback_user_delete on public.orby_message_feedback for delete to authenticated using(user_id=(select auth.uid()));

grant select,insert,update,delete on public.orby_message_feedback to authenticated;
grant select,insert,update,delete on public.orby_message_feedback to service_role;
