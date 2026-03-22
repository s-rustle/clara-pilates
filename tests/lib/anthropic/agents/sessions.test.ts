import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateSession } from "@/lib/anthropic/agents/sessions";

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

const validFeedbackJson = {
  progression_logic: { score: "sound", note: "Warm-up supports main work." },
  contraindication_flags: {
    score: "none",
    flags: [] as Array<{
      exercise_name: string;
      flag: string;
      recommendation: string;
    }>,
  },
  volume_assessment: {
    score: "appropriate",
    note: "Within range.",
    flagged_exercises: [] as string[],
  },
  muscle_group_balance: {
    score: "balanced",
    note: "Good mix.",
    gaps: [] as string[],
  },
  sequence_alignment: { score: "aligned", note: "Matches BB order." },
  overall: "Solid session.",
  suggested_adjustments: [] as string[],
};

describe("Session Planner Agent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({
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

    expect(result).toHaveProperty("progression_logic");
    expect(result).toHaveProperty("contraindication_flags");
    expect(result).toHaveProperty("volume_assessment");
    expect(result).toHaveProperty("muscle_group_balance");
    expect(result).toHaveProperty("sequence_alignment");
    expect(result).toHaveProperty("overall");
    expect(result).toHaveProperty("suggested_adjustments");

    expect(result.progression_logic).toHaveProperty("score");
    expect(result.progression_logic).toHaveProperty("note");
    expect(Array.isArray(result.contraindication_flags.flags)).toBe(true);
    expect(Array.isArray(result.volume_assessment.flagged_exercises)).toBe(
      true
    );
    expect(Array.isArray(result.muscle_group_balance.gaps)).toBe(true);
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
          text: JSON.stringify({ progression_logic: "broken" }),
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
