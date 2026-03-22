"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExerciseItem, HourLog, SessionFeedback, SessionMode, SessionPlan, SessionType, WarmUpMove } from "@/types";
import Card from "@/components/ui/Card";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";
import HourLogForm, { HOUR_CATEGORY_OPTIONS } from "@/components/hours/HourLogForm";
import SessionPlannerForm from "@/components/sessions/SessionPlannerForm";
import WarmUpSection from "@/components/sessions/WarmUpSection";
import ExerciseSequence from "@/components/sessions/ExerciseSequence";
import SessionFeedbackCard from "@/components/sessions/SessionFeedbackCard";
import SessionHistory, {
  SessionReadOnlyModal,
} from "@/components/sessions/SessionHistory";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapApparatusToHourCategory(apparatus: string): string {
  const direct: Record<string, string> = {
    Mat: "Mat 1",
    Reformer: "Reformer 1",
    "Trapeze Cadillac": "Trapeze Cadillac",
    Chair: "Chair",
    Barrels: "Barrels",
  };
  const mapped = direct[apparatus];
  if (mapped) return mapped;
  const found = HOUR_CATEGORY_OPTIONS.find((o) => o.value === apparatus);
  return found?.value ?? "Mat 1";
}

function sessionSubTypeForHours(sessionType: SessionType): string {
  return sessionType === "teaching" ? "Teaching" : "Practical";
}

