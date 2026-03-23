"use client";

import { useState, useEffect, useRef } from "react";
import { clsx } from "clsx";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";
import Button from "@/components/ui/Button";
import AnatomyDiagram from "@/components/quiz/AnatomyDiagram";

interface QuestionCardProps {
  question: string;
  currentIndex: number;
  totalCount: number;
  scoreSoFar: number;
  image_file_name?: string;
  folder_name?: string;
  question_type?: string;
  anatomy_options?: string[];
  selected_anatomy_option?: string | null;
  on_select_anatomy_option?: (option: string) => void;
  on_submit_anatomy?: () => void;
  anatomy_submit_loading?: boolean;
  /** Pin-the-muscle SVG quiz */
  target_muscle?: string;
  selected_muscle?: string | null;
  on_select_muscle?: (muscle: string) => void;
  /** Typed muscle-group recall; server grades with Examiner (Claude). */
  on_submit_diagram_recall?: (typedAnswer: string) => void;
  diagram_submit_loading?: boolean;
  reveal_diagram_answer?: boolean;
  correct_muscle?: string;
}

/** Renders question text with **exercise** marked segments in bold (matches source material style). */
function QuestionText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-base font-bold text-clara-strong">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function DiagramImage({
  file_name,
  folder_name,
  className,
}: {
  file_name: string;
  folder_name: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const apiUrl = `/api/drive/image?file_name=${encodeURIComponent(file_name)}&folder_name=${encodeURIComponent(folder_name)}`;
    fetch(apiUrl, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Image not found" : "Failed to load image");
        }
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        urlRef.current = objectUrl;
        setSrc(objectUrl);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [file_name, folder_name]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (error) {
    return <ErrorMessage message={error} />;
  }
  if (src) {
    return (
      <img
        src={src}
        alt="Anatomy diagram"
        className={
          className ??
          "max-h-64 w-auto rounded-sm border border-clara-highlight object-contain"
        }
      />
    );
  }
  return null;
}

export default function QuestionCard({
  question,
  currentIndex,
  totalCount,
  scoreSoFar,
  image_file_name,
  folder_name,
  question_type,
  anatomy_options,
  selected_anatomy_option,
  on_select_anatomy_option,
  on_submit_anatomy,
  anatomy_submit_loading,
  target_muscle,
  selected_muscle,
  on_select_muscle,
  on_submit_diagram_recall,
  diagram_submit_loading,
  reveal_diagram_answer,
  correct_muscle,
}: QuestionCardProps) {
  const isAnatomyMc = question_type === "anatomy_multiple_choice";
  const isAnatomyDiagram = question_type === "anatomy_diagram";
  const [diagramRecallText, setDiagramRecallText] = useState("");

  useEffect(() => {
    setDiagramRecallText("");
  }, [question, target_muscle]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-clara-deep">
        Question {currentIndex + 1} of {totalCount}
      </p>
      <p className="text-sm font-medium text-clara-accent">
        {scoreSoFar} correct so far
      </p>
      {!isAnatomyDiagram &&
        image_file_name &&
        folder_name && (
          <DiagramImage
            file_name={image_file_name}
            folder_name={folder_name}
            className={
              isAnatomyMc
                ? "max-h-80 w-auto max-w-full rounded-sm border border-clara-highlight object-contain"
                : undefined
            }
          />
        )}
      <QuestionText text={question} />
      {isAnatomyDiagram &&
        target_muscle &&
        on_select_muscle &&
        on_submit_diagram_recall && (
          <div className="mt-2 flex flex-col gap-4">
            <AnatomyDiagram
              targetMuscle={target_muscle}
              onSelect={on_select_muscle}
              selectedMuscle={selected_muscle ?? undefined}
              revealAnswer={reveal_diagram_answer}
              correctMuscle={correct_muscle}
            />
            {!reveal_diagram_answer && (
              <div className="flex flex-col gap-2">
                <label htmlFor="diagram-recall-input" className="sr-only">
                  Name this muscle group
                </label>
                <input
                  id="diagram-recall-input"
                  type="text"
                  value={diagramRecallText}
                  onChange={(e) => setDiagramRecallText(e.target.value)}
                  placeholder="Name this muscle group…"
                  disabled={diagram_submit_loading}
                  autoComplete="off"
                  className="w-full rounded-sm border border-clara-highlight bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button
                  variant="primary"
                  type="button"
                  onClick={() =>
                    on_submit_diagram_recall(diagramRecallText.trim())
                  }
                  disabled={
                    diagram_submit_loading ||
                    !selected_muscle ||
                    !diagramRecallText.trim()
                  }
                  className="w-full sm:w-auto"
                >
                  {diagram_submit_loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner size="sm" />
                      Evaluating…
                    </span>
                  ) : (
                    "Submit Answer"
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      {isAnatomyMc &&
        anatomy_options &&
        anatomy_options.length === 4 &&
        on_select_anatomy_option &&
        on_submit_anatomy && (
          <div className="mt-2 flex flex-col gap-2">
            {anatomy_options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => on_select_anatomy_option(opt)}
                className={clsx(
                  "w-full rounded-sm border px-4 py-3 text-left text-sm font-medium transition-colors",
                  selected_anatomy_option === opt
                    ? "border-clara-accent bg-clara-accent text-white"
                    : "border-clara-highlight bg-clara-surface text-clara-deep hover:border-clara-highlight"
                )}
              >
                {opt}
              </button>
            ))}
            <Button
              variant="primary"
              type="button"
              onClick={() => on_submit_anatomy()}
              disabled={
                anatomy_submit_loading ||
                !selected_anatomy_option
              }
              className="w-full sm:w-auto"
            >
              {anatomy_submit_loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner size="sm" />
                  Evaluating…
                </span>
              ) : (
                "Submit Answer"
              )}
            </Button>
          </div>
        )}
    </div>
  );
}
