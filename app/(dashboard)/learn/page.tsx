"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import SourceBadge from "@/components/study/SourceBadge";
import ManualPageImage from "@/components/learn/ManualPageImage";
import TutorialSections from "@/components/learn/TutorialSections";
import Badge from "@/components/ui/Badge";
import type { TutorialContent } from "@/types";
import {
  formatExerciseNameForDisplay,
  formatTutorialLevelRepsBadge,
} from "@/lib/curriculum/exerciseNames";

const APPARATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Mat", label: "Mat" },
  { value: "Reformer", label: "Reformer" },
  { value: "Trapeze Cadillac", label: "Trapeze Cadillac" },
  { value: "Chair", label: "Chair" },
  { value: "Barrels", label: "Barrels" },
  { value: "Anatomy", label: "Anatomy" },
  { value: "Movement Principles", label: "Movement Principles" },
];

type BrowseMode = "exercise" | "muscle";

async function postTutorial(
  apparatus: string,
  exerciseOrMuscle: string
): Promise<{ ok: boolean; tutorial?: TutorialContent; error?: string }> {
  const res = await fetch("/api/agents/learn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apparatus,
      exercise_or_muscle: exerciseOrMuscle,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string"
          ? data.error
          : "Failed to load tutorial",
      tutorial: data.data?.tutorial as TutorialContent | undefined,
    };
  }
  return {
    ok: true,
    tutorial: data.data?.tutorial as TutorialContent,
  };
}

