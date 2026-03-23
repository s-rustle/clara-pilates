"use client";

import type { ExerciseItem, SessionFeedback, SessionPlan, WarmUpMove } from "@/types";
import { formatExerciseNameForDisplay } from "@/lib/curriculum/exerciseNames";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SessionFeedbackCard from "./SessionFeedbackCard";

export interface SessionHistoryProps {
  sessions: SessionPlan[];
  onView?: (session: SessionPlan) => void;
}

function sessionTypeLabel(t: SessionPlan["session_type"]): string {
  return t === "teaching" ? "Teaching" : "Personal Practice";
}

function statusVariant(
  s: SessionPlan["status"]
): "green" | "yellow" | "grey" {
  if (s === "complete") return "green";
  if (s === "draft") return "yellow";
  return "grey";
}

function isSessionFeedback(raw: unknown): raw is SessionFeedback {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o.overall === "string" &&
    Array.isArray(o.suggested_adjustments) &&
    o.progression_logic != null &&
    typeof o.progression_logic === "object"
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function SessionHistory({ sessions, onView }: SessionHistoryProps) {
  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-lg font-bold text-clara-strong">
        Session history
      </h2>
      {sessions.length === 0 ? (
        <p className="rounded-sm border border-dashed border-clara-highlight bg-clara-bg/50 px-3 py-6 text-center text-sm text-clara-deep">
          No sessions logged yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-clara-highlight bg-clara-surface">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-clara-highlight bg-clara-bg/80">
                <th className="px-3 py-2 font-medium text-clara-strong">Date</th>
                <th className="px-3 py-2 font-medium text-clara-strong">
                  Apparatus
                </th>
                <th className="px-3 py-2 font-medium text-clara-strong">
                  Session type
                </th>
                <th className="px-3 py-2 font-medium text-clara-strong">Status</th>
                <th className="px-3 py-2 font-medium text-clara-strong">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-clara-highlight/80 last:border-0"
                >
                  <td className="px-3 py-2 text-clara-deep">
                    {formatDate(row.session_date)}
                  </td>
                  <td className="px-3 py-2 text-clara-deep">{row.apparatus}</td>
                  <td className="px-3 py-2 text-clara-deep">
                    {sessionTypeLabel(row.session_type)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={() => onView?.(row)}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function SessionReadOnlyModal({
  session,
  open,
  onClose,
}: {
  session: SessionPlan | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !session) return null;

  const feedback = isSessionFeedback(session.feedback) ? session.feedback : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-view-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-clara-deep/40"
        aria-label="Close"
        onClick={onClose}
      />
      <Card className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2
            id="session-view-title"
            className="text-lg font-bold text-clara-strong"
          >
            Session
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-clara-deep hover:bg-clara-highlight"
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <ReadOnlyDetails session={session} />

        {feedback ? (
          <div className="mt-4 border-t border-clara-highlight pt-4">
            <SessionFeedbackCard feedback={feedback} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-clara-muted">No feedback stored.</p>
        )}
      </Card>
    </div>
  );
}

function ReadOnlyDetails({ session }: { session: SessionPlan }) {
  const warm = session.warm_up as WarmUpMove[];
  const seq = session.exercise_sequence as ExerciseItem[];

  return (
    <div className="space-y-3 text-sm text-clara-deep">
      <p>
        <span className="font-medium text-clara-strong">Date:</span>{" "}
        {formatDate(session.session_date)}
      </p>
      <p>
        <span className="font-medium text-clara-strong">Apparatus:</span>{" "}
        {session.apparatus}
      </p>
      <p>
        <span className="font-medium text-clara-strong">Type:</span>{" "}
        {sessionTypeLabel(session.session_type)}
      </p>
      {session.client_level && (
        <p>
          <span className="font-medium text-clara-strong">Client level:</span>{" "}
          {session.client_level}
        </p>
      )}
      <div>
        <span className="font-medium text-clara-strong">Warm-up</span>
        <ul className="mt-1 list-disc pl-5">
          {warm.map((m, i) => (
            <li key={i}>
              {m.move_name} — {m.sets}×{m.reps}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <span className="font-medium text-clara-strong">Main sequence</span>
        <ul className="mt-1 list-disc pl-5">
          {seq.map((e, i) => (
            <li key={i}>
              {formatExerciseNameForDisplay(e.exercise_name)} — {e.sets}×{e.reps}
              {e.notes?.trim() ? ` — ${e.notes}` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
