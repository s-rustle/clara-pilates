import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateQuestion, evaluateAnswer } from "@/lib/anthropic/agents/examiner";

vi.mock("@/lib/anthropic/rag", () => ({
  queryRAG: vi.fn(),
}));

vi.mock("@/lib/anthropic/client", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

describe("Examiner Agent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({
      chunks: [
        {
          content: "The Hundred - supine, knees bent, feet on mat",
          content_type: "text",
          folder_name: "Mat 1",
          file_name: "mat.pdf",
          similarity: 0.9,
        },
      ],
      notFound: false,
    });
    const { anthropic } = await import("@/lib/anthropic/client");
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"format":"open_ended","question":"What is the starting position for the Hundred?","expected_answer_elements":["supine","knees bent","feet on mat"]}',
        },
      ],
    } as never);
  });

  it("returns error when no curriculum material found", async () => {
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({ chunks: [], notFound: true });

    const result = await generateQuestion(
      "Mat",
      "Unknown Topic",
      "Foundational",
      [],
      "user-1"
    );

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toMatch(/No curriculum material|ingest/i);
    }
  });

  it("generates a question", async () => {
    const result = await generateQuestion(
      "Mat",
      "The Hundred",
      "Foundational",
      [],
      "user-1"
    );

    if ("error" in result) {
      throw new Error(`expected question, got error: ${result.error}`);
    }

    expect(result.question).toBeTruthy();
    expect(typeof result.question).toBe("string");
    expect(Array.isArray(result.expected_answer_elements)).toBe(true);
  });

  it("evaluates a correct answer correctly", async () => {
    const { anthropic } = await import("@/lib/anthropic/client");
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"result":"correct","feedback":"Correct. Your answer covers the key elements.","correct_answer":null}',
        },
      ],
    } as never);

    const expectedElements = ["supine", "knees bent", "feet"];
    const correctAnswer = "Supine with knees bent and feet on the mat.";

    const result = await evaluateAnswer(
      "What is the starting position?",
      correctAnswer,
      expectedElements,
      false,
      "user-1"
    );

    expect(result.result).toBe("correct");
    expect(result.feedback).toBeTruthy();
  });

  it("evaluates multiple choice deterministically", async () => {
    const result = await evaluateAnswer(
      "What is the starting position?",
      "a",
      [],
      false,
      "user-1",
      { format: "multiple_choice", correct_id: "a", options: [{ id: "a", text: "Supine" }] }
    );
    expect(result.result).toBe("correct");
  });

  it("evaluates multiple choice incorrect", async () => {
    const result = await evaluateAnswer(
      "What is the starting position?",
      "b",
      [],
      false,
      "user-1",
      { format: "multiple_choice", correct_id: "a", options: [{ id: "a", text: "Supine" }] }
    );
    expect(result.result).toBe("incorrect");
    expect(result.correct_answer).toBe("Supine");
  });

  it("evaluates an incorrect answer as incorrect", async () => {
    const { anthropic } = await import("@/lib/anthropic/client");
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"result":"incorrect","feedback":"Your answer does not cover the key elements.","correct_answer":"Supine with knees bent and feet on the mat."}',
        },
      ],
    } as never);

    const result = await evaluateAnswer(
      "What is the starting position?",
      "I don't know",
      ["supine", "knees bent"],
      false,
      "user-1"
    );

    expect(result.result).toBe("incorrect");
  });
});
