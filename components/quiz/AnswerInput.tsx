"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import EvaluationCard from "./EvaluationCard";
import type { McOption, MatchingPair } from "@/types";

type QuestionFormat =
  | "open_ended"
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "diagram_matching"
  | "anatomy_multiple_choice"
  | "anatomy_diagram";

interface AnswerInputProps {
  format?: QuestionFormat;
  onSubmit: (answer: string, isRetry: boolean) => void;
  isLoading: boolean;
  showRetry: boolean;
  result?: "correct" | "partial" | "incorrect" | null;
  feedback?: string;
  correctAnswer?: string | null;
  onNext: () => void;
  disabled?: boolean;
  options?: McOption[];
  correctId?: string;
  leftItems?: string[];
  rightItems?: string[];
  pairs?: MatchingPair[];
  requestExplanation?: () => Promise<string>;
  /** Plain-text MC options (e.g. anatomy); when used with matching format, prefer dedicated UI in QuestionCard. */
  option_strings?: string[];
}

function anatomyRecallBadgeLabel(
  result: "correct" | "partial" | "incorrect"
): string {
  if (result === "correct") return "✓ Correct";
  if (result === "partial") return "~ Close";
  return "✗ Incorrect";
}

export default function AnswerInput({
  format = "open_ended",
  onSubmit,
  isLoading,
  showRetry,
  result,
  feedback,
  correctAnswer,
  onNext,
  disabled = false,
  options,
  correctId,
  leftItems,
  rightItems,
  pairs,
  requestExplanation,
}: AnswerInputProps) {
  const [answer, setAnswer] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [matchingSelections, setMatchingSelections] = useState<Record<string, string>>({});

  const showEvaluation =
    result &&
    (result === "correct" ||
      result === "incorrect" ||
      (result === "partial" && !showRetry));
  const inputDisabled = disabled || !!showEvaluation;

  /** Anatomy MC / diagram: interaction + submit on QuestionCard; only evaluation appears here. */
  if (format === "anatomy_multiple_choice" || format === "anatomy_diagram") {
    if (showEvaluation && result && feedback !== undefined) {
      const showCorrectAnswer =
        result === "incorrect" || (result === "partial" && !showRetry);
      const isDiagramRecall = format === "anatomy_diagram";
      return (
        <EvaluationCard
          result={result}
          feedback={feedback}
          correctAnswer={showCorrectAnswer ? correctAnswer ?? undefined : undefined}
          onNext={onNext}
          requestExplanation={requestExplanation}
          badgeLabel={isDiagramRecall ? anatomyRecallBadgeLabel(result) : undefined}
          nextButtonLabel={isDiagramRecall ? "Next" : undefined}
        />
      );
    }
    return null;
  }

  const handleSubmit = (isRetry: boolean) => {
    if (format === "multiple_choice") {
      if (selectedId) onSubmit(selectedId, isRetry);
    } else if (format === "matching" && leftItems && rightItems) {
      const pairArray: [string, string][] = leftItems.map((left) => [
        left,
        matchingSelections[left] ?? "",
      ]);
      onSubmit(JSON.stringify(pairArray), isRetry);
    } else if (answer.trim()) {
      onSubmit(answer.trim(), isRetry);
    }
  };

  const canSubmit =
    format === "multiple_choice"
      ? !!selectedId
      : format === "matching"
        ? leftItems?.every((l) => matchingSelections[l])
        : !!answer.trim();

  if (showEvaluation && result && feedback !== undefined) {
    const showCorrectAnswer =
      result === "incorrect" || (result === "partial" && !showRetry);
    return (
      <EvaluationCard
        result={result}
        feedback={feedback}
        correctAnswer={showCorrectAnswer ? correctAnswer ?? undefined : undefined}
        onNext={onNext}
        requestExplanation={requestExplanation}
      />
    );
  }

  if (showRetry && format === "open_ended") {
    return (
      <div className="flex flex-col gap-3">
        <Badge variant="yellow">Not quite — try again</Badge>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={inputDisabled || isLoading}
          rows={5}
          className="w-full rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          variant="primary"
          onClick={() => handleSubmit(true)}
          disabled={isLoading || !answer.trim()}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Evaluating…
            </span>
          ) : (
            "Submit Answer"
          )}
        </Button>
      </div>
    );
  }

  if (format === "multiple_choice" && options) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors ${
                selectedId === opt.id
                  ? "border-clara-primary bg-clara-border/30"
                  : "border-clara-border bg-clara-bg hover:border-clara-border"
              }`}
            >
              <input
                type="radio"
                name="mc-answer"
                value={opt.id}
                checked={selectedId === opt.id}
                onChange={() => setSelectedId(opt.id)}
                disabled={inputDisabled || isLoading}
                className="h-4 w-4 border-clara-border text-clara-accent focus:ring-clara-accent/40"
              />
              <span className="text-clara-deep">
                {String.fromCharCode(96 + options.indexOf(opt) + 1)}. {opt.text}
              </span>
            </label>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => handleSubmit(false)}
          disabled={isLoading || !selectedId}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Evaluating…
            </span>
          ) : (
            "Submit Answer"
          )}
        </Button>
      </div>
    );
  }

  if ((format === "matching" || format === "diagram_matching") && leftItems && rightItems) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {leftItems.map((left) => (
            <div key={left} className="flex items-center gap-2">
              <span className="min-w-[120px] text-sm font-medium text-clara-deep">
                {left}
              </span>
              <span className="text-clara-muted">→</span>
              <select
                value={matchingSelections[left] ?? ""}
                onChange={(e) =>
                  setMatchingSelections((prev) => ({
                    ...prev,
                    [left]: e.target.value,
                  }))
                }
                disabled={inputDisabled || isLoading}
                className="flex-1 rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select match...</option>
                {rightItems.map((right) => (
                  <option key={right} value={right}>
                    {right}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => handleSubmit(false)}
          disabled={isLoading || !leftItems.every((l) => matchingSelections[l])}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Evaluating…
            </span>
          ) : (
            "Submit Answer"
          )}
        </Button>
      </div>
    );
  }

  if (format === "fill_blank") {
    return (
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer..."
          disabled={inputDisabled || isLoading}
          className="w-full rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Button
          variant="primary"
          onClick={() => handleSubmit(false)}
          disabled={isLoading || !answer.trim()}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Evaluating…
            </span>
          ) : (
            "Submit Answer"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Type your answer..."
        disabled={inputDisabled || isLoading}
        rows={5}
        className="w-full rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <Button
        variant="primary"
        onClick={() => handleSubmit(false)}
        disabled={isLoading || !answer.trim()}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            Evaluating…
          </span>
        ) : (
          "Submit Answer"
        )}
      </Button>
    </div>
  );
}
