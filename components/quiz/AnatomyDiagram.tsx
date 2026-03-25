"use client";

/**
 * Human figure via `react-body-highlighter` (MIT). Body Maps CDN SVGs
 * (bzaman/bodymap on jsDelivr) were unavailable (404); this package provides
 * anterior/posterior muscle polygons with stable ids.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { clsx } from "clsx";
import type { IMuscleStats } from "react-body-highlighter";
import { MuscleType } from "react-body-highlighter";
import {
  buildHighlighterData,
  rbhMuscleToClara,
} from "@/lib/quiz/anatomyDiagramRbMappings";
import type { DiagramSide } from "@/lib/quiz/anatomyDiagramRbMappings";
import { claraPalette } from "@/lib/design/claraPalette";

const BODY_FILL = claraPalette["diagram-body"];

export const ABDOMINAL_LAYER_NOTE =
  "Includes: Rectus Abdominis, Transverse Abdominis (TVA), Internal/External Obliques.";

const Model = dynamic(
  () => import("react-body-highlighter").then((m) => m.default),
  {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(420px,55vh)] min-h-[280px] items-center justify-center text-sm text-clara-muted">
      Loading diagram…
    </div>
  ),
  }
);

interface AnatomyDiagramProps {
  /** Used to resolve abs vs Core click label only; not shown in the UI (active recall). */
  targetMuscle: string;
  onSelect: (muscle: string) => void;
  selectedMuscle?: string;
  revealAnswer?: boolean;
  correctMuscle?: string;
}

export default function AnatomyDiagram({
  targetMuscle,
  onSelect,
  selectedMuscle,
  revealAnswer,
  correctMuscle,
}: AnatomyDiagramProps) {
  const [side, setSide] = useState<DiagramSide>("front");
  const [showAbdominalNote, setShowAbdominalNote] = useState(false);

  const switchSide = (next: DiagramSide) => {
    setShowAbdominalNote(false);
    setSide(next);
  };

  const { data, highlightedColors } = useMemo(
    () =>
      buildHighlighterData({
        side,
        revealAnswer: !!revealAnswer,
        correctMuscle,
        selectedMuscle,
      }),
    [side, revealAnswer, correctMuscle, selectedMuscle]
  );

  const interactive = !revealAnswer;

  const handleMuscleClick = (stats: IMuscleStats) => {
    if (stats.muscle === MuscleType.ABS) {
      setShowAbdominalNote(true);
      if (targetMuscle === "Core" || targetMuscle === "Abdominals") {
        onSelect(targetMuscle);
        return;
      }
    }
    const clara = rbhMuscleToClara(stats.muscle);
    if (clara) {
      onSelect(clara);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-clara-deep">
        <span className="font-medium text-clara-deep">Active recall:</span>{" "}
        Select the region that answers the question, then type the muscle{" "}
        <span className="font-medium">group</span> name below. The diagram does
        not label answers for you.
      </p>
      <p className="text-xs text-clara-muted">
        Adductors and deep hip rotators use the <strong>Back</strong> view.
        Glutes and hip rotators share the same posterior region. On the front
        view, use the <strong>TVA</strong> marker for the deep abdominal layer.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchSide("front")}
          className={clsx(
            "rounded-none border px-3 py-1.5 text-sm font-medium transition-colors",
            side === "front"
              ? "border-clara-primary bg-clara-primary text-white"
              : "border-clara-border bg-clara-surface text-clara-deep hover:bg-clara-border/50"
          )}
        >
          Front
        </button>
        <button
          type="button"
          onClick={() => switchSide("back")}
          className={clsx(
            "rounded-none border px-3 py-1.5 text-sm font-medium transition-colors",
            side === "back"
              ? "border-clara-primary bg-clara-primary text-white"
              : "border-clara-border bg-clara-surface text-clara-deep hover:bg-clara-border/50"
          )}
        >
          Back
        </button>
      </div>
      <div className="flex justify-center overflow-x-auto rounded-none border border-clara-border bg-clara-bg p-4">
        <div className="relative w-full max-w-[240px]">
          <Model
            key={side}
            type={side === "front" ? "anterior" : "posterior"}
            data={data}
            bodyColor={BODY_FILL}
            {...(highlightedColors.length > 0
              ? { highlightedColors }
              : {})}
            onClick={interactive ? handleMuscleClick : undefined}
            style={{ width: "100%", maxWidth: 240 }}
            svgStyle={{
              maxHeight: "min(55vh, 480px)",
              display: "block",
            }}
          />
          {side === "front" && interactive && (
            <button
              type="button"
              aria-label="Transverse abdominis — abdominal layer note"
              title="Transverse abdominis (deep core)"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAbdominalNote(true);
              }}
              className="absolute left-[46%] top-[38%] z-10 -translate-x-1/2 rounded-[2px] border border-clara-deep/40 bg-clara-surface/95 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-clara-deep hover:bg-clara-border/50"
            >
              TVA
            </button>
          )}
        </div>
      </div>
      {showAbdominalNote && side === "front" && (
        <p
          className="rounded-none border border-clara-border bg-clara-surface/80 px-3 py-2 text-xs text-clara-deep"
          role="note"
        >
          {ABDOMINAL_LAYER_NOTE}
        </p>
      )}
    </div>
  );
}
