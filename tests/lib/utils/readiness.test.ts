import { describe, it, expect } from "vitest";
import { calculateOverallScore } from "@/lib/utils/readiness";

describe("calculateOverallScore", () => {
  it("returns correct weighted average with 33/34/33 weights", () => {
    // (100 * 0.33) + (100 * 0.34) + (100 * 0.33) = 100
    expect(calculateOverallScore(100, 100, 100)).toBe(100);
  });

  it("returns correct result for mixed scores", () => {
    // (50 * 0.33) + (75 * 0.34) + (25 * 0.33) = 16.5 + 25.5 + 8.25 = 50.25 -> 50.3
    expect(calculateOverallScore(50, 75, 25)).toBe(50.3);
  });

  it("returns 0 when all scores are 0", () => {
    expect(calculateOverallScore(0, 0, 0)).toBe(0);
  });

  it("rounds to one decimal place", () => {
    const result = calculateOverallScore(33.33, 34.34, 33.33);
    expect(result).toBe(33.7);
    expect((result * 10) % 1 === 0 || Number.isInteger(result)).toBe(true);
  });
});
