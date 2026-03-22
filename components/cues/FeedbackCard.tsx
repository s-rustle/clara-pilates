"use client";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { CueDimension, CueFeedback } from "@/types";

const DIMENSION_ROWS: {
  key: keyof Pick<
    CueFeedback,
    | "anatomical_accuracy"
    | "starting_position"
    | "breath_cue"
    | "precaution_language"
    | "client_accessibility"
  >;
  label: string;
}[] = [
  { key: "anatomical_accuracy", label: "Anatomical Accuracy" },
  { key: "starting_position", label: "Starting Position" },
  { key: "breath_cue", label: "Breath Cue" },
  { key: "precaution_language", label: "Precaution Language" },
  { key: "client_accessibility", label: "Client Accessibility" },
];

const GREEN_SCORES = new Set([
  "correct",
  "clear",
  "present",
  "appropriate",
]);

const YELLOW_SCORES = new Set([
  "needs_refinement",
  "missing_elements",
  "needs_adjustment",
]);

const RED_SCORES = new Set(["absent", "missing", "incorrect"]);

function scoreBadgeVariant(
  score: string
): "green" | "yellow" | "red" | "grey" {
  const s = score.toLowerCase();
  if (GREEN_SCORES.has(s)) return "green";
  if (YELLOW_SCORES.has(s)) return "yellow";
  if (RED_SCORES.has(s)) return "red";
  return "grey";
}

function formatScoreLabel(score: string): string {
  if (!score) return "—";
  return score
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function stripBetterVersionPrefix(text: string): string {
  return text.trim().replace(/^here is a better version:\s*/i, "").trim();
}

interface FeedbackCardProps {
  feedback: CueFeedback;
  onTryAgain: () => void;
}

function DimensionRow({ label, dim }: { label: string; dim: CueDimension }) {
  const variant = scoreBadgeVariant(dim.score);
  return (
    <div className="flex flex-col gap-1 border-b border-clara-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-clara-ink">{label}</span>
        <Badge variant={variant}>{formatScoreLabel(dim.score)}</Badge>
      </div>
      {dim.note ? (
        <p className="text-xs text-clara-deep">{dim.note}</p>
      ) : null}
    </div>
  );
}

export default function FeedbackCard({ feedback, onTryAgain }: FeedbackCardProps) {
  const betterBody = stripBetterVersionPrefix(feedback.better_version);

  return (
    <Card>
      <div className="flex flex-col gap-1">
        {DIMENSION_ROWS.map(({ key, label }) => (
          <DimensionRow key={key} label={label} dim={feedback[key]} />
        ))}
      </div>

      {feedback.overall ? (
        <p className="mt-4 text-sm text-clara-deep">{feedback.overall}</p>
      ) : null}

      <div className="mt-4 rounded-md bg-clara-surface p-4 ring-1 ring-clara-border/80">
        <p className="mb-2 text-sm font-medium text-clara-strong">
          Here is a better version:
        </p>
        <p className="text-sm italic text-clara-strong">
          {betterBody || "—"}
        </p>
      </div>

      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={onTryAgain}>
          Try again
        </Button>
      </div>
    </Card>
  );
}
