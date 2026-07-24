-- Public API wrappers delegate to protected private implementations.
-- They must execute as their owner; every private implementation performs auth/authorization checks.
alter function public.adjust_inventory(uuid,numeric,text) security definer;
alter function public.business_analytics(uuid,date,date) security definer;
alter function public.commit_business_import(uuid,jsonb) security definer;
alter function public.create_customer_order(jsonb,text,text,text) security definer;
alter function public.create_organization(text,text,public.organization_type) security definer;
alter function public.create_workspace_request(text,text,public.organization_type) security definer;
alter function public.ensure_student_workspace() security definer;
alter function public.list_organization_members(uuid) security definer;
alter function public.manage_organization_member(uuid,text,public.organization_role,text) security definer;
alter function public.record_business_sale(uuid,uuid,jsonb,numeric,text,text) security definer;
alter function public.review_order_payment(uuid,boolean,text) security definer;
alter function public.review_workspace_request(uuid,text,text) security definer;
alter function public.rollback_business_import(uuid) security definer;
alter function public.submit_order_payment(uuid,text) security definer;
alter function public.submit_workspace_payment(uuid,text) security definer;
alter function public.sync_student_reminders(uuid) security definer;
alter function public.update_order_fulfillment(uuid,public.order_status,text) security definer;
