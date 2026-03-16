import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateSession } from "@/lib/anthropic/agents/sessions";

vi.mock("@/lib/anthropic/rag", () => ({
  queryRAG: vi.fn(),
}));

describe("Session Planner Agent", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { queryRAG } = await import("@/lib/anthropic/rag");
    vi.mocked(queryRAG).mockResolvedValue({ chunks: [], notFound: false });
  });

  it("returns structured five-dimension feedback", async () => {
    const sessionData = {
      mode: "plan",
      session_type: "personal",
      apparatus: "Mat",
      warm_up: [{ move_name: "breathing", sets: 1, reps: 8 }],
      exercise_sequence: [
        { exercise_name: "The Hundred", sets: 1, reps: 10 },
      ],
    };

    const result = await evaluateSession(
      sessionData,
      "user-1"
    );

    expect(result).toHaveProperty("progression_logic");
    expect(result).toHaveProperty("contraindication_flags");
    expect(result).toHaveProperty("volume_assessment");
    expect(result).toHaveProperty("muscle_group_balance");
    expect(result).toHaveProperty("sequence_alignment");
    expect(result).toHaveProperty("overall");
    expect(result).toHaveProperty("suggested_adjustments");

    expect(result.progression_logic).toHaveProperty("score");
    expect(result.progression_logic).toHaveProperty("note");
    expect(result.contraindication_flags).toHaveProperty("flagged");
    expect(result.volume_assessment).toHaveProperty("flagged_exercises");
    expect(result.muscle_group_balance).toHaveProperty("gaps");
    expect(Array.isArray(result.suggested_adjustments)).toBe(true);
  });
});
