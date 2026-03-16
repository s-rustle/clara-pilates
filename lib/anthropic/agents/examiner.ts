import { queryRAG } from "../rag";
import { OUT_OF_SCOPE_INSTRUCTION } from "./boundaries";

export const EXAMINER_SYSTEM_PROMPT = `You are the Examiner Agent. Generate exam-style questions and evaluate answers. Ground all content in source material. Be precise; do not accept vague answers.

${OUT_OF_SCOPE_INSTRUCTION}`;

export interface QuestionResult {
  question: string;
  expected_answer_elements: string[];
}

export interface EvaluationResult {
  result: "correct" | "partial" | "incorrect";
  feedback: string;
  correct_answer?: string;
}

export async function generateQuestion(
  apparatus: string,
  topic: string | null,
  _difficulty: string,
  _previousQuestions: string[],
  userId: string
): Promise<QuestionResult> {
  const { chunks } = await queryRAG(
    `${apparatus} ${topic ?? ""}`.trim(),
    userId
  );

  if (chunks.length === 0) {
    return {
      question: "No source material found for this topic.",
      expected_answer_elements: [],
    };
  }

  return {
    question: "What is the starting position for the Hundred on the mat?",
    expected_answer_elements: ["supine", "knees bent", "feet on mat"],
  };
}

export async function evaluateAnswer(
  question: string,
  userAnswer: string,
  expectedElements: string[],
  _isRetry: boolean,
  _userId: string
): Promise<EvaluationResult> {
  const answerLower = userAnswer.toLowerCase();
  const matches = expectedElements.filter((el) =>
    answerLower.includes(el.toLowerCase())
  );

  if (matches.length === expectedElements.length && expectedElements.length > 0) {
    return {
      result: "correct",
      feedback: "Correct. Your answer covers the key points.",
    };
  }

  if (matches.length > 0) {
    return {
      result: "partial",
      feedback: "Partially correct. Consider adding more detail.",
      correct_answer: expectedElements.join(", "),
    };
  }

  return {
    result: "incorrect",
    feedback: "Incorrect. Review the source material.",
    correct_answer: expectedElements.join(", "),
  };
}
