import { describe, it, expect } from "vitest";
import { extractExerciseNamesFromContents } from "@/lib/curriculum/exerciseNames";

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

  it("rejects junk candidates (empty, short, newlines in raw, non-ASCII, =, document-title words)", () => {
    const text = `
1. Roll Down
2. Ab
3. Barrel a Detailed Guide for Teaching Barrel
4. Foo = Bar
5. Weird\u2019s Move
**„Broken"**
`;
    const names = extractExerciseNamesFromContents([text]);
    expect(names).toContain("Roll Down");
    expect(names).not.toContain("Ab");
    expect(names.some((n) => /guide/i.test(n))).toBe(false);
    expect(names.some((n) => /=/u.test(n))).toBe(false);
    expect(names.some((n) => /Weird/u.test(n))).toBe(false);
  });

  it("dedupes variants that normalize to the same letters (punctuation/case)", () => {
    const text = `
1. Roll Down
2. roll down.
**ROLL DOWN**
`;
    const names = extractExerciseNamesFromContents([text]);
    expect(names).toEqual(["Roll Down"]);
  });

  it("rejects titles longer than 50 characters", () => {
    const long =
      "This Is An Implausibly Long Exercise Name That Should Not Appear In List";
    const text = `1. ${long}\n2. Short Name Here`;
    const names = extractExerciseNamesFromContents([text]);
    expect(names).toContain("Short Name Here");
    expect(names.some((n) => n.length > 50)).toBe(false);
  });
});
