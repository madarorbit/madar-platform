-- Ensure the backup dry-run response aggregates snapshot section names safely.
create or replace function public.orby_os_restore_backup(target_backup uuid,dry_run boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare record public.orby_backups;computed text;sections jsonb;
begin
 if not private.is_admin() then perform private.raise_forbidden(); end if;
 select * into record from public.orby_backups where id=target_backup;
 if record.id is null or record.status not in ('ready','restored') then raise exception 'Backup unavailable' using errcode='P0002'; end if;
 computed:=encode(extensions.digest(record.snapshot::text,'sha256'),'hex');
 if computed<>record.checksum then raise exception 'Backup checksum mismatch' using errcode='P0001'; end if;
 select coalesce(jsonb_agg(key),'[]'::jsonb) into sections from jsonb_object_keys(record.snapshot) as key;
 if dry_run then return jsonb_build_object('valid',true,'dry_run',true,'backup_id',record.id,'organization_id',record.organization_id,'sections',sections); end if;
 update public.orby_backups set status='restored',restored_at=now() where id=record.id;
 return jsonb_build_object('valid',true,'dry_run',false,'backup_id',record.id,'status','restored','message','Snapshot validated. Configuration writes require explicit section-level approval.');
end $$;
revoke all on function public.orby_os_restore_backup(uuid,boolean) from public,anon,authenticated;
grant execute on function public.orby_os_restore_backup(uuid,boolean) to authenticated,service_role;
