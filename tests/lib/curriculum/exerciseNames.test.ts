import { describe, it, expect } from "vitest";
import {
  matchesLevelRepsLine,
  stripBalancedBodyExerciseHeadersFromText,
  formatLevelRepsLineForDisplay,
  toExerciseTitleCase,
} from "@/lib/curriculum/exerciseNames";

describe("matchesLevelRepsLine", () => {
  it("matches BEGINNER|INTERMEDIATE|ADVANCED • digits REPS", () => {
    expect(matchesLevelRepsLine("INTERMEDIATE • 3-5 REPS")).toBe(true);
    expect(matchesLevelRepsLine("ADVANCED • 4-6 REPS")).toBe(true);
    expect(matchesLevelRepsLine("BEGINNER • 8 REPS")).toBe(true);
  });
  it("rejects section-like lines", () => {
    expect(matchesLevelRepsLine("STARTING POSITION")).toBe(false);
    expect(matchesLevelRepsLine("INTERMEDIATE stuff")).toBe(false);
  });
});

describe("stripBalancedBodyExerciseHeadersFromText", () => {
  it("removes ALL CAPS title + level/reps pair", () => {
    const raw = "SWAN DIVE\nINTERMEDIATE • 3-5 REPS\n\nLie prone.";
    const out = stripBalancedBodyExerciseHeadersFromText(raw);
    expect(out).not.toContain("SWAN DIVE");
    expect(out).not.toContain("INTERMEDIATE • 3-5 REPS");
    expect(out).toContain("Lie prone.");
  });
});

describe("formatLevelRepsLineForDisplay", () => {
  it("formats for badge-style display", () => {
    expect(formatLevelRepsLineForDisplay("INTERMEDIATE • 3-5 REPS")).toBe(
      "Intermediate • 3-5 reps"
    );
  });
});

describe("toExerciseTitleCase", () => {
  it("title-cases ALL CAPS titles", () => {
    expect(toExerciseTitleCase("CLIMB A TREE")).toBe("Climb a Tree");
    expect(toExerciseTitleCase("SWAN DIVE")).toBe("Swan Dive");
  });
});
