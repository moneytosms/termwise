import { describe, expect, it } from "vitest";
import { canMiss, plannerLine } from "./planner";

describe("planner", () => {
  it("counts classes needed in a row when below the line", () => {
    // 15/24 = 62.5%; 27/36 = 75%
    expect(plannerLine(15, 24, 75)).toBe("Attend the next 12 in a row to reach 75%");
  });

  it("counts classes that can be missed when above the line", () => {
    // 18/20 = 90%; 18/24 = 75% still OK, 18/25 is not
    expect(canMiss(18, 20, 75)).toBe(4);
    expect(plannerLine(18, 20, 75)).toBe("You can miss 4 and stay at or above 75%");
  });

  it("says any miss drops below when exactly on the line", () => {
    expect(canMiss(3, 4, 75)).toBe(0);
    expect(plannerLine(3, 4, 75)).toBe("Any miss now drops you below 75%");
  });

  it("does not round a line-crossing count up to the next class", () => {
    // 19/25 = 76%; 19/26 = 73.1%, so no miss is allowed
    expect(canMiss(19, 25, 75)).toBe(0);
    // 20/26 = 76.9%; 20/27 = 74.07%, so zero misses allowed
    expect(canMiss(20, 26, 75)).toBe(0);
  });
});
