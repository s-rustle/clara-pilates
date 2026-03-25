"use client";

import { useState } from "react";
import type { SessionFeedback } from "@/types";
import { formatExerciseNameForDisplay } from "@/lib/curriculum/exerciseNames";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import MarkdownBody from "@/components/ui/MarkdownBody";

export interface SessionFeedbackCardProps {
  feedback: SessionFeedback;
  /** Omit for read-only (e.g. history modal). */
  onRevise?: () => void;
}

function normScore(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "_");
}

function badgeForSessionScore(
  score: string,
  positive: string[]
): { variant: "green" | "yellow" | "red" | "grey"; label: string } {
  const n = normScore(score);
  if (positive.some((p) => normScore(p) === n))
    return { variant: "green", label: score };
  if (n.includes("not_verified") || n.includes("unknown"))
    return { variant: "grey", label: "Not verified" };
  return { variant: "yellow", label: score };
}

export default function SessionFeedbackCard({
  feedback,
  onRevise,
}: SessionFeedbackCardProps) {
  const [flagsOpen, setFlagsOpen] = useState(false);

  const af = badgeForSessionScore(feedback.alignment_and_form.score, [
    "sound",
  ]);
  const br = badgeForSessionScore(feedback.breathing.score, ["sound"]);
  const cc = badgeForSessionScore(feedback.cueing_clarity.score, ["clear"]);
  const cp = badgeForSessionScore(feedback.client_progression.score, [
    "sound",
  ]);

  const sn = normScore(feedback.safety.score);
  const safetyBadge =
    sn === "appropriate"
      ? ({ variant: "green" as const, label: "Appropriate" })
      : sn.includes("not_verified")
        ? ({ variant: "grey" as const, label: "Not verified" })
        : ({ variant: "yellow" as const, label: feedback.safety.score });

  const nFlags = feedback.safety.flags.length;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-clara-deep">
        Clara&apos;s feedback
      </h3>

      <dl className="space-y-3 text-sm">
        <DimensionRow
          label="Alignment & form"
          badgeVariant={af.variant}
          badgeLabel={af.label}
          note={feedback.alignment_and_form.note}
        />
        <DimensionRow
          label="Breathing"
          badgeVariant={br.variant}
          badgeLabel={br.label}
          note={feedback.breathing.note}
        />
        <DimensionRow
          label="Cueing clarity"
          badgeVariant={cc.variant}
          badgeLabel={cc.label}
          note={feedback.cueing_clarity.note}
        />
        <DimensionRow
          label="Client progression"
          badgeVariant={cp.variant}
          badgeLabel={cp.label}
          note={feedback.client_progression.note}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-bold text-clara-deep">Safety</dt>
            <Badge variant={safetyBadge.variant}>{safetyBadge.label}</Badge>
            {nFlags > 0 && (
              <button
                type="button"
                onClick={() => setFlagsOpen((o) => !o)}
                className="text-xs text-clara-primary hover:underline"
              >
                {flagsOpen ? "Hide flags" : "Show flags"}
              </button>
            )}
          </div>
          {feedback.safety.note.trim() ? (
            <dd className="mt-1 text-clara-deep">
              <MarkdownBody>{feedback.safety.note}</MarkdownBody>
            </dd>
          ) : null}
          {flagsOpen && nFlags > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-clara-deep">
              {feedback.safety.flags.map((f, i) => (
                <li key={i}>
                  <span className="font-bold text-clara-deep">
                    {formatExerciseNameForDisplay(f.exercise_name)}:
                  </span>{" "}
                  {f.concern} — {f.recommendation}
                </li>
              ))}
            </ul>
          )}
        </div>
      </dl>

      <div className="rounded-none border border-clara-border bg-clara-surface p-4 text-sm leading-relaxed">
        <MarkdownBody>{feedback.overall}</MarkdownBody>
      </div>

      {feedback.suggested_adjustments.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-clara-deep">
            Suggested Adjustments
          </h4>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-clara-deep">
            {feedback.suggested_adjustments.map((adj, i) => (
              <li key={i}>
                <MarkdownBody>{adj}</MarkdownBody>
              </li>
            ))}
          </ol>
        </div>
      )}

      {onRevise && (
        <Button
          type="button"
          variant="ghost"
          onClick={onRevise}
          className="w-full"
        >
          Revise Routine
        </Button>
      )}
    </div>
  );
}

function DimensionRow({
  label,
  badgeVariant,
  badgeLabel,
  note,
}: {
  label: string;
  badgeVariant: "green" | "yellow" | "red" | "grey";
  badgeLabel: string;
  note: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <dt className="font-bold text-clara-deep">{label}</dt>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>
      {note ? (
        <dd className="mt-1 text-clara-deep">
          <MarkdownBody>{note}</MarkdownBody>
        </dd>
      ) : null}
    </div>
  );
}
