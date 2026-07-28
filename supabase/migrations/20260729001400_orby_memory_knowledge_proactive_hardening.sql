-- ORBY Stage 3 production hardening.
-- Supabase may grant broad default table privileges to service_role; constrain Stage 3 tables to CRUD only.

revoke all privileges on table
 public.orby_memory_policies,public.orby_memories,public.orby_user_preferences,public.orby_knowledge_sources,
 public.orby_knowledge_documents,public.orby_knowledge_chunks,public.orby_knowledge_embeddings,public.orby_intelligence_events,
 public.orby_intelligence_jobs,public.orby_intelligence_schedules,public.orby_proactive_insights,public.orby_notification_preferences,
 public.orby_proactive_notifications,public.orby_periodic_reports
from service_role;

grant select,insert,update,delete on table
 public.orby_memory_policies,public.orby_memories,public.orby_user_preferences,public.orby_knowledge_sources,
 public.orby_knowledge_documents,public.orby_knowledge_chunks,public.orby_knowledge_embeddings,public.orby_intelligence_events,
 public.orby_intelligence_jobs,public.orby_intelligence_schedules,public.orby_proactive_insights,public.orby_notification_preferences,
 public.orby_proactive_notifications,public.orby_periodic_reports
to service_role;

create index if not exists orby_memory_policies_created_by_idx
 on public.orby_memory_policies(created_by) where created_by is not null;
create index if not exists orby_memory_policies_updated_by_idx
 on public.orby_memory_policies(updated_by) where updated_by is not null;
create index if not exists orby_proactive_notifications_org_idx
 on public.orby_proactive_notifications(organization_id,created_at desc);
