alter policy "organization member read"
on public.organizations
using (private.is_admin() or private.is_organization_member(id));

alter policy "organization member list"
on public.organization_members
using (private.is_admin() or private.is_organization_member(organization_id));

alter policy "members read subscriptions"
on public.workspace_subscriptions
using (private.is_admin() or private.is_organization_member(organization_id));

notify pgrst, 'reload schema';
