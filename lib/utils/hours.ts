import type { HourLog } from "@/types";

const TOTAL_TARGET = 536;
const MAT_PRACTICAL_TARGET = 70;
const REFORMER_PRACTICAL_TARGET = 150;
const APPARATUS_PRACTICAL_TARGET = 150;

function roundToOneDecimal(n: number): number {
  return Math.round(n * 10) / 10;
}

function minutesToHours(minutes: number): number {
  return roundToOneDecimal(minutes / 60);
}

export function calculateTotalHours(logs: HourLog[]): number {
  const totalMinutes = logs
    .filter((log) => log.status === "logged" || log.status === "complete")
    .reduce((sum, log) => sum + log.duration_minutes, 0);
  return minutesToHours(totalMinutes);
}

const MAT_CATEGORIES = ["Mat 1", "Mat 2", "Mat 3"];
const REFORMER_CATEGORIES = ["Reformer 1", "Reformer 2", "Reformer 3"];
const APPARATUS_CATEGORIES = ["Trapeze Cadillac", "Chair", "Barrels"];

function getCategoriesForType(
  type: "mat" | "reformer" | "apparatus"
): string[] {
  switch (type) {
    case "mat":
      return MAT_CATEGORIES;
    case "reformer":
      return REFORMER_CATEGORIES;
    case "apparatus":
      return APPARATUS_CATEGORIES;
  }
}

export function calculatePracticalHours(
  logs: HourLog[],
  type: "mat" | "reformer" | "apparatus"
): number {
  const categories = getCategoriesForType(type);
  const totalMinutes = logs
    .filter(
      (log) =>
        log.sub_type === "Practical" &&
        (log.status === "logged" || log.status === "complete") &&
        categories.includes(log.category)
    )
    .reduce((sum, log) => sum + log.duration_minutes, 0);
  return minutesToHours(totalMinutes);
}

export function calculateScheduledHours(logs: HourLog[]): number {
  const totalMinutes = logs
    .filter((log) => log.status === "scheduled")
    .reduce((sum, log) => sum + log.duration_minutes, 0);
  return minutesToHours(totalMinutes);
}

export interface HoursGaps {
  total: number;
  mat: number;
  reformer: number;
  apparatus: number;
}

export function calculateGaps(logs: HourLog[]): HoursGaps {
  const totalLogged = calculateTotalHours(logs);
  const matLogged = calculatePracticalHours(logs, "mat");
  const reformerLogged = calculatePracticalHours(logs, "reformer");
  const apparatusLogged = calculatePracticalHours(logs, "apparatus");

  return {
    total: Math.max(0, roundToOneDecimal(TOTAL_TARGET - totalLogged)),
    mat: Math.max(0, roundToOneDecimal(MAT_PRACTICAL_TARGET - matLogged)),
    reformer: Math.max(
      0,
      roundToOneDecimal(REFORMER_PRACTICAL_TARGET - reformerLogged)
    ),
    apparatus: Math.max(
      0,
      roundToOneDecimal(APPARATUS_PRACTICAL_TARGET - apparatusLogged)
    ),
  };
}

export function formatHours(hours: number): string {
  if (hours === 0) return "0m";
  const wholeHours = Math.floor(hours);
  const remainingMinutes = Math.round((hours - wholeHours) * 60);
  const parts: string[] = [];
  if (wholeHours > 0) parts.push(`${wholeHours}h`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
  return parts.join(" ") || "0m";
}

export function getProgressPercent(logged: number, target: number): number {
  if (target === 0) return 0;
  const percent = (logged / target) * 100;
  return roundToOneDecimal(Math.min(100, percent));
}
