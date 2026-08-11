-- Keep every user upload under its authenticated account folder and remove
-- obsolete policy predicates that can abort otherwise valid Storage requests.

drop policy if exists "founder reads career cvs" on storage.objects;
create policy "founder reads career cvs"
on storage.objects for select to authenticated
using (
  bucket_id = 'career-cvs'
  and (select private.is_super_admin())
);

drop policy if exists "founder deletes career cvs" on storage.objects;
create policy "founder deletes career cvs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'career-cvs'
  and (select private.is_super_admin())
);

-- Student Space no longer runs in MADAR Platform. Keeping these policies would
-- evaluate a deliberately revoked Student helper during unrelated uploads.
drop policy if exists "student library member read" on storage.objects;
drop policy if exists "student library member insert" on storage.objects;
drop policy if exists "student library member delete" on storage.objects;

-- Failed service-payment submissions can safely clean up only their own proof.
drop policy if exists "payment proof owner delete" on storage.objects;
create policy "payment proof owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
