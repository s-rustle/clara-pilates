"use client";

import { useState } from "react";
import type { SessionFeedback } from "@/types";
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

export default function SessionFeedbackCard({
  feedback,
  onRevise,
}: SessionFeedbackCardProps) {
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);

  const pl = normScore(feedback.progression_logic.score);
  const plBadge =
    pl === "sound"
      ? { variant: "green" as const, label: "Sound" }
      : { variant: "yellow" as const, label: "Needs adjustment" };

  const cf = normScore(feedback.contraindication_flags.score);
  const nFlags = feedback.contraindication_flags.flags.length;
  const cfBadge =
    cf === "none" || nFlags === 0
      ? { variant: "green" as const, label: "None flagged" }
      : { variant: "red" as const, label: `${nFlags} flags` };

  const va = normScore(feedback.volume_assessment.score);
  const vaBadge =
    va === "appropriate"
      ? { variant: "green" as const, label: "Appropriate" }
      : { variant: "yellow" as const, label: "Needs adjustment" };

  const mb = normScore(feedback.muscle_group_balance.score);
  const mbBadge =
    mb === "balanced"
      ? { variant: "green" as const, label: "Balanced" }
      : { variant: "yellow" as const, label: "Imbalanced" };

  const sa = normScore(feedback.sequence_alignment.score);
  const saBadge =
    sa === "aligned"
      ? { variant: "green" as const, label: "Aligned" }
      : sa === "partially_aligned"
        ? { variant: "yellow" as const, label: "Partially aligned" }
        : { variant: "grey" as const, label: "Not verified" };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold text-clara-strong">
        Clara&apos;s feedback
      </h3>

      <dl className="space-y-3 text-sm">
        <DimensionRow
          label="Progression Logic"
          badgeVariant={plBadge.variant}
          badgeLabel={plBadge.label}
          note={feedback.progression_logic.note}
        />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-bold text-clara-strong">Contraindication Flags</dt>
            <Badge variant={cfBadge.variant}>{cfBadge.label}</Badge>
            {nFlags > 0 && (
              <button
                type="button"
                onClick={() => setFlagsOpen((o) => !o)}
                className="text-xs text-clara-primary hover:underline"
              >
                {flagsOpen ? "Hide list" : "Show flags"}
              </button>
            )}
          </div>
          {flagsOpen && nFlags > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-clara-deep">
              {feedback.contraindication_flags.flags.map((f, i) => (
                <li key={i}>
                  <span className="font-bold text-clara-strong">{f.exercise_name}:</span>{" "}
                  {f.flag} — {f.recommendation}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-bold text-clara-strong">Volume Assessment</dt>
            <Badge variant={vaBadge.variant}>{vaBadge.label}</Badge>
            {feedback.volume_assessment.flagged_exercises.length > 0 && (
              <button
                type="button"
                onClick={() => setVolumeOpen((o) => !o)}
                className="text-xs text-clara-primary hover:underline"
              >
                {volumeOpen ? "Hide flagged" : "Show flagged"}
              </button>
            )}
          </div>
          {feedback.volume_assessment.note.trim() ? (
            <div className="mt-1 text-clara-deep">
              <MarkdownBody>{feedback.volume_assessment.note}</MarkdownBody>
            </div>
          ) : null}
          {volumeOpen &&
            feedback.volume_assessment.flagged_exercises.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-clara-deep">
                {feedback.volume_assessment.flagged_exercises.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <dt className="font-bold text-clara-strong">Muscle Group Balance</dt>
            <Badge variant={mbBadge.variant}>{mbBadge.label}</Badge>
            {feedback.muscle_group_balance.gaps.length > 0 && (
              <button
                type="button"
                onClick={() => setGapsOpen((o) => !o)}
                className="text-xs text-clara-primary hover:underline"
              >
                {gapsOpen ? "Hide gaps" : "Show gaps"}
              </button>
            )}
          </div>
          {feedback.muscle_group_balance.note.trim() ? (
            <div className="mt-1 text-clara-deep">
              <MarkdownBody>{feedback.muscle_group_balance.note}</MarkdownBody>
            </div>
          ) : null}
          {gapsOpen && feedback.muscle_group_balance.gaps.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-clara-deep">
              {feedback.muscle_group_balance.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </div>
        <DimensionRow
          label="Sequence Alignment"
          badgeVariant={saBadge.variant}
          badgeLabel={saBadge.label}
          note={feedback.sequence_alignment.note}
        />
      </dl>

      <div className="rounded-lg bg-clara-surface p-4 text-sm leading-relaxed shadow-inner">
        <MarkdownBody>{feedback.overall}</MarkdownBody>
      </div>

      {feedback.suggested_adjustments.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold text-clara-strong">
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
          variant="secondary"
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
        <dt className="font-bold text-clara-strong">{label}</dt>
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
