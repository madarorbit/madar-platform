begin;

create table if not exists public.mobile_push_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_key text not null unique,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
create index if not exists mobile_push_outbox_pending_idx on public.mobile_push_outbox(status, available_at, created_at) where status in ('pending','failed');

create or replace function private.queue_mobile_orby_completion_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare push_body text;
begin
  if new.status='completed' and old.status is distinct from new.status then
    push_body := left(coalesce(nullif(new.result->>'summary',''),nullif(new.result->>'message',''),'اكتملت المهمة الطويلة ويمكنك فتح مَدار لمراجعة النتيجة.'),500);
    insert into public.mobile_push_outbox(organization_id,source_key,title,body,data)
    values(new.organization_id,'orby-run:'||new.run_id::text,'اكتملت مهمة أوربي',push_body,jsonb_build_object('type','orby_execution_completed','runId',new.run_id,'screen','orby'))
    on conflict(source_key) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists orby_execution_queue_mobile_push on public.orby_execution_queue;
create trigger orby_execution_queue_mobile_push
after update of status on public.orby_execution_queue
for each row execute function private.queue_mobile_orby_completion_push();

alter table public.mobile_push_outbox enable row level security;
revoke all on public.mobile_push_outbox from anon, authenticated;

commit;
