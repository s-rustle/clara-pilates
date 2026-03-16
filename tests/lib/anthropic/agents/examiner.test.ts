import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateQuestion, evaluateAnswer } from "@/lib/anthropic/agents/examiner";

vi.mock("@/lib/anthropic/rag", () => ({
  queryRAG: vi.fn(),
}));

describe("Examiner Agent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({
      chunks: [{ id: "1", content: "The Hundred", folder_name: "Mat 1", file_name: "mat.pdf" }],
      notFound: false,
    });
  });

  it("generates a question", async () => {
    const result = await generateQuestion(
      "Mat",
      "The Hundred",
      "Foundational",
      [],
      "user-1"
    );

    expect(result.question).toBeTruthy();
    expect(typeof result.question).toBe("string");
    expect(Array.isArray(result.expected_answer_elements)).toBe(true);
  });

  it("evaluates a correct answer correctly", async () => {
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

  it("evaluates an incorrect answer as incorrect", async () => {
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
