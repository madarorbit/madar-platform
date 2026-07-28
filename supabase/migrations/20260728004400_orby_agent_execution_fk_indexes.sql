-- Cover ORBY Stage 2 foreign keys used by user-scoped budget cleanup and audit lookups.

create index if not exists orby_execution_usage_user_idx
 on public.orby_execution_usage(user_id,bucket_start desc);
