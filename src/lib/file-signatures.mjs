const signatures = {
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value),
  'image/webp': (bytes) => bytes.length >= 12 && text(bytes, 0, 4) === 'RIFF' && text(bytes, 8, 4) === 'WEBP',
  'application/pdf': (bytes) => bytes.length >= 5 && text(bytes, 0, 5) === '%PDF-',
  'application/zip': (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && ([0x03, 0x05, 0x07].includes(bytes[2])) && ([0x04, 0x06, 0x08].includes(bytes[3])),
  'application/x-zip-compressed': (bytes) => bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && ([0x03, 0x05, 0x07].includes(bytes[2])) && ([0x04, 0x06, 0x08].includes(bytes[3])),
};

function text(bytes, start, length) { return String.fromCharCode(...bytes.slice(start, start + length)); }

function isUtf8Text(bytes) {
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
  } catch { return false; }
}

export async function validateMagicBytes(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'text/plain') return isUtf8Text(bytes);
  return Boolean(signatures[file.type]?.(bytes));
}
