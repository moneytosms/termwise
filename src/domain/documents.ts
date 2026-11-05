export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** Null when the upload is acceptable, otherwise the message to show. */
export function checkUpload(mime: string, size: number): string | null {
  if (!(FILE_TYPES as readonly string[]).includes(mime)) return "Only PDF, JPEG or PNG files.";
  if (size > MAX_FILE_BYTES) return "The file is larger than 2 MB.";
  if (size === 0) return "The file is empty.";
  return null;
}