function normalizeExercises(list: ExerciseItem[]): ExerciseItem[] {
  return list.map(({ exercise_name, sets, reps, notes }) => {
    const row: ExerciseItem = { exercise_name, sets, reps };
    const n = notes?.trim();
    if (n) row.notes = n;
    return row;
  });
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

export default function SessionsPage() {
  const [mode, setMode] = useState<SessionMode>("plan");
  const [sessionType, setSessionType] = useState<SessionType>("teaching");
  const [apparatus, setApparatus] = useState("Mat");
  const [clientLevel, setClientLevel] = useState<string | null>("Beginner");
  const [sessionDate, setSessionDate] = useState(todayISO);
  const [warmUp, setWarmUp] = useState<WarmUpMove[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);

  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  const [error, setError] = useState("");
  const [logSessions, setLogSessions] = useState<SessionPlan[]>([]);
  const [hourLogsLoaded, setHourLogsLoaded] = useState(false);
  const [loggedDates, setLoggedDates] = useState<string[]>([]);

  const [viewSession, setViewSession] = useState<SessionPlan | null>(null);
  const [hourModalOpen, setHourModalOpen] = useState(false);
  const [hourModalSessionId, setHourModalSessionId] = useState<string | null>(
    null
  );

  const busy = feedbackLoading || saveLoading || linkLoading;

  const sessionPayload = useMemo(
    () => ({
      mode,
      session_type: sessionType,
      apparatus,
      client_level: sessionType === "teaching" ? clientLevel : null,
      warm_up: warmUp,
      exercise_sequence: normalizeExercises(exercises),
      session_date: sessionDate,
      status: "draft" as const,
    }),
    [mode, sessionType, apparatus, clientLevel, warmUp, exercises, sessionDate]
  );

  const fetchHourDates = useCallback(async () => {
    try {
      const res = await fetch("/api/hours");
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        const dates = [
          ...new Set(
            (data.data as HourLog[]).map((h) => h.session_date)
          ),
        ] as string[];
        setLoggedDates(dates);
      }
    } catch {
      /* optional */
    } finally {
      setHourLogsLoaded(true);
    }
  }, []);

  const fetchLogHistory = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/sessions?mode=log");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not load session history.");
        setLogSessions([]);
        return;
      }
      if (data.success && Array.isArray(data.data)) {
        setLogSessions(data.data as SessionPlan[]);
      } else {
        setLogSessions([]);
      }
    } catch {
      setError("Could not load session history.");
      setLogSessions([]);
    }
  }, []);

  useEffect(() => {
    fetchHourDates();
  }, [fetchHourDates]);

  useEffect(() => {
    if (mode === "log") {
      fetchLogHistory();
    }
  }, [mode, fetchLogHistory]);

  useEffect(() => {
    if (sessionType === "personal") {
      setClientLevel(null);
    } else if (clientLevel == null) {
      setClientLevel("Beginner");
    }
  }, [sessionType, clientLevel]);

  async function persistDraft(
    overrides?: Partial<{ status: "draft" | "complete" }>
  ): Promise<string | null> {
    const status = overrides?.status ?? "draft";
    const body: Record<string, unknown> = {
      ...sessionPayload,
      status,
    };
    if (draftId) body.id = draftId;

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error ?? "Failed to save session");
    }
    const row = data.data as SessionPlan;
    setDraftId(row.id);
    return row.id;
  }

  const handleSaveDraft = async () => {
    setError("");
    setSaveLoading(true);
    try {
      await persistDraft({ status: "draft" });
      if (mode === "log") await fetchLogHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save draft");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGetFeedback = async () => {
    setError("");
    setFeedbackLoading(true);
    try {
      const id = await persistDraft({ status: "draft" });
      if (!id) throw new Error("No session id returned");

      const res = await fetch("/api/agents/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...sessionPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to get feedback");
      }
      if (!isSessionFeedback(data.data)) {
        throw new Error("Invalid feedback response");
      }
      setFeedback(data.data);
      if (mode === "log") await fetchLogHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get feedback");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleRevise = () => {
    setFeedback(null);
  };

  const handleSaveAndLink = async () => {
    setError("");
    setLinkLoading(true);
    try {
      const id = await persistDraft({ status: "draft" });
      if (!id) throw new Error("No session id returned");

      const patchRes = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "complete" }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok || !patchData.success) {
        throw new Error(patchData.error ?? "Failed to mark session complete");
      }

      setHourModalSessionId(id);
      setHourModalOpen(true);
      await fetchLogHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save session");
    } finally {
      setLinkLoading(false);
    }
  };

  const handleHourCreated = async (log: HourLog) => {
    if (!hourModalSessionId) return;
    try {
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: hourModalSessionId,
          linked_hour_log_id: log.id,
        }),
      });
    } catch {
      /* non-fatal */
    }
    setHourModalOpen(false);
    setHourModalSessionId(null);
    await fetchLogHistory();
    await fetchHourDates();
  };

  const hourFormKey = hourModalSessionId
    ? `${hourModalSessionId}-${sessionDate}-${sessionType}`
    : "closed";

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-start">
        <Card>
          <SessionPlannerForm
            mode={mode}
            onModeChange={(m) => {
              setMode(m);
              setFeedback(null);
            }}
            onSubmit={handleGetFeedback}
            onSaveDraft={handleSaveDraft}
            isLoading={feedbackLoading}
            isSavingDraft={saveLoading}
            sessionType={sessionType}
            onSessionTypeChange={setSessionType}
            apparatus={apparatus}
            onApparatusChange={setApparatus}
            clientLevel={clientLevel}
            onClientLevelChange={setClientLevel}
            sessionDate={sessionDate}
            onSessionDateChange={setSessionDate}
            loggedDates={hourLogsLoaded ? loggedDates : []}
          >
            <WarmUpSection
              moves={warmUp}
              onChange={setWarmUp}
              disabled={busy}
            />
            <ExerciseSequence
              exercises={exercises}
              onChange={setExercises}
              apparatusLabel={apparatus}
              disabled={busy}
            />
          </SessionPlannerForm>

          {mode === "log" && (
            <div className="mt-4 border-t border-clara-border pt-4">
              <Button
                type="button"
                variant="primary"
                onClick={handleSaveAndLink}
                disabled={busy}
                className="w-full"
              >
                {linkLoading ? "Saving…" : "Save & Link to Hours"}
              </Button>
            </div>
          )}

          {mode === "log" && (
            <SessionHistory
              sessions={logSessions}
              onView={(s) => setViewSession(s)}
            />
          )}
        </Card>

        <Card className="lg:sticky lg:top-4">
          {feedback ? (
            <SessionFeedbackCard feedback={feedback} onRevise={handleRevise} />
          ) : (
            <p className="text-center text-sm text-clara-muted lg:py-12">
              Build your session and get feedback from Clara.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <ErrorMessage message={error} />
      </div>

      <SessionReadOnlyModal
        session={viewSession}
        open={viewSession !== null}
        onClose={() => setViewSession(null)}
      />

      {hourModalOpen && hourModalSessionId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hour-link-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-clara-ink/40"
            aria-label="Close"
            onClick={() => {
              setHourModalOpen(false);
              setHourModalSessionId(null);
            }}
          />
          <Card className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto shadow-login">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2
                id="hour-link-title"
                className="font-display text-lg font-semibold text-clara-strong"
              >
                Log hours
              </h2>
              <button
                type="button"
                onClick={() => {
                  setHourModalOpen(false);
                  setHourModalSessionId(null);
                }}
                className="rounded p-1 text-clara-deep hover:bg-clara-highlight"
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <HourLogForm
              key={hourFormKey}
              loggedDates={loggedDates}
              initialCategory={mapApparatusToHourCategory(apparatus)}
              initialSubType={sessionSubTypeForHours(sessionType)}
              initialSessionDate={sessionDate}
              onCreated={handleHourCreated}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
