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
import Card from "@/components/ui/Card";

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
          sublabel={`${formatHours(totalLogged)} of ${t.total} hours logged`}
        />
      </div>

      <div className="space-y-4">
        <ProgressBar
          label="Mat Practical"
          value={matPercent}
          sublabel={`${formatHours(matLogged)} of ${t.mat_practical} hours`}
        />
        <ProgressBar
          label="Reformer Practical"
          value={reformerPercent}
          sublabel={`${formatHours(reformerLogged)} of ${t.reformer_practical} hours`}
        />
        <ProgressBar
          label="Apparatus Practical"
          value={apparatusPercent}
          sublabel={`${formatHours(apparatusLogged)} of ${t.apparatus_practical} hours`}
        />
      </div>

      <Card>
        <div className="space-y-1 text-clara-deep">
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
      </Card>

      {scheduledHours > 0 && (
        <p className="text-sm text-clara-muted">
          You have {formatHours(scheduledHours)} hours scheduled — not yet
          counted toward progress.
        </p>
      )}
    </div>
  );
}
