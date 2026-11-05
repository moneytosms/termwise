import { describe, expect, it } from "vitest";
import { resolveActiveRow } from "./active-campus";

const rows = [{ id: 9, campusId: 3 }, { id: 4, campusId: 1 }];

describe("resolveActiveRow", () => {
  it("picks the row on the cookie's campus", () => expect(resolveActiveRow(rows, "3")).toEqual({ id: 9, campusId: 3 }));
  it("falls back to the lowest id for a stale or forged campus", () => {
    expect(resolveActiveRow(rows, "2")).toEqual({ id: 4, campusId: 1 });
    expect(resolveActiveRow(rows, "abc")).toEqual({ id: 4, campusId: 1 });
  });
  it("uses the first row without a cookie", () => expect(resolveActiveRow(rows, undefined)).toEqual({ id: 4, campusId: 1 }));
  it("handles a single row and no rows", () => {
    expect(resolveActiveRow([rows[0]], "1")).toEqual(rows[0]);
    expect(resolveActiveRow([], "1")).toBeNull();
  });
});
