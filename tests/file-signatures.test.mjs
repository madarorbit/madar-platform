import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMagicBytes } from '../src/lib/file-signatures.mjs';
const file = (type, values) => ({ type, arrayBuffer: async () => Uint8Array.from(values).buffer });
const utf8 = (value) => Array.from(new TextEncoder().encode(value));
test('accepts genuine JPEG, PNG, WebP, PDF and ZIP signatures', async () => {
  await assert.doesNotReject(() => assertValid(file('image/jpeg', [0xff,0xd8,0xff,0xe0])));
  await assert.doesNotReject(() => assertValid(file('image/png', [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])));
  await assert.doesNotReject(() => assertValid(file('image/webp', [...utf8('RIFF'),0,0,0,0,...utf8('WEBP')])));
  await assert.doesNotReject(() => assertValid(file('application/pdf', utf8('%PDF-1.7'))));
  await assert.doesNotReject(() => assertValid(file('application/zip', [0x50,0x4b,0x03,0x04])));
});
test('rejects forged signatures and binary or invalid UTF-8 text', async () => {
  assert.equal(await validateMagicBytes(file('image/png', utf8('not a png'))), false);
  assert.equal(await validateMagicBytes(file('application/pdf', utf8('not a pdf'))), false);
  assert.equal(await validateMagicBytes(file('text/plain', [0xff,0xfe])), false);
  assert.equal(await validateMagicBytes(file('text/plain', [0x61,0x00,0x62])), false);
  assert.equal(await validateMagicBytes(file('text/plain', utf8('نص UTF-8 صالح\n'))), true);
});
async function assertValid(value) { assert.equal(await validateMagicBytes(value), true); }
