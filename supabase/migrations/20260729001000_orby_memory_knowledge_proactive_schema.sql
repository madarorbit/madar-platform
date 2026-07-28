-- ORBY Initial Architecture & Build Roadmap — Stage 3
-- Memory, Knowledge & Proactive Intelligence. This remains a subordinate reference inside MADAR Integration Master Roadmap.
-- Additive over ORBY Kernel, Agent Execution Layer, Integration Gateway, UDM, Notification Center and Event Infrastructure.

create extension if not exists pgcrypto;
create extension if not exists vector with schema extensions;

create table if not exists public.orby_memory_policies (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null unique references public.organizations(id) on delete cascade,
 enabled boolean not null default false,
 policy jsonb not null default '{}'::jsonb,
 revision integer not null default 1 check (revision > 0),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(policy)='object')
);

create table if not exists public.orby_memories (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 workspace_id uuid,
 session_id uuid references public.orby_sessions(id) on delete cascade,
 kind text not null check (kind in ('conversation_summary','short_term','long_term','preference','workspace')),
 memory_key text not null,
 content text not null check (char_length(content) between 1 and 100000),
 summary text,
 source text not null check (source in ('conversation','user','workspace','system','import')),
 sensitivity text not null default 'internal' check (sensitivity in ('public','internal','sensitive','restricted')),
 confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
 importance numeric(5,4) not null default .5 check (importance between 0 and 1),
 metadata jsonb not null default '{}'::jsonb,
 last_accessed_at timestamptz,
 expires_at timestamptz,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(metadata)='object')
);
create unique index if not exists orby_memories_scope_key_uidx on public.orby_memories(organization_id,memory_key) where deleted_at is null;
create index if not exists orby_memories_retrieval_idx on public.orby_memories(organization_id,workspace_id,user_id,kind,importance desc,updated_at desc) where deleted_at is null;
create index if not exists orby_memories_session_idx on public.orby_memories(session_id,kind,updated_at desc) where session_id is not null and deleted_at is null;
create index if not exists orby_memories_expiry_idx on public.orby_memories(expires_at) where expires_at is not null and deleted_at is null;
create index if not exists orby_memories_user_idx on public.orby_memories(user_id) where user_id is not null;
create index if not exists orby_memories_workspace_idx on public.orby_memories(workspace_id) where workspace_id is not null;

create table if not exists public.orby_user_preferences (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid,
 workspace_scope uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
 preferences jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,user_id,workspace_scope),
 check (workspace_scope=coalesce(workspace_id,'00000000-0000-0000-0000-000000000000'::uuid)),
 check (jsonb_typeof(preferences)='object')
);
create index if not exists orby_user_preferences_user_idx on public.orby_user_preferences(user_id,organization_id);

create table if not exists public.orby_knowledge_sources (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 name text not null check (char_length(name) between 1 and 240),
 source_type text not null check (source_type in ('upload','workspace_file','integration','manual','url','database')),
 status text not null default 'pending' check (status in ('pending','processing','ready','failed','archived')),
 citation_label text not null check (char_length(citation_label) between 1 and 240),
 trust_level text not null default 'internal' check (trust_level in ('verified','internal','unverified')),
 metadata jsonb not null default '{}'::jsonb,
 version integer not null default 1 check (version>0),
 created_by uuid references auth.users(id) on delete set null,
 last_indexed_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(metadata)='object')
);
create index if not exists orby_knowledge_sources_org_idx on public.orby_knowledge_sources(organization_id,status,updated_at desc);
create index if not exists orby_knowledge_sources_workspace_idx on public.orby_knowledge_sources(workspace_id) where workspace_id is not null;
create index if not exists orby_knowledge_sources_created_by_idx on public.orby_knowledge_sources(created_by) where created_by is not null;

create table if not exists public.orby_knowledge_documents (
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.orby_knowledge_sources(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 external_id text,
 title text not null check (char_length(title) between 1 and 500),
 mime_type text not null,
 checksum text not null,
 language text,
 status text not null default 'pending' check (status in ('pending','extracting','chunking','embedding','ready','failed','archived')),
 metadata jsonb not null default '{}'::jsonb,
 version integer not null default 1 check (version>0),
 raw_text text,
 extracted_at timestamptz,
 indexed_at timestamptz,
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(metadata)='object')
);
create unique index if not exists orby_knowledge_documents_checksum_uidx on public.orby_knowledge_documents(source_id,checksum,version);
create index if not exists orby_knowledge_documents_source_idx on public.orby_knowledge_documents(source_id,status,updated_at desc);
create index if not exists orby_knowledge_documents_org_idx on public.orby_knowledge_documents(organization_id,status,updated_at desc);
create index if not exists orby_knowledge_documents_workspace_idx on public.orby_knowledge_documents(workspace_id) where workspace_id is not null;

