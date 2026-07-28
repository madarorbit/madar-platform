-- Keep ORBY browser-facing roles limited to the four required DML privileges.
-- Supabase default table privileges may otherwise include TRUNCATE, TRIGGER and REFERENCES.

revoke all privileges on table
 public.orby_runtime_config,
 public.orby_sessions,
 public.orby_session_messages,
 public.orby_model_registry,
 public.orby_provider_health
from authenticated;

revoke all privileges on table
 public.orby_runtime_config,
 public.orby_sessions,
 public.orby_session_messages,
 public.orby_model_registry,
 public.orby_provider_health
from anon;

grant select,insert,update,delete on table
 public.orby_runtime_config,
 public.orby_sessions,
 public.orby_session_messages,
 public.orby_model_registry,
 public.orby_provider_health
to authenticated;
