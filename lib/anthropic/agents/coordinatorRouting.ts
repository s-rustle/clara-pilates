import { anthropic } from "@/lib/anthropic/client";
import { COORDINATOR_SYSTEM_PROMPT } from "@/lib/anthropic/agents/coordinator";

const COORDINATOR_MODEL = "claude-sonnet-4-20250514";

export type RoutedAgent =
  | "curriculum"
  | "examiner"
  | "cues"
  | "session_planner"
  | "readiness"
  | "weakspot"
  | "out_of_scope";

export interface CoordinatorRoutingResult {
  agent: RoutedAgent;
  rationale: string;
}

const ROUTING_SUFFIX = `

Return ONLY valid JSON (no markdown):
{
  "agent": "curriculum" | "examiner" | "cues" | "session_planner" | "readiness" | "weakspot" | "out_of_scope",
  "rationale": "one short sentence"
}

Choose out_of_scope only for requests unrelated to Pilates exam prep, curriculum, hours, or study features.`;

/**
 * Routes an open-ended user message to a specialist agent label (or out_of_scope).
 */
export async function routeUserMessage(
  userMessage: string
): Promise<CoordinatorRoutingResult> {
  const response = await anthropic.messages.create({
    model: COORDINATOR_MODEL,
    max_tokens: 256,
    system: COORDINATOR_SYSTEM_PROMPT + ROUTING_SUFFIX,
    messages: [{ role: "user", content: userMessage.trim().slice(0, 4000) }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  const match = text.trim().match(/\{[\s\S]*\}/);
  if (!match) {
    return { agent: "curriculum", rationale: "Fallback: no JSON from coordinator." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { agent: "curriculum", rationale: "Fallback: parse error." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { agent: "curriculum", rationale: "Fallback: invalid shape." };
  }

  const o = parsed as Record<string, unknown>;
  const agent = o.agent;
  const rationale =
    typeof o.rationale === "string" ? o.rationale : "No rationale provided.";

  const allowed: RoutedAgent[] = [
    "curriculum",
    "examiner",
    "cues",
    "session_planner",
    "readiness",
    "weakspot",
    "out_of_scope",
  ];

  if (typeof agent === "string" && allowed.includes(agent as RoutedAgent)) {
    return { agent: agent as RoutedAgent, rationale };
  }

  return { agent: "curriculum", rationale };
}
