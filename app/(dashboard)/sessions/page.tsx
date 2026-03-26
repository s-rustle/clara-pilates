"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExerciseItem, HourLog, SessionFeedback, SessionMode, SessionPlan, SessionType, WarmUpMove } from "@/types";
import { validateSessionFeedback } from "@/lib/sessionFeedback/validate";
import Card from "@/components/ui/Card";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Select from "@/components/ui/Select";
import {
  GENERATE_PLAN_APPARATUS_OPTIONS,
  GENERATE_PLAN_DURATIONS,
  GENERATE_PLAN_FOCUS_AREAS,
  GENERATE_PLAN_SESSION_GOALS,
  type GeneratePlanDuration,
} from "@/lib/sessions/generatePlanForm";
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
    Tower: "Trapeze Cadillac",
    Props: "Mat 1",
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
  return list.map(({ exercise_name, sets, reps, notes, apparatus }) => {
    const row: ExerciseItem = { exercise_name, sets, reps };
    const n = notes?.trim();
    if (n) row.notes = n;
    const a = apparatus?.trim();
    if (a) row.apparatus = a;
    return row;
  });
}

function normalizeWarmUpMoves(list: WarmUpMove[]): WarmUpMove[] {
  return list.map(({ move_name, sets, reps, notes }) => {
    const row: WarmUpMove = { move_name, sets, reps };
    const n = notes?.trim();
    if (n) row.notes = n;
    return row;
  });
}

function isSessionFeedback(raw: unknown): raw is SessionFeedback {
  if (!raw || typeof raw !== "object") return false;
  try {
    validateSessionFeedback(raw);
    return true;
  } catch {
    return false;
  }
}

