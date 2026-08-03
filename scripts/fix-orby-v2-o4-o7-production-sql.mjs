import {readFile,writeFile} from 'node:fs/promises';

const path='supabase/migrations/20260804110000_orby_v2_o4_o7_completion.sql';
let source=await readFile(path,'utf8');

source=source.replace(
  'connector_id uuid references public.integration_connectors(id) on delete set null,',
  'connector_id text references public.integration_connectors(connector_key) on delete set null,',
);
if(source.includes('integration_connectors(id)'))throw new Error('ORBY_O4_CONNECTOR_REFERENCE_NOT_PATCHED');

source=source.replace(
  /(^|\n)(?!drop policy if exists ([a-z0-9_]+) on public\.([a-z0-9_]+);\n)create policy ([a-z0-9_]+) on public\.([a-z0-9_]+)/g,
  (match,prefix,_oldName,_oldTable,name,table)=>`${prefix}drop policy if exists ${name} on public.${table};\ncreate policy ${name} on public.${table}`,
);

for(const name of [
 'orby_vertical_installations_members_read','orby_source_of_truth_members_read','orby_cross_device_owner_rw',
 'orby_data_governance_owner_read','orby_data_governance_owner_create','orby_channel_registry_authenticated_read',
 'orby_vertical_installations_service','orby_source_of_truth_service','orby_cross_device_service',
 'orby_admin_control_versions_service','orby_release_gate_runs_service','orby_data_governance_service',
 'orby_backup_manifests_service','orby_channel_registry_service',
]){
 if(!source.includes(`drop policy if exists ${name} on public.`))throw new Error(`ORBY_O4_POLICY_NOT_IDEMPOTENT:${name}`);
}

await writeFile(path,source,'utf8');
console.log('Patched ORBY V2 O4-O7 connector contract and idempotent policies.');
