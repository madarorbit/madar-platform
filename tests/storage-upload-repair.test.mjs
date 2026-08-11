import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("local payment proofs are stored below the authenticated account folder", async () => {
  const [upload, action] = await Promise.all([
    read("src/lib/local-payments.ts"),
    read("app/actions/local-payments.ts"),
  ]);

  assert.match(upload, /storagePath=`\$\{ownerId\}\/local\/\$\{safeScope\}/);
  assert.match(upload, /uploadLocalPaymentProof\(file:File,ownerId:string,scope:string\)/);
  assert.match(action, /uploadLocalPaymentProof\(file,user\.id,`workspace\/\$\{requestId\}`\)/);
});

test("storage policies do not call revoked helpers during avatar, logo or proof uploads", async () => {
  const migration = await read("supabase/migrations/20260811200000_repair_storage_upload_policies.sql");

  assert.match(migration, /founder reads career cvs[\s\S]*private\.is_super_admin\(\)/);
  assert.doesNotMatch(migration, /public\.is_super_admin\(\)/);
  assert.match(migration, /drop policy if exists "student library member read"/);
  assert.match(migration, /create policy "payment proof owner delete"/);
  assert.match(migration, /bucket_id = 'payment-proofs'[\s\S]*storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/);
});

test("admin proof links preserve the Supabase Storage API prefix", async () => {
  const upload = await read("src/lib/local-payments.ts");

  assert.match(upload, /value\.startsWith\('\/storage\/v1\/'\)/);
  assert.match(upload, /`\/storage\/v1\/\$\{value\.replace/);
  assert.match(upload, /absolute\.pathname\.startsWith\('\/storage\/v1\/object\/sign\/payment-proofs\/'\)/);
  assert.doesNotMatch(upload, /new URL\(data\.signedURL\|\|data\.signedUrl,url\)/);
});
