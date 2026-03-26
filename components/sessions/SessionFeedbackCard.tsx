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

  const flow = feedback.session_flow_ergonomics
    ? badgeForSessionScore(feedback.session_flow_ergonomics.score, ["sound"])
    : null;

  const sp = feedback.special_populations;
  const spHasDetail = sp
    ? sp.flags_detected.length > 0 ||
      sp.contraindications_this_session.trim() !== "" ||
      sp.exercises_modify_or_remove.length > 0 ||
      sp.curriculum_substitutions.length > 0 ||
      Boolean(sp.trimester_or_condition_notes?.trim())
    : false;

  return (
    <div className="space-y-4">
      {feedback.special_populations?.applies && (
        <div
          className="rounded-none border-2 border-amber-600/80 bg-amber-50 p-4 text-sm shadow-sm dark:border-amber-500/70 dark:bg-amber-950/40"
          role="region"
          aria-label="Special populations review"
        >
          <h3 className="text-base font-semibold text-amber-950 dark:text-amber-100">
            Special populations — review before this session
          </h3>
          {sp!.flags_detected.length > 0 && (
            <p className="mt-2 text-amber-950/90 dark:text-amber-50/90">
              <span className="font-semibold">Detected: </span>
              {sp!.flags_detected.join("; ")}
            </p>
          )}
          {!!sp!.contraindications_this_session.trim() && (
            <div className="mt-3">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Contraindications for this session
              </p>
              <div className="mt-1 text-clara-deep">
                <MarkdownBody>{sp!.contraindications_this_session}</MarkdownBody>
              </div>
            </div>
          )}
          {sp!.exercises_modify_or_remove.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Modify or remove
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-clara-deep">
                {sp!.exercises_modify_or_remove.map((line, i) => (
                  <li key={i}>
                    <MarkdownBody>{line}</MarkdownBody>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sp!.curriculum_substitutions.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Balanced Body substitutions
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-clara-deep">
                {sp!.curriculum_substitutions.map((line, i) => (
                  <li key={i}>
                    <MarkdownBody>{line}</MarkdownBody>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!sp!.trimester_or_condition_notes?.trim() && (
            <div className="mt-3">
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Condition-specific guidance
              </p>
              <div className="mt-1 text-clara-deep">
                <MarkdownBody>{sp!.trimester_or_condition_notes}</MarkdownBody>
              </div>
            </div>
          )}
          {!spHasDetail && (
            <p className="mt-3 text-amber-950/90 dark:text-amber-50/90">
              Review client considerations alongside the exercises below before
              teaching.
            </p>
          )}
        </div>
      )}

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
          {!!feedback.safety.note.trim() && (
            <dd className="mt-1 text-clara-deep">
              <MarkdownBody>{feedback.safety.note}</MarkdownBody>
            </dd>
          )}
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

      {feedback.session_flow_ergonomics && (
        <div className="rounded-none border border-clara-border bg-clara-surface/60 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-clara-deep">
              Session flow &amp; ergonomics
            </h4>
            <Badge variant={flow!.variant}>{flow!.label}</Badge>
          </div>
          {!!feedback.session_flow_ergonomics.note.trim() && (
            <div className="mt-2 text-clara-deep">
              <MarkdownBody>{feedback.session_flow_ergonomics.note}</MarkdownBody>
            </div>
          )}
          {feedback.session_flow_ergonomics.transition_issues.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-clara-muted">
                Transition flags
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-clara-deep">
                {feedback.session_flow_ergonomics.transition_issues.map(
                  (t, i) => (
                    <li key={i}>
                      <MarkdownBody>{t}</MarkdownBody>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}
          {feedback.session_flow_ergonomics.suggested_reorder.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-clara-muted">
                Suggested reorder
              </p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-clara-deep">
                {feedback.session_flow_ergonomics.suggested_reorder.map(
                  (name, i) => (
                    <li key={i}>{formatExerciseNameForDisplay(name)}</li>
                  )
                )}
              </ol>
            </div>
          )}
        </div>
      )}

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
      {!!note?.trim() && (
        <dd className="mt-1 text-clara-deep">
          <MarkdownBody>{note}</MarkdownBody>
        </dd>
      )}
    </div>
  );
}