create table if not exists public.orby_knowledge_chunks (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.orby_knowledge_documents(id) on delete cascade,
 source_id uuid not null references public.orby_knowledge_sources(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 ordinal integer not null check (ordinal>=0),
 content text not null check (char_length(content) between 1 and 20000),
 token_estimate integer not null check (token_estimate>0),
 checksum text not null,
 heading text,
 metadata jsonb not null default '{}'::jsonb,
 embedding_model text,
 embedding_dimensions integer,
 created_at timestamptz not null default now(),
 unique(document_id,ordinal),
 check (jsonb_typeof(metadata)='object')
);
create index if not exists orby_knowledge_chunks_source_idx on public.orby_knowledge_chunks(source_id,document_id,ordinal);
create index if not exists orby_knowledge_chunks_org_idx on public.orby_knowledge_chunks(organization_id,workspace_id,created_at desc);
create index if not exists orby_knowledge_chunks_document_idx on public.orby_knowledge_chunks(document_id);

create table if not exists public.orby_knowledge_embeddings (
 chunk_id uuid primary key references public.orby_knowledge_chunks(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 embedding extensions.vector not null,
 dimensions integer not null check (dimensions>0),
 model text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists orby_knowledge_embeddings_org_dim_idx on public.orby_knowledge_embeddings(organization_id,dimensions);
create index if not exists orby_knowledge_embeddings_org_idx on public.orby_knowledge_embeddings(organization_id);

create table if not exists public.orby_intelligence_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 event_type text not null,
 priority integer not null default 100,
 payload jsonb not null default '{}'::jsonb,
 deduplication_key text,
 occurred_at timestamptz not null default now(),
 available_at timestamptz not null default now(),
 processed_at timestamptz,
 check (jsonb_typeof(payload)='object')
);
create unique index if not exists orby_intelligence_events_dedup_uidx on public.orby_intelligence_events(organization_id,deduplication_key) where deduplication_key is not null;
create index if not exists orby_intelligence_events_due_idx on public.orby_intelligence_events(processed_at,available_at,priority,occurred_at) where processed_at is null;
create index if not exists orby_intelligence_events_org_idx on public.orby_intelligence_events(organization_id,occurred_at desc);

create table if not exists public.orby_intelligence_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 job_type text not null check (job_type in ('knowledge.extract','knowledge.embed','memory.summarize','detector.run','report.generate','notification.deliver','retention.cleanup')),
 status text not null default 'queued' check (status in ('queued','running','retry','succeeded','dead','cancelled')),
 payload jsonb not null default '{}'::jsonb,
 priority integer not null default 100,
 available_at timestamptz not null default now(),
 attempts integer not null default 0 check (attempts>=0),
 max_attempts integer not null default 6 check (max_attempts between 1 and 20),
 idempotency_key text,
 locked_by text,
 lease_expires_at timestamptz,
 result jsonb not null default '{}'::jsonb,
 last_error_code text,
 last_error_message text,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(payload)='object'),
 check (jsonb_typeof(result)='object')
);
create unique index if not exists orby_intelligence_jobs_idempotency_uidx on public.orby_intelligence_jobs(organization_id,idempotency_key) where idempotency_key is not null;
create index if not exists orby_intelligence_jobs_claim_idx on public.orby_intelligence_jobs(status,available_at,priority,created_at) where status in ('queued','retry');
create index if not exists orby_intelligence_jobs_org_idx on public.orby_intelligence_jobs(organization_id,created_at desc);

create table if not exists public.orby_intelligence_schedules (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 job_type text not null check (job_type in ('knowledge.extract','knowledge.embed','memory.summarize','detector.run','report.generate','notification.deliver','retention.cleanup')),
 cron_expression text,
 interval_seconds integer check (interval_seconds is null or interval_seconds>=3600),
 payload jsonb not null default '{}'::jsonb,
 enabled boolean not null default false,
 timezone text not null default 'Asia/Aden',
 next_run_at timestamptz not null,
 last_run_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (interval_seconds is not null or cron_expression is not null),
 check (jsonb_typeof(payload)='object')
);
create index if not exists orby_intelligence_schedules_due_idx on public.orby_intelligence_schedules(enabled,next_run_at) where enabled;
create index if not exists orby_intelligence_schedules_org_idx on public.orby_intelligence_schedules(organization_id,updated_at desc);
create index if not exists orby_intelligence_schedules_created_by_idx on public.orby_intelligence_schedules(created_by) where created_by is not null;

