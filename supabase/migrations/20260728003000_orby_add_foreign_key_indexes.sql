-- Cover ORBY foreign keys used by cascades, ownership checks and audit lookups.

create index if not exists orby_runtime_config_organization_idx on public.orby_runtime_config (organization_id);
create index if not exists orby_runtime_config_created_by_idx on public.orby_runtime_config (created_by);
create index if not exists orby_runtime_config_updated_by_idx on public.orby_runtime_config (updated_by);
create index if not exists orby_sessions_user_idx on public.orby_sessions (user_id);
create index if not exists orby_model_registry_created_by_idx on public.orby_model_registry (created_by);
create index if not exists orby_model_registry_updated_by_idx on public.orby_model_registry (updated_by);
