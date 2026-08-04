import { randomUUID } from 'node:crypto';
import { mobileContext, mobileError, scalar } from '@/src/lib/mobile/v2';
import { supabaseConfig } from '@/src/lib/env';
import { supabaseFetch } from '@/src/lib/supabase/server';

export const runtime = 'nodejs';
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']);
const extension: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'text/plain': 'txt',
};

function validSignature(type: string, bytes: Uint8Array) {
  if (type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (type === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (type === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  if (type === 'text/plain') {
    if (bytes.slice(0, 4096).some((value) => value === 0)) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 4096)); return true; } catch { return false; }
  }
  return false;
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const context = await mobileContext(request);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'اختر ملفًا صالحًا.' }, { status: 400 });
    const settings = scalar<{ max_attachment_bytes?: number }>(await supabaseFetch('/rest/v1/mobile_v2_settings?id=eq.1&select=max_attachment_bytes', {}, context.accessToken)) || {};
    const maxBytes = Number(settings.max_attachment_bytes || 5242880);
    if (!allowed.has(file.type)) return Response.json({ error: 'نوع الملف غير مسموح.' }, { status: 415 });
    if (file.size < 1 || file.size > maxBytes) return Response.json({ error: `حجم المرفق يجب ألا يتجاوز ${Math.round(maxBytes / 1024 / 1024)}MB.` }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validSignature(file.type, bytes)) return Response.json({ error: 'محتوى الملف لا يطابق نوعه المعلن.' }, { status: 415 });
    const safeName = file.name.replace(/[\u0000-\u001f\\/:*?"<>|]/g, '-').slice(0, 180) || `attachment.${extension[file.type]}`;
    uploadedPath = `${context.workspaceId}/${context.user.id}/${randomUUID()}.${extension[file.type]}`;
    const { url, key } = supabaseConfig();
    const upload = await fetch(`${url}/storage/v1/object/mobile-orby-attachments/${uploadedPath.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${context.accessToken}`, 'Content-Type': file.type, 'x-upsert': 'false' },
      body: bytes,
      cache: 'no-store',
    });
    if (!upload.ok) throw Object.assign(new Error('تعذر رفع المرفق بأمان.'), { status: upload.status });
    const inserted = scalar<Record<string, unknown>>(await supabaseFetch('/rest/v1/mobile_orby_attachments', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: context.workspaceId,
        user_id: context.user.id,
        storage_path: uploadedPath,
        original_name: safeName,
        mime_type: file.type,
        byte_size: file.size,
      }),
    }, context.accessToken));
    if (!inserted) throw new Error('تعذر تسجيل بيانات المرفق.');
    return Response.json({ id: String(inserted.id), name: safeName, mimeType: file.type, size: file.size }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      const token = request.headers.get('authorization') || '';
      const { url, key } = supabaseConfig();
      void fetch(`${url}/storage/v1/object/mobile-orby-attachments/${uploadedPath.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'DELETE', headers: { apikey: key, Authorization: token }, cache: 'no-store',
      }).catch(() => null);
    }
    return mobileError(error);
  }
}
