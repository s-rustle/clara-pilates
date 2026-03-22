"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
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

export default function ReadinessCard() {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/agents/readiness", { credentials: "same-origin" });
      const json = await res.json();

      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to load readiness");
        setSnapshot(null);
        return;
      }

      if (!json.success) {
        setError("Unexpected response from server");
        setSnapshot(null);
        return;
      }

      setSnapshot((json.data?.snapshot as ReadinessSnapshot | null) ?? null);
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
        setError(typeof json.error === "string" ? json.error : "Failed to refresh readiness");
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

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="font-display text-lg font-semibold text-clara-strong">
          Readiness
        </h2>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleRefresh()}
          disabled={busy}
          className="shrink-0 sm:mt-0"
        >
          {refreshing ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Refreshing…
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <div className="flex min-h-[160px] items-center justify-center py-8">
          <LoadingSpinner size="lg" />
        </div>
      ) : !snapshot ? (
        <p className="text-sm text-clara-deep">
          No readiness snapshot yet. Click <span className="font-medium">Refresh</span> to
          calculate your scores and generate a brief.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-1 text-sm font-medium text-clara-deep">Overall</p>
            <p className="font-display text-4xl font-semibold tabular-nums text-clara-strong">
              {toNumber(snapshot.overall_score).toFixed(1)}%
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ProgressBar
              label="Curriculum"
              value={toNumber(snapshot.curriculum_score)}
              sublabel={`${toNumber(snapshot.curriculum_score).toFixed(1)}%`}
            />
            <ProgressBar
              label="Quiz"
              value={toNumber(snapshot.quiz_score)}
              sublabel={`${toNumber(snapshot.quiz_score).toFixed(1)}%`}
            />
            <ProgressBar
              label="Hours"
              value={toNumber(snapshot.hours_score)}
              sublabel={`${toNumber(snapshot.hours_score).toFixed(1)}%`}
            />
          </div>

          {snapshot.narrative ? (
            <p className="text-sm leading-relaxed text-clara-deep">{snapshot.narrative}</p>
          ) : null}

          {(() => {
            const recs = parseRecommendations(snapshot.recommendations);
            if (recs.length === 0) return null;
            return (
              <div className="rounded-lg bg-clara-surface p-4 shadow-card">
                <p className="mb-2 text-sm font-medium text-clara-strong">Recommendations</p>
                <ol className="list-decimal space-y-2 pl-5 text-sm text-clara-deep">
                  {recs.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>
            );
          })()}
        </div>
      )}
    </Card>
  );
}
