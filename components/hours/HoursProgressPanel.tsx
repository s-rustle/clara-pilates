import type { HourLog, HourTargets } from "@/types";
import {
  calculateTotalHours,
  calculatePracticalHours,
  calculateScheduledHours,
  calculateGaps,
  formatHours,
  getProgressPercent,
  resolveHourTargets,
} from "@/lib/utils/hours";
import ProgressBar from "@/components/ui/ProgressBar";

interface HoursProgressPanelProps {
  logs: HourLog[];
  /** When omitted, Balanced Body defaults (70 / 150 / 150 / 536) apply. */
  hourTargets?: Partial<HourTargets> | null;
}

export default function HoursProgressPanel({
  logs,
  hourTargets,
}: HoursProgressPanelProps) {
  const t = resolveHourTargets(hourTargets);
  const totalLogged = calculateTotalHours(logs);
  const matLogged = calculatePracticalHours(logs, "mat");
  const reformerLogged = calculatePracticalHours(logs, "reformer");
  const apparatusLogged = calculatePracticalHours(logs, "apparatus");
  const scheduledHours = calculateScheduledHours(logs);
  const gaps = calculateGaps(logs, hourTargets);

  const totalPercent = getProgressPercent(totalLogged, t.total);
  const matPercent = getProgressPercent(matLogged, t.mat_practical);
  const reformerPercent = getProgressPercent(reformerLogged, t.reformer_practical);
  const apparatusPercent = getProgressPercent(
    apparatusLogged,
    t.apparatus_practical
  );

  const hasAnyGaps =
    gaps.total > 0 || gaps.mat > 0 || gaps.reformer > 0 || gaps.apparatus > 0;

  return (
    <div className="space-y-6">
      <div>
        <ProgressBar
          label="Total Hours"
          value={totalPercent}
          metric={`${Math.round(totalPercent)}%`}
          caption={`${formatHours(totalLogged)} of ${t.total} hours logged`}
          tone="accent"
        />
      </div>

      <div className="space-y-4">
        <ProgressBar
          label="Mat Practical"
          value={matPercent}
          metric={`${Math.round(matPercent)}%`}
          caption={`${formatHours(matLogged)} of ${t.mat_practical} hours`}
          tone="accent"
        />
        <ProgressBar
          label="Reformer Practical"
          value={reformerPercent}
          metric={`${Math.round(reformerPercent)}%`}
          caption={`${formatHours(reformerLogged)} of ${t.reformer_practical} hours`}
          tone="accent"
        />
        <ProgressBar
          label="Apparatus Practical"
          value={apparatusPercent}
          metric={`${Math.round(apparatusPercent)}%`}
          caption={`${formatHours(apparatusLogged)} of ${t.apparatus_practical} hours`}
          tone="accent"
        />
      </div>

      <div className="border-t border-clara-border pt-4">
        <div className="space-y-1 text-sm text-clara-deep">
          {hasAnyGaps ? (
            <>
              {gaps.total > 0 && (
                <p>
                  You need {gaps.total} more total hours to meet your target.
                </p>
              )}
              {gaps.mat > 0 && (
                <p>
                  You need {gaps.mat} more Mat practical hours to meet your
                  target.
                </p>
              )}
              {gaps.reformer > 0 && (
                <p>
                  You need {gaps.reformer} more Reformer practical hours to meet
                  your target.
                </p>
              )}
              {gaps.apparatus > 0 && (
                <p>
                  You need {gaps.apparatus} more Apparatus practical hours to
                  meet your target.
                </p>
              )}
            </>
          ) : (
            <p>All practical targets complete. Great work.</p>
          )}
        </div>
      </div>

      {scheduledHours > 0 && (
        <p className="text-sm text-clara-muted">
          You have {formatHours(scheduledHours)} hours scheduled — not yet
          counted toward progress.
        </p>
      )}
    </div>
  );
}
