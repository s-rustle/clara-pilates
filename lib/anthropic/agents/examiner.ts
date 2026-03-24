import { anthropic } from "@/lib/anthropic/client";
import { queryRAGWithContext } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";
import { createServiceClient } from "@/lib/supabase/server";
import type { RagChunk } from "@/types";
import type { McOption, MatchingPair } from "@/types";
import {
  ANATOMY_DIAGRAM_MUSCLE_LIST_PROMPT,
  canonicalizeAnatomyDiagramMuscle,
} from "@/lib/quiz/anatomyDiagramMuscles";
import { stripBalancedBodyExerciseHeadersFromText } from "@/lib/curriculum/exerciseNames";

const EXAMINER_MODEL = "claude-sonnet-4-20250514";

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  open_ended: `Return ONLY valid JSON: {"format": "open_ended", "question": "string", "expected_answer_elements": ["string"]}
In the question string, wrap exercise names from the source in **like this**.`,
  multiple_choice: `Return ONLY valid JSON: {"format": "multiple_choice", "question": "string", "options": [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}, {"id": "c", "text": "Option C"}, {"id": "d", "text": "Option D"}], "correct_id": "a"}
Use 3-5 plausible options. IDs should be "a", "b", "c", "d". One correct, others plausible distractors. In the question string, wrap exercise names from the source in **like this**.`,
  fill_blank: `Return ONLY valid JSON: {"format": "fill_blank", "question": "string with _____ for the blank", "correct_answer": "string", "expected_answer_elements": ["string"]}
Use a single _____ for one key term. Provide correct_answer and expected_answer_elements for flexible matching. Wrap exercise names in **.`,
  matching: `Return ONLY valid JSON: {"format": "matching", "question": "string", "pairs": [{"left": "term A", "right": "definition A"}, {"left": "term B", "right": "definition B"}, ...], "left_items": ["term A", "term B", ...], "right_items": ["definition A", "definition B", ...]}
Provide 3-5 pairs. Shuffle right_items in your output so they are not in matching order. Wrap exercise names in the question in **.`,
  diagram_matching: `Return ONLY valid JSON: {"format": "diagram_matching", "question": "string", "pairs": [{"left": "region/label A", "right": "structure name"}, ...], "left_items": [...], "right_items": [...]}
The question must be: "Looking at the diagram, identify the muscle/structure indicated by [description of location]." or similar. Create 3-5 pairs matching labeled regions/descriptions to anatomy terms from the source. Shuffle right_items.`,
  anatomy_multiple_choice: `Return ONLY valid JSON: {"format": "anatomy_multiple_choice", "question": "string", "options": ["string","string","string","string"], "correct_option": "string", "expected_answer_elements": ["string"]}
options must contain exactly four distinct strings. correct_option must equal exactly one of the four options (same spelling and casing). expected_answer_elements should be a single-element array containing correct_option.
For anatomy questions, generate four multiple choice options. One must be correct. Three must be plausible but incorrect — drawn from related anatomy terms and structures that appear in the source material. Never invent anatomy not present in the materials.`,
  anatomy_diagram: `Return ONLY valid JSON: {"format": "anatomy_diagram", "question": "string", "target_muscle": "string", "expected_answer_elements": ["string", "..."]}
target_muscle must be EXACTLY one of these muscle group names (same spelling): ${ANATOMY_DIAGRAM_MUSCLE_LIST_PROMPT}.
expected_answer_elements must include that exact target_muscle string plus any reasonable synonyms from the source (e.g. "rectus abdominis", "TVA", "transverse abdominis", "obliques" when target_muscle is Abdominals).
The question should ask which muscle group is primarily strengthened, stretched, stabilized, or targeted for a movement or teaching scenario described in the source — do NOT name the answer in the question. The learner will select a region on the interactive diagram (front/back) and type the muscle group name (active recall).`,
};

