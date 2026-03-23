"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { AnatomyDiagramMuscleId } from "@/lib/quiz/anatomyDiagramMuscles";

const FILL_DEFAULT = "#E4D5C0";
const FILL_HOVER = "#D4A574";
const FILL_SELECTED = "#C4522A";
const FILL_CORRECT = "#E8C84A";
const FILL_INCORRECT = "#9B2335";
const STROKE = "#A89882";

type ViewSide = "front" | "back";

interface RegionPath {
  muscle: AnatomyDiagramMuscleId;
  d: string;
  /** Optional: only render on this side (default: both if listed in both view groups) */
  side?: ViewSide;
}

const FRONT_REGIONS: RegionPath[] = [
  {
    muscle: "Pectorals",
    d: "M 92 88 C 92 78 118 72 140 78 C 162 72 188 78 188 88 L 186 138 C 160 148 120 148 94 138 Z",
  },
  {
    muscle: "Shoulder Stabilizers",
    d: "M 70 82 C 85 68 95 62 108 70 L 102 98 C 88 94 78 90 70 82 Z M 210 82 C 195 68 185 62 172 70 L 178 98 C 192 94 202 90 210 82 Z",
  },
  {
    muscle: "Abdominals",
    d: "M 108 142 L 172 142 L 168 218 L 112 218 Z",
  },
  {
    muscle: "Core",
    d: "M 102 222 C 118 232 162 232 178 222 L 174 268 C 140 282 106 268 102 222 Z",
  },
  {
    muscle: "Hip Flexors",
    d: "M 108 268 L 128 268 L 124 298 L 108 292 Z M 152 268 L 172 268 L 172 292 L 156 298 Z",
  },
  {
    muscle: "Quadriceps",
    d: "M 95 278 L 132 278 L 126 408 L 102 418 Z M 148 278 L 185 278 L 178 418 L 154 408 Z",
  },
  {
    muscle: "Adductors",
    d: "M 128 300 L 140 380 L 152 300 L 140 288 Z",
  },
];

const BACK_REGIONS: RegionPath[] = [
  {
    muscle: "Shoulder Stabilizers",
    d: "M 62 78 C 78 62 95 58 112 68 L 108 100 C 88 92 72 86 62 78 Z M 218 78 C 202 62 185 58 168 68 L 172 100 C 192 92 208 86 218 78 Z",
  },
  {
    muscle: "Latissimus Dorsi",
    d: "M 72 95 C 95 88 118 92 140 105 C 162 92 185 88 208 95 L 200 195 C 175 185 105 185 80 195 Z",
  },
  {
    muscle: "Spinal Extensors",
    d: "M 128 88 L 152 88 L 150 228 L 130 228 Z",
  },
  {
    muscle: "Hip Rotators",
    d: "M 108 232 L 132 232 L 128 268 L 112 268 Z M 148 232 L 172 232 L 168 268 L 152 268 Z",
  },
  {
    muscle: "Glutes",
    d: "M 100 228 C 118 218 162 218 180 228 L 176 278 C 140 292 104 278 100 228 Z",
  },
  {
    muscle: "Hamstrings",
    d: "M 98 278 L 132 278 L 124 412 L 104 422 Z M 148 278 L 182 278 L 176 422 L 156 412 Z",
  },
];

function SilhouetteFront() {
  return (
    <path
      d="M 140 20 C 118 20 100 38 100 58 C 100 68 104 76 110 82 C 88 92 78 115 78 140 L 82 175 L 72 185 L 68 255 L 78 265 L 88 400 L 98 430 L 108 520 L 118 528 L 132 528 L 138 440 L 140 400 L 142 440 L 148 528 L 162 528 L 172 520 L 182 430 L 192 400 L 202 265 L 212 255 L 208 185 L 198 175 L 202 140 C 202 115 192 92 170 82 C 176 76 180 68 180 58 C 180 38 162 20 140 20 Z"
      fill="#DDD2C4"
      stroke={STROKE}
      strokeWidth={1.2}
      className="pointer-events-none"
    />
  );
}

