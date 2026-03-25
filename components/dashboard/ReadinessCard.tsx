"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import ProgressBar from "@/components/ui/ProgressBar";
import type { ReadinessSnapshot } from "@/types";

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseRecommendations(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function daysUntilExam(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

const metricLabel =
  "text-[9px] font-normal uppercase tracking-[2px] text-clara-muted";

function MetricCell({ label, metric }: { label: string; metric: string }) {
  return (
    <div className="bg-white p-4">
      <p className={metricLabel}>{label}</p>
      <p className="mt-1 font-cormorant text-[36px] font-light leading-none tabular-nums text-clara-deep">
        {metric}
      </p>
    </div>
  );
}

type ReadinessCardProps = {
  examTargetDate?: string | null;
};

export default function ReadinessCard({
  examTargetDate: examTargetDateProp,
}: ReadinessCardProps) {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [examDate, setExamDate] = useState<string | null>(
    examTargetDateProp ?? null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setExamDate(examTargetDateProp ?? null);
  }, [examTargetDateProp]);

  const load = useCallback(async () => {
    setError("");
    try {
      const readinessRes = await fetch("/api/agents/readiness", {
        credentials: "same-origin",
      });
      const readinessJson = await readinessRes.json();

      if (!readinessRes.ok) {
        setError(
          typeof readinessJson.error === "string"
            ? readinessJson.error
            : "Failed to load readiness"
        );
        setSnapshot(null);
        return;
      }

      if (!readinessJson.success) {
        setError("Unexpected response from server");
        setSnapshot(null);
        return;
      }

      setSnapshot(
        (readinessJson.data?.snapshot as ReadinessSnapshot | null) ?? null
      );
    } catch {
      setError("Failed to load readiness");
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setError("");
    setRefreshing(true);
    try {
      const res = await fetch("/api/agents/readiness", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();

      if (!res.ok) {
        setError(
          typeof json.error === "string" ? json.error : "Failed to refresh readiness"
        );
        return;
      }

      if (!json.success || !json.data?.snapshot) {
        setError("Unexpected response from server");
        return;
      }

      setSnapshot(json.data.snapshot as ReadinessSnapshot);
    } catch {
      setError("Failed to refresh readiness");
    } finally {
      setRefreshing(false);
    }
  };

  const busy = loading || refreshing;
  const examDelta = daysUntilExam(examDate);
  const showExamCell = examDate != null && examDate !== "" && examDelta !== null;

  const examMetric =
    examDelta === null
      ? "—"
      : examDelta === 0
        ? "Today"
        : examDelta > 0
          ? `${examDelta} days`
          : `${Math.abs(examDelta)} past`;

  return (
    <div className="border border-clara-border bg-white">
      <div className="flex flex-col gap-3 border-b border-clara-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-cormorant text-lg font-semibold text-clara-deep">
          Readiness
        </h2>
        <Button
          type="button"
          variant="ghost"
          onClick={() => void handleRefresh()}
          disabled={busy}
          className="shrink-0 sm:mt-0"
        >
          {refreshing ? (
            <span className="inline-flex items-center gap-2 normal-case">
              <LoadingSpinner size="sm" />
              Refreshing…
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {error ? (
        <div className="p-5">
          <ErrorMessage message={error} />
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center py-10">
          <LoadingSpinner size="lg" />
        </div>
      ) : !snapshot ? (
        <p className="p-5 text-sm text-clara-deep">
          No readiness snapshot yet. Click <span className="font-medium">Refresh</span> to
          calculate your scores and generate a brief.
        </p>
      ) : (
        <>
          <div
            className={`grid grid-cols-1 gap-px bg-clara-border ${
              showExamCell ? "md:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3"
            }`}
          >
            <MetricCell
              label="Readiness"
              metric={`${toNumber(snapshot.overall_score).toFixed(1)}%`}
            />
            <MetricCell
              label="Quiz avg"
              metric={`${toNumber(snapshot.quiz_score).toFixed(1)}%`}
            />
            <MetricCell
              label="Hours"
              metric={`${toNumber(snapshot.hours_score).toFixed(1)}%`}
            />
            {showExamCell ? (
              <div className="border-l-2 border-clara-accent bg-clara-exam p-4">
                <p className={`${metricLabel} mb-1`}>Exam countdown</p>
                <p className="font-cormorant text-[36px] font-light leading-none tabular-nums text-clara-deep">
                  {examMetric}
                </p>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 border-t border-clara-border p-5">
            <ProgressBar
              label="Curriculum"
              value={toNumber(snapshot.curriculum_score)}
              metric={`${toNumber(snapshot.curriculum_score).toFixed(1)}%`}
              tone="primary"
            />
            <ProgressBar
              label="Quiz"
              value={toNumber(snapshot.quiz_score)}
              metric={`${toNumber(snapshot.quiz_score).toFixed(1)}%`}
              tone="primary"
            />
            <ProgressBar
              label="Hours"
              value={toNumber(snapshot.hours_score)}
              metric={`${toNumber(snapshot.hours_score).toFixed(1)}%`}
              tone="accent"
            />
          </div>

          {snapshot.narrative ? (
            <p className="border-t border-clara-border p-5 text-sm leading-relaxed text-clara-deep">
              {snapshot.narrative}
            </p>
          ) : null}

          {(() => {
            const recs = parseRecommendations(snapshot.recommendations);
            if (recs.length === 0) return null;
            return (
              <div className="border-t border-clara-border p-5">
                <p className="mb-2 text-sm font-semibold text-clara-deep">Recommendations</p>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-clara-deep">
                  {recs.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