const PLAN_CLIENT_LEVEL_OPTIONS = [
  { value: "Beginner", label: "Beginner" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Advanced", label: "Advanced" },
];

const DURATION_SELECT_OPTIONS = GENERATE_PLAN_DURATIONS.map((m) => ({
  value: String(m),
  label: `${m} minutes`,
}));

const FOCUS_SELECT_OPTIONS = [
  { value: "", label: "— Optional —" },
  ...GENERATE_PLAN_FOCUS_AREAS.map((f) => ({ value: f, label: f })),
];

const GOAL_SELECT_OPTIONS = [
  { value: "", label: "— Optional —" },
  ...GENERATE_PLAN_SESSION_GOALS.map((g) => ({ value: g, label: g })),
];

export default function SessionsPage() {
  const [mode, setMode] = useState<SessionMode>("plan");
  const [sessionType, setSessionType] = useState<SessionType>("teaching");
  const [apparatus, setApparatus] = useState("Mat");
  const [clientLevel, setClientLevel] = useState<string | null>("Beginner");
  const [sessionDate, setSessionDate] = useState(todayISO);
  const [clientNotes, setClientNotes] = useState("");
  const [warmUp, setWarmUp] = useState<WarmUpMove[]>([]);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);

  const [draftId, setDraftId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);

  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [fullPlanLoading, setFullPlanLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  const [error, setError] = useState("");
  const [hourDatesError, setHourDatesError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [logSessions, setLogSessions] = useState<SessionPlan[]>([]);
  const [hourLogsLoaded, setHourLogsLoaded] = useState(false);
  const [loggedDates, setLoggedDates] = useState<string[]>([]);

  const [viewSession, setViewSession] = useState<SessionPlan | null>(null);
  const [hourModalOpen, setHourModalOpen] = useState(false);
  const [hourModalSessionId, setHourModalSessionId] = useState<string | null>(
    null
  );

  const planDraftHydratedRef = useRef(false);

  const [planSource, setPlanSource] = useState<"manual" | "generate">("manual");
  const [generateDuration, setGenerateDuration] =
    useState<GeneratePlanDuration>(60);
  const [generateApparatus, setGenerateApparatus] = useState<string[]>([
    "Mat",
  ]);
  const [generateFocus, setGenerateFocus] = useState("");
  const [generateGoal, setGenerateGoal] = useState("");
  const [planRationale, setPlanRationale] = useState<string | null>(null);

  const busy =
    feedbackLoading || fullPlanLoading || saveLoading || linkLoading;

  const sessionPayload = useMemo(
    () => ({
      mode,
      session_type: sessionType,
      apparatus,
      client_level: sessionType === "teaching" ? clientLevel : null,
      client_notes: clientNotes.trim() || null,
      warm_up: normalizeWarmUpMoves(warmUp),
      exercise_sequence: normalizeExercises(exercises),
      session_date: sessionDate,
      status: "draft" as const,
    }),
    [
      mode,
      sessionType,
      apparatus,
      clientLevel,
      clientNotes,
      warmUp,
      exercises,
      sessionDate,
    ]
  );

  const fetchHourDates = useCallback(async () => {
    setHourDatesError("");
    try {
      const res = await fetch("/api/hours");
      const data = await res.json();
      if (!res.ok) {
        setHourDatesError(
          typeof data.error === "string"
            ? data.error
            : "Could not load hour log dates for the calendar."
        );
        setLoggedDates([]);
        return;
      }
      if (data.success && Array.isArray(data.data)) {
        const dates = [
          ...new Set(
            (data.data as HourLog[]).map((h) => h.session_date)
          ),
        ] as string[];
        setLoggedDates(dates);
      } else {
        setLoggedDates([]);
      }
    } catch {
      setHourDatesError(
        "Could not load hour log dates for the calendar. Please refresh."
      );
      setLoggedDates([]);
    } finally {
      setHourLogsLoaded(true);
    }
  }, []);

  const fetchLogHistory = useCallback(async () => {
    setError("");
    setHistoryLoading(true);
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
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "log") {
      void Promise.all([fetchHourDates(), fetchLogHistory()]);
    } else {
      void fetchHourDates();
    }
  }, [mode, fetchHourDates, fetchLogHistory]);

  useEffect(() => {
    if (mode !== "plan" || planDraftHydratedRef.current) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sessions?mode=plan&status=draft");
        const data = await res.json();
        if (
          cancelled ||
          !res.ok ||
          !data.success ||
          !Array.isArray(data.data)
        ) {
          return;
        }
        planDraftHydratedRef.current = true;
        const rows = data.data as SessionPlan[];
        const d = rows[0];
        if (!d) return;

        setDraftId(d.id);
        setSessionType(d.session_type);
        setApparatus(d.apparatus);
        setClientLevel(d.client_level);
        setSessionDate(d.session_date ?? todayISO());
        setClientNotes(d.client_notes ?? "");
        setWarmUp(normalizeWarmUpMoves(d.warm_up ?? []));
        setExercises(normalizeExercises(d.exercise_sequence ?? []));
        if (isSessionFeedback(d.feedback)) {
          setFeedback(d.feedback);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode === "log") {
      setPlanSource("manual");
    }
  }, [mode]);

  useEffect(() => {
    if (planSource === "generate") {
      if (clientLevel == null) setClientLevel("Beginner");
      return;
    }
    if (sessionType === "personal") {
      setClientLevel(null);
    } else if (clientLevel == null) {
      setClientLevel("Beginner");
    }
  }, [sessionType, clientLevel, planSource]);

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

  const handleGenerateFullPlan = async () => {
    setError("");
    setFullPlanLoading(true);
    try {
      if (generateApparatus.length === 0) {
        throw new Error("Select at least one apparatus.");
      }
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generatePlan",
          session_type: sessionType,
          client_level: clientLevel ?? "Beginner",
          session_duration_minutes: generateDuration,
          apparatus_available: generateApparatus,
          client_notes: clientNotes.trim() || null,
          focus_area: generateFocus.trim() || null,
          session_goal: generateGoal.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Generate plan failed"
        );
      }
      const payload = data.data as {
        why_this_plan: string;
        primary_apparatus: string;
        warm_up: WarmUpMove[];
        exercise_sequence: ExerciseItem[];
      };
      setWarmUp(normalizeWarmUpMoves(payload.warm_up));
      setExercises(normalizeExercises(payload.exercise_sequence));
      setApparatus(payload.primary_apparatus);
      setPlanRationale(payload.why_this_plan);
      setFeedback(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate plan failed");
    } finally {
      setFullPlanLoading(false);
    }
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
      {mode === "plan" && (
        <div className="mb-6 flex gap-0 rounded-none border border-clara-border bg-clara-bg p-0.5">
          <button
            type="button"
            onClick={() => {
              setPlanSource("manual");
              setPlanRationale(null);
              setFeedback(null);
            }}
            disabled={busy}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium transition-colors ${
              planSource === "manual"
                ? "bg-clara-primary text-white underline decoration-clara-border decoration-2 underline-offset-4"
                : "text-clara-deep hover:bg-clara-border/60"
            } disabled:opacity-50`}
          >
            Build plan manually
          </button>
          <button
            type="button"
            onClick={() => {
              setPlanSource("generate");
              setFeedback(null);
              setGenerateApparatus((prev) =>
                prev.length > 0 ? prev : apparatus ? [apparatus] : ["Mat"]
              );
            }}
            disabled={busy}
            className={`flex-1 rounded px-4 py-2 text-sm font-medium transition-colors ${
              planSource === "generate"
                ? "bg-clara-primary text-white underline decoration-clara-border decoration-2 underline-offset-4"
                : "text-clara-deep hover:bg-clara-border/60"
            } disabled:opacity-50`}
          >
            Generate plan with AI
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-start">
        <Card>
          {mode === "plan" && planSource === "generate" && (
            <section className="mb-6 space-y-4 border-b border-clara-border pb-6">
              <h2 className="text-base font-semibold text-clara-deep">
                Generate a session plan
              </h2>
              <p className="text-xs text-clara-muted">
                Clara scans client notes for special populations first, then builds
                a duration-appropriate, ergonomically sequenced plan. Edit the
                warm-up and main sequence below before saving or requesting
                feedback.
              </p>
              <Select
                label="Client level"
                options={PLAN_CLIENT_LEVEL_OPTIONS}
                value={clientLevel ?? "Beginner"}
                onChange={(e) => setClientLevel(e.target.value)}
                disabled={busy}
              />
              <Select
                label="Session duration"
                options={DURATION_SELECT_OPTIONS}
                value={String(generateDuration)}
                onChange={(e) =>
                  setGenerateDuration(
                    Number(e.target.value) as GeneratePlanDuration
                  )
                }
                disabled={busy}
              />
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-clara-deep">
                  Apparatus available
                </legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {GENERATE_PLAN_APPARATUS_OPTIONS.map(({ value, label }) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-2 text-sm text-clara-deep"
                    >
                      <input
                        type="checkbox"
                        className="rounded-none border-clara-border"
                        checked={generateApparatus.includes(value)}
                        disabled={busy}
                        onChange={() => {
                          setGenerateApparatus((prev) => {
                            const on = prev.includes(value);
                            if (on && prev.length === 1) return prev;
                            if (on) return prev.filter((x) => x !== value);
                            return [...prev, value];
                          });
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <Select
                label="Focus area"
                options={FOCUS_SELECT_OPTIONS}
                value={generateFocus}
                onChange={(e) => setGenerateFocus(e.target.value)}
                disabled={busy}
              />
              <Select
                label="Session goal"
                options={GOAL_SELECT_OPTIONS}
                value={generateGoal}
                onChange={(e) => setGenerateGoal(e.target.value)}
                disabled={busy}
              />
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleGenerateFullPlan()}
                disabled={busy}
                className="w-full sm:w-auto"
              >
                {fullPlanLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" />
                    Generating plan…
                  </span>
                ) : (
                  "Generate session plan"
                )}
              </Button>
            </section>
          )}

          {planRationale ? (
            <div className="mb-6 rounded-none border border-clara-border bg-clara-surface/80 p-4 text-sm text-clara-deep">
              <h3 className="font-semibold text-clara-deep">Why this plan</h3>
              <p className="mt-2 whitespace-pre-wrap">{planRationale}</p>
            </div>
          ) : null}

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
            suppressApparatusSelect={mode === "plan" && planSource === "generate"}
            suppressClientLevelSelect={
              mode === "plan" && planSource === "generate"
            }
          >
            {mode === "plan" && planSource === "generate" ? (
              <p className="mb-4 text-xs text-clara-muted">
                Primary apparatus for this draft:{" "}
                <span className="font-medium text-clara-deep">{apparatus}</span>
                . Multi-station pieces show their apparatus on each exercise.
              </p>
            ) : null}
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-clara-deep">
                Client considerations (optional)
              </label>
              <p className="mb-1.5 text-xs text-clara-muted">
                Pregnancy stage, injuries, osteoporosis, hypertension, scoliosis, or
                other notes for safer sequencing and feedback.
              </p>
              <textarea
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                disabled={busy}
                rows={3}
                placeholder="e.g. 3rd trimester, left knee pain, osteopenia, goals…"
                className="w-full resize-y rounded-none border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-primary focus:outline-none focus:ring-1 focus:ring-clara-primary/40 disabled:opacity-50"
              />
            </div>
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
            <div className="mt-4 space-y-3 border-t border-clara-border pt-4">
              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-clara-deep">
                  <LoadingSpinner size="sm" />
                  <span className="text-sm">Loading session history…</span>
                </div>
              ) : (
                <SessionHistory
                  sessions={logSessions}
                  onView={(s) => setViewSession(s)}
                />
              )}
            </div>
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

      <div className="mt-4 space-y-2">
        <ErrorMessage message={hourDatesError} />
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
            className="absolute inset-0 bg-clara-deep/40"
            aria-label="Close"
            onClick={() => {
              setHourModalOpen(false);
              setHourModalSessionId(null);
            }}
          />
          <Card className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto">
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2
                id="hour-link-title"
                className="text-lg font-semibold text-clara-deep"
              >
                Log hours
              </h2>
              <button
                type="button"
                onClick={() => {
                  setHourModalOpen(false);
                  setHourModalSessionId(null);
                }}
                className="rounded p-1 text-clara-deep hover:bg-clara-border"
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
