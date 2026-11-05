import { describe, expect, it } from "vitest";
import { checkUpload, MAX_FILE_BYTES } from "./documents";

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