export default function LearnPage() {
  const [apparatus, setApparatus] = useState("All");
  const [browseMode, setBrowseMode] = useState<BrowseMode>("exercise");
  const [exerciseList, setExerciseList] = useState<string[]>([]);
  const [listChunkCount, setListChunkCount] = useState<number | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [muscleInput, setMuscleInput] = useState("");

  const [tutorial, setTutorial] = useState<TutorialContent | null>(null);
  const [navList, setNavList] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const [error, setError] = useState("");

  const cacheRef = useRef<Map<string, TutorialContent>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchExercises = useCallback(async () => {
    setListLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/agents/learn?apparatus=${encodeURIComponent(apparatus)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setExerciseList([]);
        setListChunkCount(null);
        setError(data.error ?? "Could not load exercises.");
        return;
      }
      if (data.success && Array.isArray(data.data?.exercises)) {
        setExerciseList(data.data.exercises as string[]);
        const n = data.data?.chunkCount;
        setListChunkCount(typeof n === "number" ? n : null);
      } else {
        setExerciseList([]);
        setListChunkCount(null);
      }
    } catch {
      setExerciseList([]);
      setListChunkCount(null);
      setError("Could not load exercises.");
    } finally {
      setListLoading(false);
    }
  }, [apparatus]);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    setSelectedExercise("");
    setExerciseFilter("");
    setTutorial(null);
    setNavList([]);
    setCurrentIndex(0);
    cacheRef.current.clear();
  }, [apparatus]);

  const filteredExercises = exerciseList.filter((ex) =>
    ex.toLowerCase().includes(exerciseFilter.trim().toLowerCase())
  );

  const loadTutorialForSubject = useCallback(
    async (subject: string, list: string[], index: number) => {
      const key = `${apparatus}|${subject}`;
      const cached = cacheRef.current.get(key);
      if (cached && !cached.error) {
        setTutorial(cached);
        setNavList(list);
        setCurrentIndex(index);
        setError("");
        return;
      }

      setTutorialLoading(true);
      setError("");
      try {
        const result = await postTutorial(apparatus, subject);
        if (!result.ok || !result.tutorial) {
          setError(result.error ?? "Failed to load tutorial");
          if (result.tutorial?.error) {
            setTutorial(null);
          }
          return;
        }
        if (result.tutorial.error) {
          setError(result.tutorial.error);
          setTutorial(null);
          return;
        }
        cacheRef.current.set(key, result.tutorial);
        setTutorial(result.tutorial);
        setNavList(list);
        setCurrentIndex(index);
      } catch {
        setError("Failed to load tutorial.");
        setTutorial(null);
      } finally {
        setTutorialLoading(false);
      }
    },
    [apparatus]
  );

  const handleTeachMe = async () => {
    if (browseMode === "exercise") {
      const ex = (selectedExercise.trim() || exerciseFilter.trim());
      if (!ex) {
        setError("Select an exercise from the list.");
        return;
      }
      const idx = exerciseList.indexOf(ex);
      const list =
        idx >= 0 && exerciseList.length > 0 ? exerciseList : [ex];
      const safeIdx = idx >= 0 ? idx : 0;
      await loadTutorialForSubject(ex, list, safeIdx);
    } else {
      const m = muscleInput.trim();
      if (!m) {
        setError("Enter a muscle group or area to study.");
        return;
      }
      await loadTutorialForSubject(m, [m], 0);
    }
  };

  const goPrev = async () => {
    if (currentIndex <= 0 || navList.length < 2) return;
    const nextIdx = currentIndex - 1;
    const subject = navList[nextIdx];
    await loadTutorialForSubject(subject, navList, nextIdx);
  };

  const goNext = async () => {
    if (currentIndex >= navList.length - 1 || navList.length < 2) return;
    const nextIdx = currentIndex + 1;
    const subject = navList[nextIdx];
    await loadTutorialForSubject(subject, navList, nextIdx);
  };

  useEffect(() => {
    if (!dropdownOpen) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [dropdownOpen]);

  const atStart = currentIndex <= 0 || navList.length < 2;
  const atEnd = currentIndex >= navList.length - 1 || navList.length < 2;
  const showTutorial = tutorial && !tutorial.error;
  const folderForBadge =
    tutorial?.source_folder?.trim() || tutorial?.manual_image?.folder_name || null;
  const tutorialLevelRepsBadge =
    showTutorial && tutorial ? formatTutorialLevelRepsBadge(tutorial) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 space-y-4 rounded-sm border border-clara-border bg-clara-surface p-5">
        <Select
          label="Apparatus"
          options={APPARATUS_OPTIONS}
          value={apparatus}
          onChange={(e) => setApparatus(e.target.value)}
          disabled={tutorialLoading}
        />

        <div>
          <span className="mb-2 block text-sm font-medium text-clara-deep">
            Browse by
          </span>
          <div className="flex gap-0 rounded-sm border border-clara-border bg-clara-bg p-0.5">
            <button
              type="button"
              onClick={() => setBrowseMode("exercise")}
              disabled={tutorialLoading}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                browseMode === "exercise"
                  ? "bg-clara-primary text-white"
                  : "text-clara-deep hover:bg-clara-border/60"
              }`}
            >
              Exercise
            </button>
            <button
              type="button"
              onClick={() => setBrowseMode("muscle")}
              disabled={tutorialLoading}
              className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-colors ${
                browseMode === "muscle"
                  ? "bg-clara-primary text-white"
                  : "text-clara-deep hover:bg-clara-border/60"
              }`}
            >
              Muscle Group
            </button>
          </div>
        </div>

        {browseMode === "exercise" ? (
          <div className="relative" ref={panelRef}>
            <label className="mb-1 block text-sm font-bold text-clara-deep">
              Exercise
            </label>
            <input
              type="text"
              value={dropdownOpen ? exerciseFilter : selectedExercise}
              onChange={(e) => {
                setExerciseFilter(e.target.value);
                setDropdownOpen(true);
              }}
              onFocus={() => {
                setExerciseFilter(selectedExercise);
                setDropdownOpen(true);
              }}
              placeholder={
                listLoading ? "Loading exercises…" : "Search exercises…"
              }
              disabled={tutorialLoading || listLoading}
              className="w-full rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40"
            />
            {listLoading && (
              <div className="mt-2 flex items-center gap-2 text-sm text-clara-deep">
                <LoadingSpinner size="sm" />
                Loading exercises…
              </div>
            )}
            {dropdownOpen && !listLoading && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-sm border border-clara-border bg-clara-surface py-1">
                {filteredExercises.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-clara-muted">
                    {exerciseList.length > 0
                      ? "No matches for your search — clear the box or pick another exercise."
                      : listChunkCount !== null && listChunkCount > 0
                        ? "No exercise titles found in your text for this apparatus. Re-ingest PDFs (tagged extraction) or try All."
                        : listChunkCount === 0
                          ? "No curriculum for this apparatus yet. Ingest materials or try All."
                          : "No exercises loaded — try another apparatus or ingest materials."}
                  </li>
                ) : (
                  filteredExercises.slice(0, 80).map((ex) => (
                    <li key={ex}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-clara-deep hover:bg-clara-border"
                        onClick={() => {
                          setSelectedExercise(ex);
                          setExerciseFilter(ex);
                          setDropdownOpen(false);
                        }}
                      >
                        {ex}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        ) : (
          <Input
            label="Muscle group or area"
            placeholder='e.g. "hamstrings", "obliques", "spine extensors"'
            value={muscleInput}
            onChange={(e) => setMuscleInput(e.target.value)}
            disabled={tutorialLoading}
          />
        )}

        <Button
          type="button"
          variant="primary"
          onClick={handleTeachMe}
          disabled={tutorialLoading}
          className="w-full sm:w-auto"
        >
          {tutorialLoading ? (
            <span className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Teaching…
            </span>
          ) : (
            "Teach Me"
          )}
        </Button>
      </div>

      <ErrorMessage message={error} />

      {!showTutorial && !tutorialLoading && (
        <p className="mt-6 text-center text-sm text-clara-muted">
          Select an apparatus and exercise to begin learning.
        </p>
      )}

      {tutorialLoading && !tutorial && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {showTutorial && tutorial && (
        <div className="space-y-6">
          {tutorial.manual_image && (
            <ManualPageImage
              fileName={tutorial.manual_image.file_name}
              folderName={tutorial.manual_image.folder_name}
            />
          )}

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-clara-accent md:text-3xl">
              {formatExerciseNameForDisplay(tutorial.exercise_name)}
            </h2>
            {tutorialLevelRepsBadge ? (
              <div className="mt-2">
                <Badge
                  variant="grey"
                  className="text-[0.7rem] font-medium normal-case"
                >
                  {tutorialLevelRepsBadge}
                </Badge>
              </div>
            ) : null}
            <div className="mt-2">
              <SourceBadge folderName={folderForBadge} variant="from" />
            </div>
          </div>

          <TutorialSections tutorial={tutorial} />

          {navList.length > 0 && (
            <div className="flex flex-col items-center gap-3 border-t border-clara-border pt-6 sm:flex-row sm:justify-between">
              <p className="text-sm text-clara-deep">
                Exercise {currentIndex + 1} of {navList.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goPrev()}
                  disabled={tutorialLoading || atStart}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => goNext()}
                  disabled={tutorialLoading || atEnd}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
