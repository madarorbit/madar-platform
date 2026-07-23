import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20260724030000_phase_four_onboarding_import.sql','utf8');
const helpers=fs.readFileSync('supabase/migrations/20260724030100_phase_four_import_rls_helper_grants.sql','utf8');
const csv=fs.readFileSync('src/lib/csv.ts','utf8');
const actions=fs.readFileSync('app/actions/imports.ts','utf8');
const detail=fs.readFileSync('app/workspace/imports/[id]/page.tsx','utf8');

test('imports are tenant-scoped, bounded and not writable anonymously',()=>{
 assert.match(migration,/create table public\.business_imports/);
 assert.match(migration,/jsonb_array_length\(rows\) between 1 and 500/);
 assert.match(migration,/alter table public\.business_imports enable row level security/);
 assert.match(migration,/private\.is_organization_member\(organization_id\)/);
 assert.match(migration,/private\.can_manage_business\(organization_id,private\.import_capability\(entity_type\)\)/);
 assert.match(migration,/revoke all on table public\.business_imports from anon,authenticated/);
 assert.match(migration,/grant select,insert on table public\.business_imports to authenticated/);
 assert.doesNotMatch(migration,/grant [^;]+business_imports[^;]+ to anon/);
});

test('commit validates capability and imports all rows in one database function',()=>{
 assert.match(migration,/private\.commit_business_import_impl/);
 assert.match(migration,/where id=target_import for update/);
 assert.match(migration,/jsonb_array_elements\(import_record\.rows\)/);
 assert.match(migration,/MISSING_PRODUCT_NAME_AT_ROW/);
 assert.match(migration,/MISSING_CUSTOMER_NAME_AT_ROW/);
 assert.match(migration,/INVALID_EXPENSE_AMOUNT_AT_ROW/);
 assert.match(migration,/INVALID_SALE_TOTAL_AT_ROW/);
 assert.match(migration,/insert into public\.inventory_movements/);
 assert.match(migration,/revoke all on function private\.commit_business_import_impl/);
 assert.match(migration,/security invoker/);
});

test('rollback refuses to erase imported records already used by later operations',()=>{
 assert.match(migration,/private\.rollback_business_import_impl/);
 assert.match(migration,/IMPORTED_PRODUCTS_ALREADY_USED/);
 assert.match(migration,/IMPORTED_CUSTOMERS_ALREADY_USED/);
 assert.match(migration,/IMPORTED_SUPPLIERS_ALREADY_USED/);
 assert.match(migration,/IMPORTED_SALES_HAVE_ITEMS/);
 assert.match(migration,/business\.import\.rolled_back/);
});

test('RLS gets execution only for non-mutating helper functions',()=>{
 assert.match(helpers,/grant execute on function private\.can_manage_business\(uuid,text\) to authenticated/);
 assert.match(helpers,/grant execute on function private\.import_capability\(text\) to authenticated/);
 assert.doesNotMatch(helpers,/commit_business_import_impl/);
 assert.doesNotMatch(helpers,/rollback_business_import_impl/);
});

test('CSV ingestion is bounded and handles quoted values and bilingual mapping',()=>{
 assert.match(csv,/if\(quoted&&next==='"'\)/);
 assert.match(csv,/if\(quoted\)throw new Error/);
 assert.match(csv,/matrix\.length>maxRows\+1/);
 assert.match(csv,/matrix\[0\]\.length>maxColumns/);
 assert.match(csv,/replace\(\/\^\\uFEFF\//);
 assert.match(csv,/اسم المنتج/);
 assert.match(csv,/customer_name/);
 assert.match(csv,/validateMapping/);
});

test('upload actions validate size, type, mapping and tenant ownership',()=>{
 assert.match(actions,/file\.size>1024\*1024/);
 assert.match(actions,/text\.includes\('\\u0000'\)/);
 assert.match(actions,/parseCsv\(text\)/);
 assert.match(actions,/organization_id=eq\.\$\{encodeURIComponent\(workspace\.id\)\}/);
 assert.match(actions,/validateMapping/);
 assert.match(actions,/rpc\/commit_business_import/);
 assert.match(actions,/rpc\/rollback_business_import/);
});

test('preview requires explicit column mapping before commit',()=>{
 assert.match(detail,/معاينة أول 5 صفوف/);
 assert.match(detail,/name={`map_\$\{field\.key\}`}/);
 assert.match(detail,/required=\{field\.required\}/);
 assert.match(detail,/تأكيد واستيراد/);
 assert.match(detail,/التراجع عن الاستيراد/);
});
