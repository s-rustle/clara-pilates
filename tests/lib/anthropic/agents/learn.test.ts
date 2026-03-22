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

  it("accepts single-word ALL CAPS exercise names when not a section label", () => {
    const text = "BREATHING\n\nInhale to prepare.";
    expect(extractExerciseNamesFromContents([text])).toContain("BREATHING");
  });
});
