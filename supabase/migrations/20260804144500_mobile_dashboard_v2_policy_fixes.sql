begin;

drop policy if exists mobile_v2_settings_authenticated_read on public.mobile_v2_settings;
create policy mobile_v2_settings_authenticated_read on public.mobile_v2_settings
for select to authenticated using (true);

drop policy if exists mobile_orby_attachments_owner_update on public.mobile_orby_attachments;
create policy mobile_orby_attachments_owner_update on public.mobile_orby_attachments
for update to authenticated
using (user_id=(select auth.uid()) and private.is_organization_member(organization_id))
with check (user_id=(select auth.uid()) and private.is_organization_member(organization_id));

grant update on public.mobile_orby_attachments to authenticated;

commit;
