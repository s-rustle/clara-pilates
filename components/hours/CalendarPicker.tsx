"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarPickerProps {
  value: string;
  onChange: (date: string) => void;
  loggedDates?: string[];
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];


function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): Date[] {
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function getMondayOffset(date: Date): number {
  const day = date.getDay();
  return (day + 6) % 7;
}

export default function CalendarPicker({
  value,
  onChange,
  loggedDates = [],
}: CalendarPickerProps) {
  const valueDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(() => ({
    year: valueDate.getFullYear(),
    month: valueDate.getMonth(),
  }));
  const [focusedDate, setFocusedDate] = useState<string>(value || toISO(new Date()));
  const gridRef = useRef<HTMLDivElement>(null);

  const loggedSet = new Set(loggedDates);

  const goPrevMonth = useCallback(() => {
    setViewDate((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 }
    );
  }, []);

  const goNextMonth = useCallback(() => {
    setViewDate((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 }
    );
  }, []);

  const handleSelect = useCallback(
    (dateStr: string) => {
      onChange(dateStr);
      setFocusedDate(dateStr);
    },
    [onChange]
  );

  useEffect(() => {
    if (value) {
      queueMicrotask(() => setFocusedDate(value));
    }
  }, [value]);

  const todayISO = toISO(new Date());
  const firstOfMonth = new Date(viewDate.year, viewDate.month, 1);
  const padding = getMondayOffset(firstOfMonth);
  const days = getDaysInMonth(viewDate.year, viewDate.month);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(e.key))
        return;

      e.preventDefault();
      const current = new Date(focusedDate);

      if (e.key === "Enter") {
        handleSelect(focusedDate);
        return;
      }

      const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" ? -7 : 7;
      current.setDate(current.getDate() + step);

      const newISO = toISO(current);
      setFocusedDate(newISO);

      const newYear = current.getFullYear();
      const newMonth = current.getMonth();
      if (newYear !== viewDate.year || newMonth !== viewDate.month) {
        setViewDate({ year: newYear, month: newMonth });
      }
    },
    [focusedDate, viewDate, handleSelect]
  );

  return (
    <div
      ref={gridRef}
      tabIndex={0}
      role="grid"
      aria-label="Calendar"
      onKeyDown={handleKeyDown}
      className="outline-none"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded p-1 text-clara-deep hover:bg-clara-border"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-clara-deep">
          {new Date(viewDate.year, viewDate.month).toLocaleString("default", {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded p-1 text-clara-deep hover:bg-clara-border"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {DAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-1 text-center text-xs font-medium text-clara-deep"
          >
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: padding }, (_, i) => (
          <div key={`pad-${i}`} className="h-9" />
        ))}
        {days.map((date) => {
          const dateISO = toISO(date);
          const isSelected = value === dateISO;
          const isToday = dateISO === todayISO;
          const hasLogs = loggedSet.has(dateISO);
          const isFocused = focusedDate === dateISO;

          return (
            <button
              key={dateISO}
              type="button"
              onClick={() => handleSelect(dateISO)}
              className={`relative flex h-9 w-9 flex-col items-center justify-center rounded text-sm transition-colors ${
                isSelected
                  ? "bg-clara-primary text-white"
                  : isToday
                    ? "border-2 border-clara-accent text-clara-deep hover:bg-clara-border"
                    : "text-clara-deep hover:bg-clara-border"
              } ${isFocused && !isSelected ? "ring-2 ring-clara-primary ring-offset-1" : ""}`}
              aria-label={`Select ${dateISO}${isSelected ? " (selected)" : ""}`}
            >
              <span>{date.getDate()}</span>
              {hasLogs && (
                <span
                  className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                    isSelected ? "bg-clara-bg" : "bg-clara-border"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
