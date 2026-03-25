"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import type { HourTargets } from "@/types";
import { DEFAULT_HOUR_TARGETS } from "@/types";
import { resolveHourTargets } from "@/lib/utils/hours";

type ProfileResponse = {
  email: string;
  full_name: string | null;
  exam_target_date: string | null;
  hour_targets: HourTargets | null;
};

export default function SettingsPage() {
  const router = useRouter();

  const [initialLoad, setInitialLoad] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [examDate, setExamDate] = useState("");

  const [matTarget, setMatTarget] = useState(
    String(DEFAULT_HOUR_TARGETS.mat_practical)
  );
  const [reformerTarget, setReformerTarget] = useState(
    String(DEFAULT_HOUR_TARGETS.reformer_practical)
  );
  const [apparatusTarget, setApparatusTarget] = useState(
    String(DEFAULT_HOUR_TARGETS.apparatus_practical)
  );
  const [totalTarget, setTotalTarget] = useState(
    String(DEFAULT_HOUR_TARGETS.total)
  );

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  const [examSaving, setExamSaving] = useState(false);
  const [examSuccess, setExamSuccess] = useState("");
  const [examError, setExamError] = useState("");

  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSuccess, setHoursSuccess] = useState("");
  const [hoursError, setHoursError] = useState("");

  const [signingOut, setSigningOut] = useState(false);

  const hydrateFromServer = useCallback((data: ProfileResponse) => {
    setEmail(data.email);
    setDisplayName(data.full_name ?? "");
    if (data.exam_target_date) {
      setExamDate(data.exam_target_date.slice(0, 10));
    } else {
      setExamDate("");
    }
    const t = resolveHourTargets(data.hour_targets);
    setMatTarget(String(t.mat_practical));
    setReformerTarget(String(t.reformer_practical));
    setApparatusTarget(String(t.apparatus_practical));
    setTotalTarget(String(t.total));
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoadError("");
    try {
      const res = await fetch("/api/profile", { credentials: "same-origin" });
      const json: { success?: boolean; data?: ProfileResponse; error?: string } =
        await res.json();

      if (!res.ok) {
        setLoadError(
          typeof json.error === "string" ? json.error : "Unable to load settings."
        );
        return;
      }
      if (json.success && json.data) {
        hydrateFromServer(json.data);
      }
    } catch {
      setLoadError("Unable to load settings.");
    } finally {
      setInitialLoad(false);
    }
  }, [hydrateFromServer]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const patchProfile = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
    };
    return { ok: res.ok, json };
  };

  const onSaveProfile = async () => {
    setProfileError("");
    setProfileSuccess("");
    setProfileSaving(true);
    try {
      const { ok, json } = await patchProfile({
        full_name: displayName.trim() ? displayName.trim() : null,
      });
      if (!ok || !json.success) {
        setProfileError(
          typeof json.error === "string" ? json.error : "Could not save profile."
        );
        return;
      }
      setProfileSuccess("Profile saved.");
    } catch {
      setProfileError("Could not save profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const onSaveExamDate = async () => {
    setExamError("");
    setExamSuccess("");
    setExamSaving(true);
    try {
      const { ok, json } = await patchProfile({
        exam_target_date: examDate.trim() || null,
      });
      if (!ok || !json.success) {
        setExamError(
          typeof json.error === "string"
            ? json.error
            : "Could not save exam date."
        );
        return;
      }
      setExamSuccess("Exam target date saved.");
    } catch {
      setExamError("Could not save exam date.");
    } finally {
      setExamSaving(false);
    }
  };

  const onSaveHourTargets = async () => {
    setHoursError("");
    setHoursSuccess("");
    setHoursSaving(true);
    try {
      const payload: HourTargets = {
        mat_practical: Number(matTarget),
        reformer_practical: Number(reformerTarget),
        apparatus_practical: Number(apparatusTarget),
        total: Number(totalTarget),
      };
      const { ok, json } = await patchProfile({ hour_targets: payload });
      if (!ok || !json.success) {
        setHoursError(
          typeof json.error === "string"
            ? json.error
            : "Could not save hour targets."
        );
        return;
      }
      setHoursSuccess("Hour targets saved.");
    } catch {
      setHoursError("Could not save hour targets.");
    } finally {
      setHoursSaving(false);
    }
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  if (initialLoad) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-cormorant text-2xl font-semibold text-clara-deep">Settings</h1>

      {loadError ? <ErrorMessage message={loadError} /> : null}

      <Card>
        <h2 className="mb-4 text-lg font-bold text-clara-deep">Profile</h2>
        <div className="flex flex-col gap-4">
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            disabled={profileSaving}
          />
          <Input label="Email" type="email" value={email} readOnly />
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSaveProfile()}
            disabled={profileSaving}
          >
            {profileSaving ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Saving…
              </span>
            ) : (
              "Save profile"
            )}
          </Button>
          {profileSuccess ? (
            <p className="text-sm font-medium text-clara-deep">
              {profileSuccess}
            </p>
          ) : null}
          <ErrorMessage message={profileError} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-clara-deep">
          Exam target date
        </h2>
        <div className="flex flex-col gap-4">
          <Input
            label="Target exam date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            disabled={examSaving}
          />
          <p className="text-xs text-clara-muted">
            Setting a target date shows the countdown in the header and on your dashboard metrics.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSaveExamDate()}
            disabled={examSaving}
          >
            {examSaving ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Saving…
              </span>
            ) : (
              "Save exam date"
            )}
          </Button>
          {examSuccess ? (
            <p className="text-sm font-medium text-clara-deep">{examSuccess}</p>
          ) : null}
          <ErrorMessage message={examError} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-clara-deep">
          Hour targets
        </h2>
        <p className="mb-3 text-xs text-clara-muted">
          Defaults: Mat 70h, Reformer 150h, Apparatus 150h, Total 536h (Balanced
          Body–style totals). Adjust to match your program requirements.
        </p>
        <div className="flex flex-col gap-4">
          <Input
            label="Mat practical target (hours)"
            type="number"
            min={1}
            step={1}
            value={matTarget}
            onChange={(e) => setMatTarget(e.target.value)}
            disabled={hoursSaving}
          />
          <Input
            label="Reformer practical target (hours)"
            type="number"
            min={1}
            step={1}
            value={reformerTarget}
            onChange={(e) => setReformerTarget(e.target.value)}
            disabled={hoursSaving}
          />
          <Input
            label="Apparatus practical target (hours)"
            type="number"
            min={1}
            step={1}
            value={apparatusTarget}
            onChange={(e) => setApparatusTarget(e.target.value)}
            disabled={hoursSaving}
          />
          <Input
            label="Total hour target (hours)"
            type="number"
            min={1}
            step={1}
            value={totalTarget}
            onChange={(e) => setTotalTarget(e.target.value)}
            disabled={hoursSaving}
          />
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSaveHourTargets()}
            disabled={hoursSaving}
          >
            {hoursSaving ? (
              <span className="inline-flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Saving…
              </span>
            ) : (
              "Save hour targets"
            )}
          </Button>
          {hoursSuccess ? (
            <p className="text-sm font-medium text-clara-deep">
              {hoursSuccess}
            </p>
          ) : null}
          <ErrorMessage message={hoursError} />
        </div>
      </Card>

      <div className="border-t border-clara-border pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => void onSignOut()}
          disabled={signingOut}
        >
          {signingOut ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Signing out…
            </span>
          ) : (
            "Sign out"
          )}
        </Button>
      </div>
    </div>
  );
}
