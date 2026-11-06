import { describe, expect, it } from "vitest";
import { checkUpload, MAX_FILE_BYTES, sniffType } from "./documents";

describe("checkUpload", () => {
  it("accepts PDF, JPEG and PNG", () => {
    expect(checkUpload("application/pdf", 1000)).toBeNull();
    expect(checkUpload("image/jpeg", 1000)).toBeNull();
    expect(checkUpload("image/png", 1000)).toBeNull();
  });
  it("refuses other types", () => {
    expect(checkUpload("text/plain", 1000)).toBe("Only PDF, JPEG or PNG files.");
    expect(checkUpload("image/gif", 1000)).toBe("Only PDF, JPEG or PNG files.");
  });
  it("accepts exactly 2 MB and refuses one byte more", () => {
    expect(MAX_FILE_BYTES).toBe(2 * 1024 * 1024);
    expect(checkUpload("application/pdf", MAX_FILE_BYTES)).toBeNull();
    expect(checkUpload("application/pdf", MAX_FILE_BYTES + 1)).toBe("The file is larger than 2 MB.");
  });
  it("refuses an empty file", () => {
    expect(checkUpload("application/pdf", 0)).toBe("The file is empty.");
  });
});

describe("sniffType", () => {
  const bytes = (...b: number[]) => new Uint8Array(b);
  it("detects PDF from %PDF", () => {
    expect(sniffType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBe("application/pdf");
  });
  it("detects JPEG from FF D8 FF", () => {
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("image/jpeg");
  });
  it("detects PNG from its 8-byte signature", () => {
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("image/png");
  });
  it("returns null for text", () => {
    expect(sniffType(new TextEncoder().encode("hello world"))).toBeNull();
  });
  it("returns null for an empty or truncated signature", () => {
    expect(sniffType(new Uint8Array(0))).toBeNull();
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });
});