const GENERATE_SYSTEM_PROMPT = `You are a Balanced Body Comprehensive exam examiner.
Generate one exam-style question grounded exclusively in the provided source material.
Difficulty levels:
- Foundational: recall and identification
- Intermediate: application and explanation
- Exam-Ready: synthesis, contraindications, edge cases
CRITICAL: You must NOT repeat or closely paraphrase any question in the previousQuestions list. Each new question must ask about a different fact, concept, exercise, or angle. If a topic was already asked, choose a different topic. This is mandatory.
EXERCISE NAMES: Only use exercise names that appear explicitly in the source material (often bolded there). Never invent, paraphrase, or infer exercise titles. If you cannot find an exact exercise name in the chunks, ask about a concept or apparatus instead. When the question mentions an exercise, wrap the title in **double asterisks** using Title Case (e.g. **The Hundred**, **Swan Dive**) — not ALL CAPS as in manual headers — so it reads clearly in the app.
SOURCE SCOPE: Chunks may come from any ingested manual folder. Anatomy, alignment, and muscle actions described inside an apparatus chapter (e.g. Barrels) are valid material—use them for anatomy and biomechanics questions when they appear in those chunks. Respect the user's apparatus/topic focus when choosing what to ask, but do not assume anatomy lives only in a separate "Anatomy" folder.
PROGRESSION: If the source discusses exercise order, prerequisites, levels (Mat 1 vs 2 vs 3, Reformer 1 vs 2 vs 3), or sequencing principles, you may ask about flow, progressions, or teaching order—only when the chunks support it.
Question types (when supported by the chunks):
- Starting position, cueing language, spring settings, exercise sequencing
- Program level and recommended rep ranges from exercise headers (e.g. Intermediate, 4-6 reps) when explicitly present in the source
- Muscle / anatomy identification from Purpose or muscle-target sections embedded in apparatus materials
- Precaution scenarios (e.g. a client condition and which exercises to avoid or modify — only from stated contraindications in source)
- Progression questions (e.g. what prepares a client for another exercise; ordering in progression tables)
- Session sequencing (e.g. which session template or level fits a client profile — only if templates appear in source)
When the requested format is anatomy_multiple_choice: follow the anatomy MC JSON schema exactly; options are four muscle/structure names from the source; the question should reference the diagram or region being tested.
When the requested format is anatomy_diagram: target_muscle must exactly match one of these muscle group names (no other spelling or label): ${ANATOMY_DIAGRAM_MUSCLE_LIST_PROMPT}. Never use a muscle name not in this list. The question must not reveal target_muscle by name.

${OUT_OF_SCOPE_INSTRUCTION}`;

const ANATOMY_DIAGRAM_RECALL_EVAL_SYSTEM = `You are a Balanced Body Comprehensive exam examiner. The learner selected a region on an anatomy diagram and typed a muscle group name (active recall).

You must return ONLY valid JSON:
{"result": "correct"|"partial"|"incorrect", "feedback": "string", "correct_answer": "string|null"}

Grading (use expected synonyms from the materials generously):
- "correct": The typed answer clearly identifies the canonical muscle GROUP (exact name, established synonym, or unambiguous scientific name such as "erector spinae" for Spinal Extensors, "rectus abdominis" / "TVA" / "transverse abdominis" when they map to the target group per synonyms).
- "partial": Anatomically close but incomplete or slightly off — e.g. too narrow, missing "group" framing, or informal but recognizable. Feedback should be brief and encouraging (tone: almost there / close). Always set correct_answer to the exact canonical muscle group name provided in the prompt.
- "incorrect": Wrong group, unrelated anatomy, or too vague to count.

For "correct": set correct_answer to null.
For "partial" and "incorrect": set correct_answer to the exact canonical muscle group name from the prompt so the UI can display it.

Keep feedback to 1–3 short sentences. Ground judgments in the synonym list and Pilates teaching context; do not invent anatomy not implied by the synonyms or question.

${OUT_OF_SCOPE_INSTRUCTION}`;

