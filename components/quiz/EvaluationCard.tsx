"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

interface EvaluationCardProps {
  result: "correct" | "partial" | "incorrect";
  feedback: string;
  correctAnswer?: string;
  onNext: () => void;
  requestExplanation?: () => Promise<string>;
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
          {result.charAt(0).toUpperCase() + result.slice(1)}
        </Badge>
        <p className="text-clara-deep">{feedback}</p>
        {correctAnswer && (
          <div className="rounded-lg border border-clara-border bg-clara-surface p-3">
            <p className="text-xs font-medium text-clara-muted">
              Correct answer
            </p>
            <p className="mt-1 font-display font-semibold text-clara-strong">
              {correctAnswer}
            </p>
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
          <div className="rounded-lg border border-clara-border bg-clara-elevated p-3">
            <p className="text-xs font-medium text-clara-muted">Explanation</p>
            <p className="mt-1 text-sm text-clara-deep">{explanation}</p>
          </div>
        )}
        <Button variant="primary" onClick={onNext}>
          Next Question
        </Button>
      </div>
    </Card>
  );
}