create table if not exists public.orby_proactive_insights (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 detector text not null check (detector in ('sales_drop','revenue','customer_churn','inventory','payment','support','traffic','system_health')),
 fingerprint text not null,
 status text not null default 'open' check (status in ('open','acknowledged','dismissed','resolved')),
 title text not null,
 description text not null,
 category text not null check (category in ('anomaly','opportunity','risk','trend')),
 severity text not null check (severity in ('info','low','medium','high','critical')),
 confidence numeric(5,4) not null check (confidence between 0 and 1),
 risk_score integer not null default 0 check (risk_score between 0 and 100),
 opportunity_score integer not null default 0 check (opportunity_score between 0 and 100),
 metrics jsonb not null default '{}'::jsonb,
 evidence jsonb not null default '[]'::jsonb,
 root_causes jsonb not null default '[]'::jsonb,
 recommendations jsonb not null default '[]'::jsonb,
 suggested_actions jsonb not null default '[]'::jsonb,
 draft_workflow jsonb,
 cooldown_until timestamptz,
 first_detected_at timestamptz not null,
 last_detected_at timestamptz not null,
 occurrences integer not null default 1 check (occurrences>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(metrics)='object'),
 check (jsonb_typeof(evidence)='array'),
 check (jsonb_typeof(root_causes)='array'),
 check (jsonb_typeof(recommendations)='array'),
 check (jsonb_typeof(suggested_actions)='array'),
 check (draft_workflow is null or jsonb_typeof(draft_workflow)='object')
);
create unique index if not exists orby_proactive_insights_fingerprint_uidx on public.orby_proactive_insights(organization_id,fingerprint);
create index if not exists orby_proactive_insights_org_status_idx on public.orby_proactive_insights(organization_id,status,severity,last_detected_at desc);
create index if not exists orby_proactive_insights_workspace_idx on public.orby_proactive_insights(workspace_id,last_detected_at desc) where workspace_id is not null;

create table if not exists public.orby_notification_preferences (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid,
 workspace_scope uuid not null default '00000000-0000-0000-0000-000000000000'::uuid,
 enabled boolean not null default true,
 channels jsonb not null default '["in_app"]'::jsonb,
 minimum_severity text not null default 'medium' check (minimum_severity in ('info','low','medium','high','critical')),
 quiet_hours jsonb,
 digest_mode text not null default 'immediate' check (digest_mode in ('immediate','daily','weekly')),
 detector_settings jsonb not null default '{}'::jsonb,
 cooldown_minutes integer not null default 180 check (cooldown_minutes between 0 and 43200),
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,user_id,workspace_scope),
 check (workspace_scope=coalesce(workspace_id,'00000000-0000-0000-0000-000000000000'::uuid)),
 check (jsonb_typeof(channels)='array'),
 check (quiet_hours is null or jsonb_typeof(quiet_hours)='object'),
 check (jsonb_typeof(detector_settings)='object'),
 check (jsonb_typeof(metadata)='object')
);
create index if not exists orby_notification_preferences_user_idx on public.orby_notification_preferences(user_id,organization_id);

create table if not exists public.orby_proactive_notifications (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 workspace_id uuid,
 insight_id uuid references public.orby_proactive_insights(id) on delete cascade,
 channel text not null check (channel in ('in_app','email','push','webhook')),
 title text not null,
 body text not null,
 severity text not null check (severity in ('info','low','medium','high','critical')),
 status text not null default 'queued' check (status in ('queued','sent','failed','suppressed')),
 deduplication_key text not null unique,
 available_at timestamptz not null default now(),
 sent_at timestamptz,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 check (jsonb_typeof(metadata)='object')
);
create index if not exists orby_proactive_notifications_delivery_idx on public.orby_proactive_notifications(status,available_at,channel) where status='queued';
create index if not exists orby_proactive_notifications_user_idx on public.orby_proactive_notifications(user_id,created_at desc) where user_id is not null;
create index if not exists orby_proactive_notifications_insight_idx on public.orby_proactive_notifications(insight_id,created_at desc) where insight_id is not null;

create table if not exists public.orby_periodic_reports (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 workspace_id uuid,
 report_type text not null check (report_type in ('daily','weekly','monthly','executive','workspace')),
 period_start timestamptz not null,
 period_end timestamptz not null,
 title text not null,
 summary text not null,
 sections jsonb not null default '[]'::jsonb,
 citations jsonb not null default '[]'::jsonb,
 status text not null default 'draft' check (status in ('draft','ready','delivered','failed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (period_end>=period_start),
 check (jsonb_typeof(sections)='array'),
 check (jsonb_typeof(citations)='array')
);
create index if not exists orby_periodic_reports_org_idx on public.orby_periodic_reports(organization_id,report_type,period_end desc);
create index if not exists orby_periodic_reports_workspace_idx on public.orby_periodic_reports(workspace_id,period_end desc) where workspace_id is not null;

alter table public.orby_memory_policies enable row level security;
alter table public.orby_memories enable row level security;
alter table public.orby_user_preferences enable row level security;
alter table public.orby_knowledge_sources enable row level security;
alter table public.orby_knowledge_documents enable row level security;
alter table public.orby_knowledge_chunks enable row level security;
alter table public.orby_knowledge_embeddings enable row level security;
alter table public.orby_intelligence_events enable row level security;
alter table public.orby_intelligence_jobs enable row level security;
alter table public.orby_intelligence_schedules enable row level security;
alter table public.orby_proactive_insights enable row level security;
alter table public.orby_notification_preferences enable row level security;
alter table public.orby_proactive_notifications enable row level security;
alter table public.orby_periodic_reports enable row level security;