const EVALUATE_SYSTEM_PROMPT = `You are a Balanced Body Comprehensive exam examiner evaluating written answers.
Evaluate whether the user answered what the question asked. Do NOT require word-for-word matches or extra descriptive detail.
- Mark 'correct' when the user correctly identifies or addresses what the question asks for (e.g., if asked for "two main components" and they name both, that is correct — do not require supplementary details like "rounded surface" or "wooden uprights" unless the question explicitly asked for those).
- Mark 'partial' only when the answer is incomplete for what was explicitly asked (e.g., asked for two things but only got one, or key safety/technique elements were explicitly asked and are missing).
- Mark 'incorrect' only when the answer is wrong, contradicts the source material, or misses the main concept entirely.
Do NOT penalize for omitting descriptive elaboration that the question did not ask for.
If isRetry is false and result is 'partial': return encouraging feedback without revealing the answer.
If isRetry is true OR result is 'incorrect': reveal the correct answer with full explanation grounded in the source material. EXPLAIN WHY—help the learner understand the rationale, not just the correct answer. For matching questions: point out which pairings they got wrong and explain why each correct pairing matters (e.g., which movement pattern causes that precaution).
Return ONLY valid JSON: {"result": "correct"|"partial"|"incorrect", "feedback": "string", "correct_answer": "string|null"}
correct_answer is null when result is 'partial' and isRetry is false.
Do not include any other text, markdown, or explanation.

${OUT_OF_SCOPE_INSTRUCTION}`;

const MATCHING_FEEDBACK_PROMPT = `You are a Balanced Body exam examiner. The user got a matching question wrong. They need to LEARN, not just see the answer.
Given the correct pairs and their incorrect attempts, write 2–4 sentences of explanatory feedback that:
1. Briefly note which pairings were wrong
2. Explain WHY each correct pairing matters (e.g., what about Corkscrew makes it a neck precaution? Why does Roll Back relate to pregnancy/osteoporosis?)
3. Help them remember for next time
Return ONLY valid JSON: {"feedback": "string"}
Keep feedback concise but educational. Ground explanations in Pilates/Anatomy reasoning.`;

