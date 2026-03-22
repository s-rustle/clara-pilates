"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import type { WeakSpotAnalysis, WeakSpotResult } from "@/types";

const UNLOCK_SESSIONS = 5;

type GetPayload = {
  result: WeakSpotResult | null;
  analysis: WeakSpotAnalysis | null;
  completed_quiz_sessions: number;
};

export default function WeakSpotCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<GetPayload | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/agents/weakspot", { credentials: "same-origin" });
      const json = await res.json();

      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Failed to load weak spots");
        setPayload(null);
        return;
      }

      if (!json.success || !json.data) {
        setError("Unexpected response from server");
        setPayload(null);
        return;
      }

      setPayload(json.data as GetPayload);
    } catch {
      setError("Failed to load weak spots");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <div className="flex min-h-[120px] items-center justify-center">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <ErrorMessage message={error} />
      </Card>
    );
  }

  const completed = payload?.completed_quiz_sessions ?? 0;
  const result = payload?.result;

  const needsMoreSessions =
    result?.insufficient_data === true ||
    (!result && completed < UNLOCK_SESSIONS);

  const sessionsNeeded =
    result?.insufficient_data && typeof result.sessions_needed === "number"
      ? result.sessions_needed
      : Math.max(0, UNLOCK_SESSIONS - completed);

  const progress = Math.min(1, completed / UNLOCK_SESSIONS);

  if (needsMoreSessions) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-bold text-clara-strong">
          Weak spots
        </h2>
        <p className="mb-3 text-sm text-clara-deep">
          Complete {sessionsNeeded} more quiz{" "}
          {sessionsNeeded === 1 ? "session" : "sessions"} to unlock weak spot analysis.
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-clara-highlight">
          <div
            className="h-full bg-clara-primary transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
            role="progressbar"
            aria-valuenow={completed}
            aria-valuemin={0}
            aria-valuemax={UNLOCK_SESSIONS}
          />
        </div>
        <p className="mt-2 text-xs text-clara-muted">
          {completed} of {UNLOCK_SESSIONS} sessions complete
        </p>
      </Card>
    );
  }

  const top = result?.top_three?.[0];
  if (!top) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-bold text-clara-strong">
          Weak spots
        </h2>
        <p className="text-sm text-clara-deep">
          Not enough quiz data grouped by area yet. Keep completing quizzes — we need at least
          three attempted questions per apparatus/topic group to rank weak spots.
        </p>
      </Card>
    );
  }

  const studyHref = `/study?apparatus=${encodeURIComponent(top.area)}`;

  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold text-clara-strong">
        Top priority weak spot
      </h2>
      <p className="mb-2 text-sm font-medium text-clara-strong">{top.area}</p>
      <div className="mb-3">
        <Badge variant="red">{top.accuracy_percent}% accuracy</Badge>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-clara-deep">
        {top.pattern_description}
      </p>
      <Link
        href={studyHref}
        className="inline-flex w-full items-center justify-center rounded-md bg-clara-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-clara-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-primary sm:w-auto"
      >
        Study this now
      </Link>
    </Card>
  );
}
