"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import MarkdownBody from "@/components/ui/MarkdownBody";

interface EvaluationCardProps {
  result: "correct" | "partial" | "incorrect";
  feedback: string;
  correctAnswer?: string;
  onNext: () => void;
  requestExplanation?: () => Promise<string>;
  /** When set, replaces the default Correct / Partial / Incorrect badge label */
  badgeLabel?: string;
  nextButtonLabel?: string;
}

const BADGE_VARIANTS: Record<
  "correct" | "partial" | "incorrect",
  "green" | "yellow" | "red"
> = {
  correct: "green",
  partial: "yellow",
  incorrect: "red",
};

export default function EvaluationCard({
  result,
  feedback,
  correctAnswer,
  onNext,
  requestExplanation,
  badgeLabel,
  nextButtonLabel = "Next Question",
}: EvaluationCardProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const handleExplain = async () => {
    if (!requestExplanation || explanationLoading) return;
    setExplanationLoading(true);
    try {
      const text = await requestExplanation();
      setExplanation(text);
    } catch {
      setExplanation("Could not load explanation.");
    } finally {
      setExplanationLoading(false);
    }
  };

  const showExplainButton =
    result === "correct" && requestExplanation && !explanation;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Badge variant={BADGE_VARIANTS[result]}>
          {badgeLabel ??
            result.charAt(0).toUpperCase() + result.slice(1)}
        </Badge>
        <MarkdownBody>{feedback}</MarkdownBody>
        {correctAnswer && (
          <div className="rounded-sm border border-clara-highlight bg-clara-surface p-3">
            <p className="text-xs font-bold text-clara-strong">
              Correct answer
            </p>
            <div className="mt-1">
              <MarkdownBody>{correctAnswer}</MarkdownBody>
            </div>
          </div>
        )}
        {showExplainButton && (
          <Button
            variant="secondary"
            onClick={handleExplain}
            disabled={explanationLoading}
          >
            {explanationLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Loading…
              </span>
            ) : (
              "Explain why"
            )}
          </Button>
        )}
        {explanation && (
          <div className="rounded-sm border border-clara-highlight bg-clara-bg p-3">
            <p className="text-xs font-bold text-clara-strong">Explanation</p>
            <div className="mt-1">
              <MarkdownBody>{explanation}</MarkdownBody>
            </div>
          </div>
        )}
        <Button variant="primary" onClick={onNext}>
          {nextButtonLabel}
        </Button>
      </div>
    </Card>
  );
}
