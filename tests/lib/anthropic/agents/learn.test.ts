import { describe, it, expect } from "vitest";
import { extractExerciseNamesFromContents } from "@/lib/anthropic/agents/learn";

describe("extractExerciseNamesFromContents", () => {
  it("pulls titles from numbered list lines (pdf-parse style)", () => {
    const text = `
Some intro paragraph.

1. Roll Down
2. One Leg Circle
10. Spine Stretch Forward
`;
    const names = extractExerciseNamesFromContents([text]);
    expect(names).toContain("Roll Down");
    expect(names).toContain("One Leg Circle");
    expect(names).toContain("Spine Stretch Forward");
  });

  it("accepts hyphenated Title Case exercise lines", () => {
    const text = "Side Sit-Up\n\nMore body copy here.";
    expect(extractExerciseNamesFromContents([text])).toContain("Side Sit-Up");
  });

  it("accepts ALL CAPS title only when followed by LEVEL • REPS line (Balanced Body PDF)", () => {
    const text = "BREATHING\nBEGINNER • 3-5 REPS\n\nInhale to prepare.";
    expect(extractExerciseNamesFromContents([text])).toContain("Breathing");
  });

  it("extracts Swan Dive style headers from two-line pattern", () => {
    const text = "SWAN DIVE\nINTERMEDIATE • 3-5 REPS\n\nStarting position…";
    expect(extractExerciseNamesFromContents([text])).toContain("Swan Dive");
  });

  it("does not list STARTING POSITION as an exercise when no level/reps line follows", () => {
    const text = "STARTING POSITION\n\nLie supine.";
    const names = extractExerciseNamesFromContents([text]);
    expect(names.some((n) => /starting\s+position/i.test(n))).toBe(false);
  });
});
