"use client";

import { useCallback, useState } from "react";
import Card from "@/components/ui/Card";
import CueInput from "@/components/cues/CueInput";
import ErrorMessage from "@/components/ui/ErrorMessage";
import FeedbackCard from "@/components/cues/FeedbackCard";
import type { CueFeedback } from "@/types";

interface SessionCueEntry {
  id: string;
  exerciseName: string;
  submittedAt: string;
  overall: string;
  feedback: CueFeedback;
}

export default function CuesPage() {
  const [history, setHistory] = useState<SessionCueEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetCueNonce, setResetCueNonce] = useState(0);

  const activeEntry =
    activeId === null
      ? null
      : history.find((h) => h.id === activeId) ?? null;

  const submitCue = useCallback(
    async (
      cue: string,
      apparatus: string,
      exerciseName: string,
      clientLevel: string
    ) => {
      setError(null);
      setIsLoading(true);
      try {
        const res = await fetch("/api/agents/cues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cue,
            apparatus,
            exercise_name: exerciseName,
            client_level: clientLevel,
          }),
          credentials: "same-origin",
        });
        const json = await res.json();

        if (!res.ok) {
          setError(json?.error ?? `Request failed: ${res.status}`);
          return;
        }

        if (!json.success || !json.data) {
          setError("Unexpected response format");
          return;
        }

        const feedback = json.data as CueFeedback;
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `cue-${Date.now()}`;

        const entry: SessionCueEntry = {
          id,
          exerciseName: exerciseName || "(unnamed exercise)",
          submittedAt: new Date().toISOString(),
          overall: feedback.overall || "",
          feedback,
        };

        setHistory((prev) => [entry, ...prev]);
        setActiveId(id);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to get cue feedback"
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleTryAgain = useCallback(() => {
    setResetCueNonce((n) => n + 1);
  }, []);

  const formatHistoryTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CueInput
          onSubmit={submitCue}
          isLoading={isLoading}
          resetCueNonce={resetCueNonce}
        />
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      {activeEntry ? (
        <FeedbackCard
          feedback={activeEntry.feedback}
          onTryAgain={handleTryAgain}
        />
      ) : (
        <Card>
          <p className="text-sm text-clara-deep">
            Submit a cue to get feedback from Clara.
          </p>
        </Card>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-clara-strong">
          This session
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-clara-deep">
            No cues submitted yet this session.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((entry) => {
              const isActive = entry.id === activeId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(entry.id)}
                    className={`w-full rounded-md border px-4 py-3 text-left text-sm transition-colors ${
                      isActive
                        ? "border-clara-warm bg-clara-elevated ring-1 ring-clara-warm/30"
                        : "border-clara-border bg-clara-surface hover:bg-clara-elevated"
                    }`}
                  >
                    <div className="font-bold text-clara-strong">
                      {entry.exerciseName}
                    </div>
                    <div className="text-xs text-clara-muted">
                      {formatHistoryTime(entry.submittedAt)}
                    </div>
                    {entry.overall ? (
                      <p className="mt-1 text-xs text-clara-deep line-clamp-2">
                        {entry.overall}
                      </p>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
