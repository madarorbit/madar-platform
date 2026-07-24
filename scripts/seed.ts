import {readFile} from 'node:fs/promises';

const migrationUrl=new URL('../supabase/migrations/20260724223000_madar_store_engine.sql',import.meta.url);
const migration=await readFile(migrationUrl,'utf8');

const requiredSections=[
 'insert into public.categories',
 'insert into public.subcategories',
 'insert into public.tags',
 'insert into public.products',
 'insert into public.services',
 'insert into public.store_settings',
];

const missing=requiredSections.filter(section=>!migration.includes(section));
if(missing.length)throw new Error(`Store Engine seed migration is incomplete: ${missing.join(', ')}`);
if(!migration.includes("'draft','hidden',false,false,false"))throw new Error('Store Engine defaults must remain draft, hidden and inactive.');

console.log('MADAR Store Engine seed data is versioned inside the Supabase migration. Apply migrations to seed the database safely.');
