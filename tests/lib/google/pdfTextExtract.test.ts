import { describe, it, expect, vi } from "vitest";
import { orientationAwarePageRender } from "@/lib/google/pdfTextExtract";

describe("orientationAwarePageRender", () => {
  it("returns concatenated text for text items", async () => {
    const pageData = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [
          { str: "INTERMEDIATE", transform: [1, 0, 0, 1, 72, 720] },
          { str: " • ", transform: [1, 0, 0, 1, 200, 720] },
          { str: "4-6 REPS", transform: [1, 0, 0, 1, 240, 720] },
        ],
      }),
      getViewport: vi.fn().mockReturnValue({ width: 612, height: 792 }),
    };

    const out = await orientationAwarePageRender(pageData);
    expect(out).toMatch(/INTERMEDIATE/);
    expect(out).toMatch(/4-6\s*REPS/);
  });
});
