-- ORBY Stage 3 tenant isolation and privilege hardening.
-- Browser roles receive only the minimum read/write surfaces; processing, raw text, embeddings, events and queues remain service-role only.

drop policy if exists orby_memory_policies_select on public.orby_memory_policies;
drop policy if exists orby_memory_policies_manage on public.orby_memory_policies;
create policy orby_memory_policies_select on public.orby_memory_policies for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_memory_policies.organization_id and m.user_id=(select auth.uid()))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);
create policy orby_memory_policies_manage on public.orby_memory_policies for all to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_memory_policies.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
) with check (
 exists(select 1 from public.organization_members m where m.organization_id=orby_memory_policies.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);

drop policy if exists orby_memories_user_select on public.orby_memories;
create policy orby_memories_user_select on public.orby_memories for select to authenticated using (
 (user_id=(select auth.uid()) and exists(select 1 from public.organization_members m where m.organization_id=orby_memories.organization_id and m.user_id=(select auth.uid())))
 or (user_id is null and exists(select 1 from public.organization_members m where m.organization_id=orby_memories.organization_id and m.user_id=(select auth.uid())))
);

drop policy if exists orby_user_preferences_own on public.orby_user_preferences;
create policy orby_user_preferences_own on public.orby_user_preferences for all to authenticated using (
 user_id=(select auth.uid())
) with check (
 user_id=(select auth.uid()) and exists(select 1 from public.organization_members m where m.organization_id=orby_user_preferences.organization_id and m.user_id=(select auth.uid()))
);

drop policy if exists orby_knowledge_sources_select on public.orby_knowledge_sources;
create policy orby_knowledge_sources_select on public.orby_knowledge_sources for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_knowledge_sources.organization_id and m.user_id=(select auth.uid()))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);

drop policy if exists orby_intelligence_schedules_select on public.orby_intelligence_schedules;
create policy orby_intelligence_schedules_select on public.orby_intelligence_schedules for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_intelligence_schedules.organization_id and m.user_id=(select auth.uid()) and m.role in ('OWNER','ADMIN'))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);

drop policy if exists orby_insights_select on public.orby_insights;
create policy orby_insights_select on public.orby_insights for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_insights.organization_id and m.user_id=(select auth.uid()))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);

drop policy if exists orby_notification_preferences_own on public.orby_notification_preferences;
create policy orby_notification_preferences_own on public.orby_notification_preferences for all to authenticated using (
 user_id=(select auth.uid())
) with check (
 user_id=(select auth.uid()) and exists(select 1 from public.organization_members m where m.organization_id=orby_notification_preferences.organization_id and m.user_id=(select auth.uid()))
);

drop policy if exists orby_proactive_notifications_user_select on public.orby_proactive_notifications;
create policy orby_proactive_notifications_user_select on public.orby_proactive_notifications for select to authenticated using (
 user_id=(select auth.uid()) and exists(select 1 from public.organization_members m where m.organization_id=orby_proactive_notifications.organization_id and m.user_id=(select auth.uid()))
);

drop policy if exists orby_periodic_reports_select on public.orby_periodic_reports;
create policy orby_periodic_reports_select on public.orby_periodic_reports for select to authenticated using (
 exists(select 1 from public.organization_members m where m.organization_id=orby_periodic_reports.organization_id and m.user_id=(select auth.uid()))
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='SUPER_ADMIN')
);

drop policy if exists orby_memory_policies_service on public.orby_memory_policies;
drop policy if exists orby_memories_service on public.orby_memories;
drop policy if exists orby_user_preferences_service on public.orby_user_preferences;
drop policy if exists orby_knowledge_sources_service on public.orby_knowledge_sources;
drop policy if exists orby_knowledge_documents_service on public.orby_knowledge_documents;
drop policy if exists orby_knowledge_chunks_service on public.orby_knowledge_chunks;
drop policy if exists orby_knowledge_embeddings_service on public.orby_knowledge_embeddings;
drop policy if exists orby_intelligence_events_service on public.orby_intelligence_events;
drop policy if exists orby_intelligence_jobs_service on public.orby_intelligence_jobs;
drop policy if exists orby_intelligence_schedules_service on public.orby_intelligence_schedules;
drop policy if exists orby_insights_service on public.orby_insights;
drop policy if exists orby_notification_preferences_service on public.orby_notification_preferences;
drop policy if exists orby_proactive_notifications_service on public.orby_proactive_notifications;
drop policy if exists orby_periodic_reports_service on public.orby_periodic_reports;

create policy orby_memory_policies_service on public.orby_memory_policies for all to service_role using (true) with check (true);
create policy orby_memories_service on public.orby_memories for all to service_role using (true) with check (true);
create policy orby_user_preferences_service on public.orby_user_preferences for all to service_role using (true) with check (true);
create policy orby_knowledge_sources_service on public.orby_knowledge_sources for all to service_role using (true) with check (true);
create policy orby_knowledge_documents_service on public.orby_knowledge_documents for all to service_role using (true) with check (true);
create policy orby_knowledge_chunks_service on public.orby_knowledge_chunks for all to service_role using (true) with check (true);
create policy orby_knowledge_embeddings_service on public.orby_knowledge_embeddings for all to service_role using (true) with check (true);
create policy orby_intelligence_events_service on public.orby_intelligence_events for all to service_role using (true) with check (true);
create policy orby_intelligence_jobs_service on public.orby_intelligence_jobs for all to service_role using (true) with check (true);
create policy orby_intelligence_schedules_service on public.orby_intelligence_schedules for all to service_role using (true) with check (true);
create policy orby_insights_service on public.orby_insights for all to service_role using (true) with check (true);
create policy orby_notification_preferences_service on public.orby_notification_preferences for all to service_role using (true) with check (true);
create policy orby_proactive_notifications_service on public.orby_proactive_notifications for all to service_role using (true) with check (true);
create policy orby_periodic_reports_service on public.orby_periodic_reports for all to service_role using (true) with check (true);

revoke all privileges on table
 public.orby_memory_policies,public.orby_memories,public.orby_user_preferences,public.orby_knowledge_sources,
 public.orby_knowledge_documents,public.orby_knowledge_chunks,public.orby_knowledge_embeddings,public.orby_intelligence_events,
 public.orby_intelligence_jobs,public.orby_intelligence_schedules,public.orby_insights,public.orby_notification_preferences,
 public.orby_proactive_notifications,public.orby_periodic_reports
from anon,authenticated;

grant select,insert,update,delete on table public.orby_memory_policies to authenticated;
grant select on table public.orby_memories,public.orby_knowledge_sources,public.orby_intelligence_schedules,public.orby_insights,public.orby_proactive_notifications,public.orby_periodic_reports to authenticated;
grant select,insert,update,delete on table public.orby_user_preferences,public.orby_notification_preferences to authenticated;

grant select,insert,update,delete on table
 public.orby_memory_policies,public.orby_memories,public.orby_user_preferences,public.orby_knowledge_sources,
 public.orby_knowledge_documents,public.orby_knowledge_chunks,public.orby_knowledge_embeddings,public.orby_intelligence_events,
 public.orby_intelligence_jobs,public.orby_intelligence_schedules,public.orby_insights,public.orby_notification_preferences,
 public.orby_proactive_notifications,public.orby_periodic_reports
to service_role;
