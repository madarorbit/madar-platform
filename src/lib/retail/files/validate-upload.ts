const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function validateImageUpload(file: File, maxBytes = 5 * 1024 * 1024) {
  if (file.size < 1 || file.size > maxBytes) throw new Error("INVALID_FILE_SIZE");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = startsWith(bytes, JPEG)
    ? { mime: "image/jpeg", extension: "jpg" }
    : startsWith(bytes, PNG)
      ? { mime: "image/png", extension: "png" }
      : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
          String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
        ? { mime: "image/webp", extension: "webp" }
        : null;
  if (!detected || detected.mime !== file.type) throw new Error("INVALID_FILE_SIGNATURE");
  return detected;
}

export async function validatePaymentProof(file: File) {
  if (file.type === "application/pdf") {
    if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error("INVALID_FILE_SIZE");
    const bytes = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...bytes) !== "%PDF-") throw new Error("INVALID_FILE_SIGNATURE");
    return { mime: "application/pdf", extension: "pdf" } as const;
  }
  return validateImageUpload(file, 10 * 1024 * 1024);
}
