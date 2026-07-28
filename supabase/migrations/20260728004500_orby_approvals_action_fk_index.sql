-- Cover the ORBY approval action foreign key for all approval states.
-- The existing pending-only unique index enforces one pending approval, but it does not cover approved, rejected or expired rows.

create index if not exists orby_approvals_action_idx
 on public.orby_approvals(action_id)
 where action_id is not null;
