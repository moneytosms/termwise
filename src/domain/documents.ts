export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Null when the upload is acceptable, otherwise the message to show. */
export function checkUpload(mime: string, size: number): string | null {
  if (!(FILE_TYPES as readonly string[]).includes(mime)) return "Only PDF, JPEG or PNG files.";
  if (size > MAX_FILE_BYTES) return "The file is larger than 2 MB.";
  if (size === 0) return "The file is empty.";
  return null;
}

/** The real type of the bytes, from their magic numbers; null when unrecognised. */
export function sniffType(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  return null;
}
