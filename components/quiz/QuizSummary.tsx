"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

interface QuizSummaryProps {
  score: number;
  total: number;
  sessionId: string;
  apparatus?: string;
  topic?: string | null;
  onTryAgain: () => void;
}

export default function QuizSummary({
  score,
  total,
  sessionId,
  apparatus,
  topic,
  onTryAgain,
}: QuizSummaryProps) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <Card>
      <div className="flex flex-col gap-6">
        <p className="text-xl font-bold text-clara-deep">
          {score} of {total} correct ({percent}%)
        </p>
        {(apparatus || topic) && (
          <p className="text-sm text-clara-deep">
            {[apparatus, topic].filter(Boolean).join(" — ")}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href="/study">
            <Button variant="secondary">Study weak areas</Button>
          </Link>
          <Button variant="primary" onClick={onTryAgain}>
            Try again
          </Button>
        </div>
      </div>
    </Card>
  );
}
