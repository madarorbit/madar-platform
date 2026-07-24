create index if not exists platform_settings_updated_by_idx on public.platform_settings(updated_by);
create index if not exists workspace_requests_beta_slot_idx on public.workspace_requests(beta_slot_ordinal) where beta_slot_ordinal is not null;
