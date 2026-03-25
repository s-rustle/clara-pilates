import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateSession } from "@/lib/anthropic/agents/sessions";

vi.mock("@/lib/anthropic/rag", () => ({
  queryRAGWithContext: vi.fn(),
}));

vi.mock("@/lib/anthropic/client", () => ({
  anthropic: {
    messages: {
      create: vi.fn(),
    },
  },
}));

const validFeedbackJson = {
  alignment_and_form: { score: "sound", note: "Alignment cues present." },
  breathing: { score: "sound", note: "Breath cued in warm-up." },
  cueing_clarity: { score: "clear", note: "Notes are specific." },
  client_progression: { score: "sound", note: "Warm-up supports main work." },
  safety: {
    score: "appropriate",
    note: "Volume reasonable.",
    flags: [] as Array<{
      exercise_name: string;
      concern: string;
      recommendation: string;
    }>,
  },
  overall: "Solid session.",
  suggested_adjustments: [] as string[],
};

describe("Session Planner Agent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { queryRAGWithContext } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAGWithContext).mockResolvedValue({
      chunks: [
        {
          content: "The Hundred — supine, breathing pattern",
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
          text: JSON.stringify(validFeedbackJson),
        },
      ],
    } as never);
  });

  it("returns structured five-dimension SessionFeedback", async () => {
    const sessionData = {
      mode: "plan",
      session_type: "personal",
      apparatus: "Mat",
      warm_up: [{ move_name: "breathing", sets: 1, reps: 8 }],
      exercise_sequence: [
        { exercise_name: "The Hundred", sets: 1, reps: 10 },
      ],
    };

    const result = await evaluateSession(sessionData, "user-1");

    expect(result).toHaveProperty("alignment_and_form");
    expect(result).toHaveProperty("breathing");
    expect(result).toHaveProperty("cueing_clarity");
    expect(result).toHaveProperty("client_progression");
    expect(result).toHaveProperty("safety");
    expect(result).toHaveProperty("overall");
    expect(result).toHaveProperty("suggested_adjustments");

    expect(result.safety.flags).toEqual([]);
    expect(Array.isArray(result.suggested_adjustments)).toBe(true);
  });

  it("throws when Claude response is not valid JSON", async () => {
    const { anthropic } = await import("@/lib/anthropic/client");
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [{ type: "text", text: "not json" }],
    } as never);

    await expect(
      evaluateSession(
        {
          mode: "plan",
          session_type: "personal",
          apparatus: "Mat",
          warm_up: [],
          exercise_sequence: [
            { exercise_name: "X", sets: 1, reps: 8 },
          ],
        },
        "user-1"
      )
    ).rejects.toThrow(/valid JSON/i);
  });

  it("throws when parsed JSON does not match SessionFeedback shape", async () => {
    const { anthropic } = await import("@/lib/anthropic/client");
    vi.mocked(anthropic.messages.create).mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ alignment_and_form: "broken" }),
        },
      ],
    } as never);

    await expect(
      evaluateSession(
        {
          mode: "plan",
          session_type: "personal",
          apparatus: "Mat",
          warm_up: [],
          exercise_sequence: [
            { exercise_name: "X", sets: 1, reps: 8 },
          ],
        },
        "user-1"
      )
    ).rejects.toThrow(/Invalid SessionFeedback from model/);
  });
});
