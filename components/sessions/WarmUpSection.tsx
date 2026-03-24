"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WarmUpMove } from "@/types";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

const WARM_UP_CATALOG = [
  "Pelvic Floor Engagement",
  "Breathing",
  "Imprint",
  "Pelvic Clock",
  "Ribcage Placement",
  "Scapular Movement",
  "Head/Neck Placement",
  "Stretching",
  "Knee Folds",
  "Leg Slides",
] as const;

export interface WarmUpSectionProps {
  moves: WarmUpMove[];
  onChange: (moves: WarmUpMove[]) => void;
  disabled?: boolean;
}

export default function WarmUpSection({
  moves,
  onChange,
  disabled = false,
}: WarmUpSectionProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...WARM_UP_CATALOG];
    return WARM_UP_CATALOG.filter((m) => m.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function addMove(name: string) {
    onChange([...moves, { move_name: name, sets: 1, reps: 8 }]);
    setQuery("");
    setOpen(false);
  }

  function updateMove(index: number, patch: Partial<WarmUpMove>) {
    const next = moves.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  }

  function removeMove(index: number) {
    onChange(moves.filter((_, i) => i !== index));
  }

  function moveIndex(from: number, to: number) {
    if (to < 0 || to >= moves.length) return;
    const next = [...moves];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-clara-accent">
        Pre-Pilates Warm-Up
      </h2>

      <div className="relative" ref={panelRef}>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className="inline-flex items-center gap-1"
        >
          Add warm-up move
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-full max-w-md rounded-sm border border-clara-border bg-clara-surface p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search moves…"
              className="mb-2 w-full rounded-sm border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40"
              autoFocus
            />
            <ul className="max-h-48 overflow-y-auto text-sm">
              {filtered.length === 0 ? (
                <li className="px-2 py-2 text-clara-muted">No matches</li>
              ) : (
                filtered.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1.5 text-left text-clara-deep hover:bg-clara-border"
                      onClick={() => addMove(name)}
                    >
                      {name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {moves.length === 0 ? (
        <p className="rounded-sm border border-dashed border-clara-border bg-clara-bg/50 px-3 py-6 text-center text-sm text-clara-muted">
          Add at least one warm-up move
        </p>
      ) : (
        <ul className="space-y-2">
          {moves.map((move, index) => (
            <li
              key={`${move.move_name}-${index}`}
              className="flex flex-wrap items-end gap-2 rounded-sm border border-clara-border bg-clara-bg px-3 py-2"
            >
              <div className="min-w-[140px] flex-1">
                <span className="text-sm font-medium text-clara-deep">
                  {move.move_name}
                </span>
              </div>
              <div className="w-20">
                <Input
                  label="Sets"
                  type="number"
                  value={String(move.sets)}
                  onChange={(e) =>
                    updateMove(index, {
                      sets: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="w-20">
                <Input
                  label="Reps"
                  type="number"
                  value={String(move.reps)}
                  onChange={(e) =>
                    updateMove(index, {
                      reps: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                  disabled={disabled}
                />
              </div>
              <div className="flex items-center gap-0.5 pb-0.5">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={disabled || index === 0}
                  onClick={() => moveIndex(index, index - 1)}
                  className="rounded p-1 text-clara-deep hover:bg-clara-border disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={disabled || index === moves.length - 1}
                  onClick={() => moveIndex(index, index + 1)}
                  className="rounded p-1 text-clara-deep hover:bg-clara-border disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Remove"
                  disabled={disabled}
                  onClick={() => removeMove(index)}
                  className="rounded p-1 text-clara-deep hover:bg-clara-border"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
