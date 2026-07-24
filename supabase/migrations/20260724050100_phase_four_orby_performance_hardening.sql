create index if not exists orby_action_drafts_org_idx on public.orby_action_drafts(organization_id);
create index if not exists orby_conversations_org_idx on public.orby_conversations(organization_id);
create index if not exists orby_messages_user_idx on public.orby_messages(user_id);
create index if not exists orby_usage_daily_user_idx on public.orby_usage_daily(user_id,usage_date desc);
