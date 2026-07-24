import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('store schema creates the permanent engine tables and scalable indexes',async()=>{
 const sql=await read('supabase/migrations/20260724223000_madar_store_engine.sql');
 for(const table of ['subcategories','tags','product_gallery','plans','plan_features','featured_items','store_settings'])assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
 assert.match(sql,/create extension if not exists pg_trgm/);
 assert.match(sql,/products_name_trgm_idx/);
 assert.match(sql,/deleted_at timestamptz/);
});

test('strict Store Engine RLS requires published, visible, active and store-enabled records',async()=>{
 const policy=await read('supabase/migrations/20260724225900_store_engine_policies.sql');
 const hardening=await read('supabase/migrations/20260724230000_store_rls_api_hardening.sql');
 assert.match(policy,/alter table public\.plans enable row level security/);
 assert.match(policy,/status='published' and visibility='visible'/);
 assert.match(hardening,/status = 'published' and visibility = 'visible' and is_active and show_in_store/);
 assert.match(hardening,/drop policy if exists "products authenticated read"/);
});

test('all requested seed data starts hidden, inactive and draft',async()=>{
 const sql=await read('supabase/migrations/20260724223300_store_seed_data.sql');
 for(const name of ['نظام إدارة واتساب للأعمال Lite','نظام CRM','مكتبة البرومبتات','قوالب Notion','مشاريع تخرج','نظام إدارة مستشفى','بناء وكيل AI','استشارة تسويق'])assert.ok(sql.includes(name),`missing seed: ${name}`);
 assert.match(sql,/'draft','hidden',false,false,false/);
});

test('public store routes use the shared database engine',async()=>{
 for(const path of ['app/products/page.tsx','app/services/page.tsx','app/featured/page.tsx','app/latest/page.tsx','app/best-sellers/page.tsx','app/free/page.tsx','app/subscriptions/page.tsx']){
  const source=await read(path);assert.match(source,/StoreListingPage/);
 }
 const server=await read('src/lib/store/server.ts');assert.match(server,/status:'published'/);assert.match(server,/visibility:'visible'/);assert.match(server,/show_in_store:'true'/);
});

test('legacy product module contains no hard-coded catalog records',async()=>{
 const source=await read('src/data/products.ts');assert.doesNotMatch(source,/export const products/);assert.doesNotMatch(source,/advanced-ai-assistant/);
});

test('admin store center and instant search API exist',async()=>{
 const admin=await read('app/admin/store/page.tsx');const api=await read('app/api/store/search/route.ts');const form=await read('components/admin/store/StoreEntityForm.tsx');
 assert.match(admin,/إدارة المتجر/);assert.match(api,/searchStore/);assert.match(form,/Meta Title/);assert.match(form,/tag_ids/);
});
