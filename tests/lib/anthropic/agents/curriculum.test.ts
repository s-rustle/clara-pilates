import { describe, it, expect, vi, beforeEach } from "vitest";
import { askCurriculum } from "@/lib/anthropic/agents/curriculum";

vi.mock("@/lib/anthropic/rag", () => ({
  queryRAG: vi.fn(),
}));

vi.mock("@/lib/anthropic/client", () => ({
  anthropic: {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: "Based on your Barrels materials, the Hundred requires supine position. [CONFIDENCE: confident]",
          },
        ],
      }),
    },
  },
}));

describe("Curriculum Agent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({ chunks: [], notFound: true });
  });

  it("returns not found message when no RAG chunks match", async () => {
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({ chunks: [], notFound: true });

    const result = await askCurriculum("What are the contraindications?", "user-1");

    expect(result.confidence).toBe("not_found");
    expect(result.answer).toMatch(/couldn't find|not.*(in|found).*materials/i);
    expect(result.chunks_used).toBe(0);
    expect(result.source_folder).toBeNull();
    expect(result.figures).toEqual([]);
    expect(result.source_images).toEqual([]);
    expect(result.source_documents).toEqual([]);
  });

  it("returns not found when chunks array is empty", async () => {
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({ chunks: [], notFound: false });

    const result = await askCurriculum("Some query", "user-1");

    expect(result.confidence).toBe("not_found");
    expect(result.chunks_used).toBe(0);
    expect(result.figures).toEqual([]);
    expect(result.source_images).toEqual([]);
    expect(result.source_documents).toEqual([]);
  });

  it("returns answer and chunks_used when chunks found", async () => {
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({
      chunks: [
        {
          content: "The Hundred: supine, knees bent.",
          content_type: "text" as const,
          folder_name: "Barrels",
          file_name: "mat.pdf",
          similarity: 0.9,
        },
      ],
      notFound: false,
    });

    const result = await askCurriculum("What is the starting position?", "user-1");

    expect(result.confidence).toBe("confident");
    expect(result.answer).toMatch(/Barrels|supine|Hundred/i);
    expect(result.chunks_used).toBe(1);
    expect(result.source_folder).toBe("Barrels");
    expect(result.figures).toEqual([]);
    expect(result.source_images).toEqual([]);
    expect(result.source_documents).toEqual([]);
  });
});
