-- The Account + Services launch replaces automatic commercial onboarding, and
-- Student Space now lives in madarorbit/madar-student. Preserve historical
-- functions for audit/migration history, but make every legacy entry point
-- unreachable from platform runtime roles.

revoke all on function public.complete_existing_customer_onboarding(
  text, text, text, text, integer, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.ensure_student_workspace()
from public, anon, authenticated, service_role;
revoke all on function public.sync_student_reminders(uuid)
from public, anon, authenticated, service_role;

revoke all on function private.create_student_organization_impl(
  text, text, public.organization_type
) from public, anon, authenticated, service_role;
revoke all on function private.ensure_student_workspace_impl()
from public, anon, authenticated, service_role;
revoke all on function private.is_student_organization_member(uuid)
from public, anon, authenticated, service_role;
revoke all on function private.sync_student_reminders_impl(uuid)
from public, anon, authenticated, service_role;
revoke all on function private.restore_v2_student_membership(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function private.bootstrap_v2_account(uuid, jsonb)
from public, anon, authenticated, service_role;

comment on function public.complete_existing_customer_onboarding(
  text, text, text, text, integer, text, text
) is 'Legacy account-to-workspace onboarding retained for history; runtime execution revoked by Account + Services launch.';
comment on function public.ensure_student_workspace()
is 'Legacy Student Space entry point retained for history; runtime moved to madarorbit/madar-student.';