function formatChunksForPrompt(chunks: RagChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} — ${c.folder_name} / ${c.file_name}]\n${stripBalancedBodyExerciseHeadersFromText(c.content)}`
    )
    .join("\n\n---\n\n");
}

export interface GenerateQuestionSuccess {
  format:
    | "open_ended"
    | "multiple_choice"
    | "fill_blank"
    | "matching"
    | "diagram_matching"
    | "anatomy_multiple_choice"
    | "anatomy_diagram";
  question: string;
  expected_answer_elements: string[];
  source_chunks_used: RagChunk[];
  options?: McOption[];
  correct_id?: string;
  correct_answer?: string;
  /** Four labels for anatomy MC (string[]); distinct from options (McOption[]) */
  anatomy_options?: string[];
  /** Correct label — must match one of anatomy_options exactly */
  correct_option?: string;
  /** Pin-the-muscle diagram: canonical group name from ANATOMY_DIAGRAM_MUSCLE_IDS */
  target_muscle?: string;
  pairs?: MatchingPair[];
  left_items?: string[];
  right_items?: string[];
  image_file_name?: string;
  folder_name?: string;
}

export interface GenerateQuestionError {
  error: string;
}

export type GenerateQuestionResult =
  | GenerateQuestionSuccess
  | GenerateQuestionError;

export interface EvaluationResult {
  result: "correct" | "partial" | "incorrect";
  feedback: string;
  correct_answer: string | null;
}

const EXPLAIN_CORRECT_PROMPT = `You are a Balanced Body exam examiner. The user got the question right. They've clicked "Explain why" to deepen their understanding.
In 2–4 sentences, explain WHY the answer is correct. Add context that helps them retain the concept: what principle it illustrates, how it connects to other Pilates concepts, or why it matters for teaching. Be concise and educational.
Return ONLY valid JSON: {"explanation": "string"}`;

export interface ExplainCorrectOptions {
  format?:
    | "open_ended"
    | "multiple_choice"
    | "fill_blank"
    | "matching"
    | "diagram_matching"
    | "anatomy_multiple_choice"
    | "anatomy_diagram";
  correct_answer?: string;
  correct_id?: string;
  correct_option?: string;
  options?: McOption[];
  pairs?: MatchingPair[];
  expected_elements?: string[];
}

export async function explainCorrectAnswer(
  question: string,
  options: ExplainCorrectOptions
): Promise<string> {
  const format = options.format ?? "open_ended";
  let context = "";

  if (format === "multiple_choice" && options.correct_id && options.options) {
    const opt = options.options.find((o) => o.id === options.correct_id);
    context = `Correct answer: ${opt?.text ?? options.correct_answer ?? options.correct_id}`;
  } else if (
    format === "anatomy_multiple_choice" &&
    (options.correct_option || options.correct_answer)
  ) {
    context = `Correct answer: ${options.correct_option ?? options.correct_answer}`;
  } else if (format === "anatomy_diagram" && options.correct_answer) {
    context = `Correct muscle group (diagram): ${options.correct_answer}`;
  } else if ((format === "matching" || format === "diagram_matching") && options.pairs?.length) {
    context = `Correct pairs:\n${options.pairs.map((p) => `${p.left} → ${p.right}`).join("\n")}`;
  } else if (options.correct_answer) {
    context = `Correct answer: ${options.correct_answer}`;
  } else if (options.expected_elements?.length) {
    context = `Expected key elements: ${options.expected_elements.join(", ")}`;
  } else if (options.format === "open_ended" && !context) {
    context = "The user's answer was correct (open-ended).";
  }

  const response = await anthropic.messages.create({
    model: EXAMINER_MODEL,
    max_tokens: 512,
    system: EXPLAIN_CORRECT_PROMPT,
    messages: [
      {
        role: "user",
        content: `Question: ${question}\n\n${context}\n\nExplain why this is correct.`,
      },
    ],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  try {
    const parsed = parseJsonFromResponse<{ explanation: string }>(text);
    if (typeof parsed.explanation === "string" && parsed.explanation.trim()) {
      return parsed.explanation.trim();
    }
  } catch {
    /* fallback */
  }
  return "Explanation unavailable.";
}

function parseJsonFromResponse<T>(text: string): T {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Claude response did not contain valid JSON");
  }
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    throw new Error("Failed to parse Claude response as JSON");
  }
}

const FORMATS: Array<"open_ended" | "multiple_choice" | "fill_blank" | "matching"> = [
  "open_ended",
  "multiple_choice",
  "fill_blank",
  "matching",
];

async function getAnatomyDiagramChunks(
  userId: string
): Promise<Array<{ file_name: string }>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("curriculum_chunks")
    .select("file_name")
    .eq("user_id", userId)
    .eq("folder_name", "Anatomy")
    .eq("content_type", "diagram");
  if (!data || data.length === 0) return [];
  const seen = new Set<string>();
  return data
    .filter((r) => {
      if (seen.has(r.file_name)) return false;
      seen.add(r.file_name);
      return true;
    })
    .map((r) => ({ file_name: r.file_name }));
}

export type ExaminerFormatPreference =
  | "mixed"
  | "open_ended"
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "anatomy_multiple_choice"
  | "anatomy_diagram";

export async function generateQuestion(
  apparatus: string,
  topic: string | null,
  difficulty: string,
  previousQuestions: string[],
  userId: string,
  formatPreference: ExaminerFormatPreference = "mixed"
): Promise<GenerateQuestionResult> {
  const isAnatomy = apparatus === "Anatomy" || topic === "Anatomy";
  const wantsMatching =
    formatPreference === "matching" ||
    (formatPreference === "mixed" && Math.random() < 0.25);

  let diagramChunks: Array<{ file_name: string }> = [];
  if (isAnatomy && wantsMatching) {
    diagramChunks = await getAnatomyDiagramChunks(userId);
  }

  /**
   * Search across all ingested folders. Do not pass folder_filter for "Anatomy" —
   * anatomy for barrel/mat/reformer moves often lives inside those apparatus chunks,
   * and SQL uses strict equality on folder_name (Barrels ≠ Anatomy).
   */
  const query = [
    apparatus,
    topic ?? "",
    "Balanced Body Comprehensive",
    isAnatomy
      ? "anatomy muscles bones alignment movement"
      : "exercise sequencing precautions cueing spring settings",
    "progression teaching",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const { chunks, notFound } = await queryRAGWithContext(
    query,
    userId,
    [
      "purpose muscles strengthen stretch",
      "precautions avoid contraindications",
      "progressions sequence difficulty",
    ],
    { folderFilter: null, minSimilarity: 0.42 }
  );

  if (notFound || chunks.length === 0) {
    return {
      error:
        "I couldn't find this in your uploaded materials. Ingest your curriculum folders in Curriculum Manager, then try again.",
    };
  }

  const anatomyPrimarySource =
    chunks[0] &&
    String(chunks[0].folder_name ?? "")
      .trim()
      .toLowerCase() === "anatomy";
  const useAnatomyDiagram = isAnatomy || Boolean(anatomyPrimarySource);

  let format: GenerateQuestionSuccess["format"];
  let imageFileName: string | undefined;
  let folderName: string | undefined;

  if (useAnatomyDiagram) {
    format = "anatomy_diagram";
  } else if (diagramChunks.length > 0 && wantsMatching) {
    format = "diagram_matching";
    const picked = diagramChunks[Math.floor(Math.random() * diagramChunks.length)];
    imageFileName = picked.file_name;
    folderName = "Anatomy";
  } else {
    format =
      formatPreference === "mixed"
        ? FORMATS[Math.floor(Math.random() * FORMATS.length)]
        : formatPreference;
  }

  const formatInstruction = FORMAT_INSTRUCTIONS[format] ?? FORMAT_INSTRUCTIONS.open_ended;

  const formattedChunks = formatChunksForPrompt(chunks);
  const prevList =
    previousQuestions.length > 0
      ? `\n\nDO NOT ask any of these again (each was already used in this quiz):\n${previousQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n`
      : "";

  const diagramNote =
    format === "anatomy_diagram"
      ? `\nThe learner answers on an interactive body diagram (front and back). They click exactly one of these muscle groups: ${ANATOMY_DIAGRAM_MUSCLE_LIST_PROMPT}. Ask which region is the primary answer for a movement or teaching scenario grounded in the chunks.\n`
      : "";

  const userMessage = `Source material:
---
${formattedChunks}
---

Parameters:
- Apparatus: ${apparatus}
- Topic: ${topic ?? "All"}
- Difficulty: ${difficulty}
- Question format: ${format}
${diagramNote}${prevList}
Generate one NEW ${format.replace(/_/g, " ")} question that is different from all of the above. ${formatInstruction}`;

  const response = await anthropic.messages.create({
    model: EXAMINER_MODEL,
    max_tokens: 1024,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  const parsed = parseJsonFromResponse<Record<string, unknown>>(text);

  if (!parsed.question || typeof parsed.question !== "string") {
    throw new Error("Claude did not return a valid question");
  }

  const elements = Array.isArray(parsed.expected_answer_elements)
    ? (parsed.expected_answer_elements as string[])
    : [];

  const base: GenerateQuestionSuccess = {
    format,
    question: parsed.question,
    expected_answer_elements: elements,
    source_chunks_used: chunks,
  };

  if (format === "anatomy_diagram") {
    const raw =
      typeof parsed.target_muscle === "string" ? parsed.target_muscle.trim() : "";
    const canonical = canonicalizeAnatomyDiagramMuscle(raw);
    if (!canonical) {
      throw new Error(
        `Invalid anatomy_diagram: target_muscle must be one of: ${ANATOMY_DIAGRAM_MUSCLE_LIST_PROMPT}. Received: ${raw || "(missing)"}`
      );
    }
    let els = Array.isArray(parsed.expected_answer_elements)
      ? (parsed.expected_answer_elements as unknown[])
          .map((x) => String(x).trim())
          .filter(Boolean)
      : [];
    const hasCanonical = els.some(
      (e) => canonicalizeAnatomyDiagramMuscle(e) === canonical
    );
    if (!hasCanonical) {
      els = [canonical, ...els];
    }
    return {
      ...base,
      format: "anatomy_diagram",
      target_muscle: canonical,
      correct_answer: canonical,
      expected_answer_elements: els.length ? els : [canonical],
    };
  }

  if (format === "anatomy_multiple_choice") {
    if (Array.isArray(parsed.options)) {
      const rawOpts = (parsed.options as unknown[]).map((x) => String(x).trim()).filter(Boolean);
      const correctOpt =
        typeof parsed.correct_option === "string" ? parsed.correct_option.trim() : "";
      if (rawOpts.length === 4 && correctOpt && rawOpts.includes(correctOpt)) {
        return {
          ...base,
          format: "anatomy_multiple_choice",
          anatomy_options: rawOpts,
          correct_option: correctOpt,
          correct_answer: correctOpt,
          expected_answer_elements: elements.length ? elements : [correctOpt],
        };
      }
    }
    throw new Error(
      "Invalid anatomy_multiple_choice: need exactly four options and correct_option equal to one of them."
    );
  }

  if (parsed.format === "multiple_choice" && Array.isArray(parsed.options)) {
    const options = parsed.options as McOption[];
    if (options.length > 0 && parsed.correct_id) {
      return { ...base, options, correct_id: String(parsed.correct_id) };
    }
  }

  if (parsed.format === "fill_blank" && parsed.correct_answer) {
    return {
      ...base,
      correct_answer: String(parsed.correct_answer),
    };
  }

  if (
    (parsed.format === "matching" || parsed.format === "diagram_matching") &&
    Array.isArray(parsed.pairs) &&
    Array.isArray(parsed.left_items) &&
    Array.isArray(parsed.right_items)
  ) {
    const isDiagram = format === "diagram_matching";
    return {
      ...base,
      format: isDiagram ? "diagram_matching" : "matching",
      pairs: parsed.pairs as MatchingPair[],
      left_items: parsed.left_items as string[],
      right_items: parsed.right_items as string[],
      image_file_name: isDiagram ? imageFileName : undefined,
      folder_name: isDiagram ? folderName : undefined,
    };
  }

  return base;
}

export interface EvaluateAnswerOptions {
  format?:
    | "open_ended"
    | "multiple_choice"
    | "fill_blank"
    | "matching"
    | "diagram_matching"
    | "anatomy_multiple_choice"
    | "anatomy_diagram";
  correct_id?: string;
  correct_answer?: string;
  pairs?: MatchingPair[];
  options?: McOption[];
  /** Canonical diagram region the learner highlighted (Clara quiz id), if known */
  diagram_selected_muscle?: string | null;
}

async function evaluateAnatomyDiagramTypedRecall(
  question: string,
  userAnswer: string,
  expectedElements: string[],
  canonTarget: string,
  diagramSelectedMuscle: string | null | undefined
): Promise<EvaluationResult> {
  const syn = [...new Set([canonTarget, ...expectedElements])].filter(Boolean);
  const selected =
    diagramSelectedMuscle?.trim() || "(not provided — grade typed answer only)";

  const user = await anthropic.messages.create({
    model: EXAMINER_MODEL,
    max_tokens: 512,
    system: ANATOMY_DIAGRAM_RECALL_EVAL_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Canonical muscle GROUP (official answer): ${canonTarget}

Acceptable synonyms and related terms from course materials (use for matching):
${syn.join(", ")}

Quiz question (do not repeat the official answer unless it already appears in the question):
${question}

Learner typed:
${userAnswer.trim() || "(empty)"}

Learner highlighted diagram region (canonical label):
${selected}`,
      },
    ],
  });

  const text =
    user.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  try {
    const parsed = parseJsonFromResponse<{
      result: string;
      feedback: string;
      correct_answer: string | null;
    }>(text);
    const r = parsed.result?.toLowerCase();
    if (r !== "correct" && r !== "partial" && r !== "incorrect") {
      throw new Error("invalid result");
    }
    const feedback =
      typeof parsed.feedback === "string" && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : "Could not grade this answer.";
    let correct_answer: string | null =
      parsed.correct_answer === null || parsed.correct_answer === undefined
        ? null
        : String(parsed.correct_answer).trim() || null;
    if (r === "correct") {
      correct_answer = null;
    } else if (!correct_answer) {
      correct_answer = canonTarget;
    }
    return { result: r, feedback, correct_answer };
  } catch {
    return {
      result: "incorrect",
      feedback:
        "We could not grade this answer automatically. Compare your response to the expected muscle group in your manual.",
      correct_answer: canonTarget,
    };
  }
}

