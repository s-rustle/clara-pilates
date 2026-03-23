import type { HourLog, HourTargets } from "@/types";
import { DEFAULT_HOUR_TARGETS } from "@/types";

export function resolveHourTargets(
  raw: Partial<HourTargets> | null | undefined
): HourTargets {
  return {
    mat_practical:
      typeof raw?.mat_practical === "number" &&
      Number.isFinite(raw.mat_practical) &&
      raw.mat_practical > 0
        ? raw.mat_practical
        : DEFAULT_HOUR_TARGETS.mat_practical,
    reformer_practical:
      typeof raw?.reformer_practical === "number" &&
      Number.isFinite(raw.reformer_practical) &&
      raw.reformer_practical > 0
        ? raw.reformer_practical
        : DEFAULT_HOUR_TARGETS.reformer_practical,
    apparatus_practical:
      typeof raw?.apparatus_practical === "number" &&
      Number.isFinite(raw.apparatus_practical) &&
      raw.apparatus_practical > 0
        ? raw.apparatus_practical
        : DEFAULT_HOUR_TARGETS.apparatus_practical,
    total:
      typeof raw?.total === "number" &&
      Number.isFinite(raw.total) &&
      raw.total > 0
        ? raw.total
        : DEFAULT_HOUR_TARGETS.total,
  };
}

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

export function calculateGaps(
  logs: HourLog[],
  targets?: Partial<HourTargets> | null
): HoursGaps {
  const t = resolveHourTargets(targets);
  const totalLogged = calculateTotalHours(logs);
  const matLogged = calculatePracticalHours(logs, "mat");
  const reformerLogged = calculatePracticalHours(logs, "reformer");
  const apparatusLogged = calculatePracticalHours(logs, "apparatus");

  return {
    total: Math.max(0, roundToOneDecimal(t.total - totalLogged)),
    mat: Math.max(0, roundToOneDecimal(t.mat_practical - matLogged)),
    reformer: Math.max(
      0,
      roundToOneDecimal(t.reformer_practical - reformerLogged)
    ),
    apparatus: Math.max(
      0,
      roundToOneDecimal(t.apparatus_practical - apparatusLogged)
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
