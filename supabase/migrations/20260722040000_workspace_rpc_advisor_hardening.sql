alter function public.create_organization(text,text,public.organization_type) rename to create_student_organization_impl;
alter function public.create_student_organization_impl(text,text,public.organization_type) set schema private;
alter function public.create_workspace_request(text,text,public.organization_type) rename to create_workspace_request_impl;
alter function public.create_workspace_request_impl(text,text,public.organization_type) set schema private;
alter function public.submit_workspace_payment(uuid,text) rename to submit_workspace_payment_impl;
alter function public.submit_workspace_payment_impl(uuid,text) set schema private;
alter function public.review_workspace_request(uuid,text,text) rename to review_workspace_request_impl;
alter function public.review_workspace_request_impl(uuid,text,text) set schema private;

create function public.create_organization(workspace_name text,workspace_slug text,workspace_type public.organization_type)
returns public.organizations language sql security invoker set search_path='' as $$ select private.create_student_organization_impl(workspace_name,workspace_slug,workspace_type) $$;
create function public.create_workspace_request(workspace_name text,workspace_slug text,workspace_type public.organization_type)
returns public.workspace_requests language sql security invoker set search_path='' as $$ select private.create_workspace_request_impl(workspace_name,workspace_slug,workspace_type) $$;
create function public.submit_workspace_payment(target_request uuid,reference text)
returns public.workspace_requests language sql security invoker set search_path='' as $$ select private.submit_workspace_payment_impl(target_request,reference) $$;
create function public.review_workspace_request(target_request uuid,decision text,reason text default null)
returns public.workspace_requests language sql security invoker set search_path='' as $$ select private.review_workspace_request_impl(target_request,decision,reason) $$;

revoke all on function private.create_student_organization_impl(text,text,public.organization_type) from public,anon;
revoke all on function private.create_workspace_request_impl(text,text,public.organization_type) from public,anon;
revoke all on function private.submit_workspace_payment_impl(uuid,text) from public,anon;
revoke all on function private.review_workspace_request_impl(uuid,text,text) from public,anon;
grant execute on function private.create_student_organization_impl(text,text,public.organization_type) to authenticated;
grant execute on function private.create_workspace_request_impl(text,text,public.organization_type) to authenticated;
grant execute on function private.submit_workspace_payment_impl(uuid,text) to authenticated;
grant execute on function private.review_workspace_request_impl(uuid,text,text) to authenticated;

revoke all on function public.create_organization(text,text,public.organization_type) from public,anon;
revoke all on function public.create_workspace_request(text,text,public.organization_type) from public,anon;
revoke all on function public.submit_workspace_payment(uuid,text) from public,anon;
revoke all on function public.review_workspace_request(uuid,text,text) from public,anon;
grant execute on function public.create_organization(text,text,public.organization_type) to authenticated;
grant execute on function public.create_workspace_request(text,text,public.organization_type) to authenticated;
grant execute on function public.submit_workspace_payment(uuid,text) to authenticated;
grant execute on function public.review_workspace_request(uuid,text,text) to authenticated;

create index workspace_requests_organization_id_idx on public.workspace_requests(organization_id);