export async function evaluateAnswer(
  question: string,
  userAnswer: string,
  expectedElements: string[],
  isRetry: boolean,
  _userId: string,
  options?: EvaluateAnswerOptions
): Promise<EvaluationResult> {
  const format = options?.format ?? "open_ended";

  if (format === "anatomy_diagram") {
    const rawCorrect =
      options?.correct_answer?.trim() ||
      expectedElements.find((x) => canonicalizeAnatomyDiagramMuscle(x)) ||
      expectedElements[0] ||
      "";
    const canonTarget =
      canonicalizeAnatomyDiagramMuscle(rawCorrect) ?? rawCorrect.trim();
    if (!canonTarget) {
      return {
        result: "incorrect",
        feedback:
          "Could not determine the correct muscle group for this question.",
        correct_answer: null,
      };
    }
    return evaluateAnatomyDiagramTypedRecall(
      question,
      userAnswer,
      expectedElements,
      canonTarget,
      options?.diagram_selected_muscle ?? null
    );
  }

  if (format === "anatomy_multiple_choice" && options?.correct_answer) {
    const correct = options.correct_answer.trim();
    const user = userAnswer.trim();
    if (user === correct) {
      return {
        result: "correct",
        feedback: "Correct. That label matches the structure described in your anatomy materials.",
        correct_answer: null,
      };
    }
    return {
      result: "incorrect",
      feedback: `Incorrect. The correct answer is: ${correct}. Review the labeled muscles and structures in your ingested anatomy diagrams and text.`,
      correct_answer: correct,
    };
  }

  if (format === "multiple_choice" && options?.correct_id !== undefined) {
    const correct = options.correct_id.trim().toLowerCase();
    const user = userAnswer.trim().toLowerCase();
    const isCorrect = user === correct;
    const optionText =
      options.options?.find((o) => o.id.toLowerCase() === correct)?.text ?? options.correct_id;
    const userOptionText =
      options.options?.find((o) => o.id.toLowerCase() === user)?.text;

    if (isCorrect) {
      return {
        result: "correct",
        feedback: "Correct.",
        correct_answer: null,
      };
    }

    const mcFeedbackResponse = await anthropic.messages.create({
      model: EXAMINER_MODEL,
      max_tokens: 384,
      system: `You are a Balanced Body exam examiner. The user got a multiple choice question wrong. They need to LEARN why the correct answer is right. In 1–3 sentences, explain why the correct answer is correct and what they might have misunderstood. Be concise and educational. Return ONLY valid JSON: {"feedback": "string"}`,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\nCorrect answer: ${optionText}\nUser chose: ${userOptionText ?? userAnswer}\nExplain why the correct answer is right.`,
        },
      ],
    });
    const mcFeedbackText =
      mcFeedbackResponse.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? (block as { text: string }).text : ""))
        .join("") ?? "";
    let mcExplanatoryFeedback = `Incorrect. The correct answer is: ${optionText}`;
    try {
      const parsed = parseJsonFromResponse<{ feedback: string }>(mcFeedbackText);
      if (typeof parsed.feedback === "string" && parsed.feedback.trim()) {
        mcExplanatoryFeedback = parsed.feedback.trim();
      }
    } catch {
      /* use fallback */
    }

    return {
      result: "incorrect",
      feedback: mcExplanatoryFeedback,
      correct_answer: optionText,
    };
  }

  if (
    (format === "matching" || format === "diagram_matching") &&
    options?.pairs &&
    options.pairs.length > 0
  ) {
    let userPairs: [string, string][];
    try {
      userPairs = JSON.parse(userAnswer) as [string, string][];
    } catch {
      return {
        result: "incorrect",
        feedback: "Invalid matching format.",
        correct_answer: options.pairs
          .map((p) => `${p.left} → ${p.right}`)
          .join("; "),
      };
    }
    const correctMap = new Map(
      options.pairs.map((p) => [p.left.trim().toLowerCase(), p.right.trim().toLowerCase()])
    );
    const allCorrect = userPairs.every(
      ([left, right]) => correctMap.get(left.trim().toLowerCase()) === right.trim().toLowerCase()
    );
    const correctAnswerStr = options.pairs
      .map((p) => `${p.left} → ${p.right}`)
      .join("; ");

    if (allCorrect) {
      return {
        result: "correct",
        feedback: "Correct.",
        correct_answer: null,
      };
    }

    const userPairsStr = userPairs
      .map(([l, r]) => `${l} → ${r}`)
      .join("; ");
    const correctPairsStr = options.pairs
      .map((p) => `${p.left} → ${p.right}`)
      .join("; ");
    const feedbackResponse = await anthropic.messages.create({
      model: EXAMINER_MODEL,
      max_tokens: 512,
      system: MATCHING_FEEDBACK_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: ${question}\n\nCorrect pairs:\n${correctPairsStr}\n\nUser's answer:\n${userPairsStr}\n\nWrite explanatory feedback.`,
        },
      ],
    });
    const feedbackText =
      feedbackResponse.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? (block as { text: string }).text : ""))
        .join("") ?? "";
    let explanatoryFeedback = "One or more matches are incorrect.";
    try {
      const parsed = parseJsonFromResponse<{ feedback: string }>(feedbackText);
      if (typeof parsed.feedback === "string" && parsed.feedback.trim()) {
        explanatoryFeedback = parsed.feedback.trim();
      }
    } catch {
      /* use fallback */
    }

    return {
      result: "incorrect",
      feedback: explanatoryFeedback,
      correct_answer: correctAnswerStr,
    };
  }

  const userMessage = `Question: ${question}

Expected answer elements: ${JSON.stringify(expectedElements)}

User's answer: ${userAnswer}

Is this a retry attempt? ${isRetry ? "Yes" : "No"}

Evaluate and return JSON only.`;

  const response = await anthropic.messages.create({
    model: EXAMINER_MODEL,
    max_tokens: 1024,
    system: EVALUATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? (block as { text: string }).text : ""))
      .join("") ?? "";

  const parsed = parseJsonFromResponse<{
    result: "correct" | "partial" | "incorrect";
    feedback: string;
    correct_answer: string | null;
  }>(text);

  const validResults = ["correct", "partial", "incorrect"] as const;
  const result = validResults.includes(parsed.result)
    ? parsed.result
    : "incorrect";

  return {
    result,
    feedback: typeof parsed.feedback === "string" ? parsed.feedback : "",
    correct_answer:
      parsed.correct_answer != null ? String(parsed.correct_answer) : null,
  };
}