function SilhouetteBack() {
  return (
    <path
      d="M 140 20 C 118 20 100 38 100 58 C 100 68 104 76 110 82 C 88 92 78 115 78 140 L 82 178 L 72 188 L 68 258 L 78 268 L 88 402 L 98 432 L 108 522 L 118 530 L 132 530 L 138 442 L 140 402 L 142 442 L 148 530 L 162 530 L 172 522 L 182 432 L 192 402 L 202 268 L 212 258 L 208 188 L 198 178 L 202 140 C 202 115 192 92 170 82 C 176 76 180 68 180 58 C 180 38 162 20 140 20 Z"
      fill="#DDD2C4"
      stroke={STROKE}
      strokeWidth={1.2}
      className="pointer-events-none"
    />
  );
}

interface AnatomyDiagramProps {
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
  const [side, setSide] = useState<ViewSide>("front");
  const [hoverMuscle, setHoverMuscle] = useState<string | null>(null);

  const regions = side === "front" ? FRONT_REGIONS : BACK_REGIONS;

  const fillFor = (muscle: string): string => {
    if (revealAnswer && correctMuscle && muscle === correctMuscle) {
      return FILL_CORRECT;
    }
    if (
      revealAnswer &&
      selectedMuscle &&
      muscle === selectedMuscle &&
      correctMuscle &&
      muscle !== correctMuscle
    ) {
      return FILL_INCORRECT;
    }
    if (!revealAnswer && selectedMuscle === muscle) {
      return FILL_SELECTED;
    }
    if (!revealAnswer && hoverMuscle === muscle) {
      return FILL_HOVER;
    }
    return FILL_DEFAULT;
  };

  const interactive = !revealAnswer;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-clara-deep">
        Click the region:{" "}
        <span className="text-clara-accent">{targetMuscle}</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setSide("front")}
          className={clsx(
            "rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors",
            side === "front"
              ? "border-clara-primary bg-clara-primary text-white"
              : "border-clara-highlight bg-clara-surface text-clara-deep hover:bg-clara-highlight/50"
          )}
        >
          Front
        </button>
        <button
          type="button"
          onClick={() => setSide("back")}
          className={clsx(
            "rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors",
            side === "back"
              ? "border-clara-primary bg-clara-primary text-white"
              : "border-clara-highlight bg-clara-surface text-clara-deep hover:bg-clara-highlight/50"
          )}
        >
          Back
        </button>
      </div>
      <div className="flex justify-center overflow-x-auto rounded-sm border border-clara-highlight bg-clara-bg p-4">
        <svg
          viewBox="0 0 280 560"
          className="h-auto max-h-[min(70vh,520px)] w-full max-w-[280px]"
          role="img"
          aria-label={`Anatomical figure ${side} view; select a muscle region.`}
        >
          <title>Anatomy diagram {side} view</title>
          {side === "front" ? <SilhouetteFront /> : <SilhouetteBack />}
          {regions.map(({ muscle, d }) => (
            <path
              key={`${side}-${muscle}-${d.slice(0, 12)}`}
              data-muscle={muscle}
              d={d}
              fill={fillFor(muscle)}
              stroke={STROKE}
              strokeWidth={0.8}
              className={clsx(
                interactive ? "cursor-pointer transition-[fill] duration-150" : "cursor-default"
              )}
              onMouseEnter={() => interactive && setHoverMuscle(muscle)}
              onMouseLeave={() => interactive && setHoverMuscle(null)}
              onClick={() => interactive && onSelect(muscle)}
              onKeyDown={(e) => {
                if (!interactive) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(muscle);
                }
              }}
              tabIndex={interactive ? 0 : -1}
              role="button"
              aria-label={`Muscle region ${muscle}`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
