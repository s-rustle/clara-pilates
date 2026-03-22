import type { HourLog } from "@/types";
import {
  calculateTotalHours,
  calculatePracticalHours,
  calculateScheduledHours,
  calculateGaps,
  formatHours,
  getProgressPercent,
} from "@/lib/utils/hours";
import ProgressBar from "@/components/ui/ProgressBar";
import Card from "@/components/ui/Card";

interface HoursProgressPanelProps {
  logs: HourLog[];
}

const MAT_TARGET = 70;
const REFORMER_TARGET = 150;
const APPARATUS_TARGET = 150;
const TOTAL_TARGET = 536;

export default function HoursProgressPanel({ logs }: HoursProgressPanelProps) {
  const totalLogged = calculateTotalHours(logs);
  const matLogged = calculatePracticalHours(logs, "mat");
  const reformerLogged = calculatePracticalHours(logs, "reformer");
  const apparatusLogged = calculatePracticalHours(logs, "apparatus");
  const scheduledHours = calculateScheduledHours(logs);
  const gaps = calculateGaps(logs);

  const totalPercent = getProgressPercent(totalLogged, TOTAL_TARGET);
  const matPercent = getProgressPercent(matLogged, MAT_TARGET);
  const reformerPercent = getProgressPercent(reformerLogged, REFORMER_TARGET);
  const apparatusPercent = getProgressPercent(
    apparatusLogged,
    APPARATUS_TARGET
  );

  const hasAnyGaps =
    gaps.total > 0 || gaps.mat > 0 || gaps.reformer > 0 || gaps.apparatus > 0;

  return (
    <div className="space-y-6">
      <div>
        <ProgressBar
          label="Total Hours"
          value={totalPercent}
          sublabel={`${formatHours(totalLogged)} of 536 hours logged`}
        />
      </div>

      <div className="space-y-4">
        <ProgressBar
          label="Mat Practical"
          value={matPercent}
          sublabel={`${formatHours(matLogged)} of 70 hours`}
        />
        <ProgressBar
          label="Reformer Practical"
          value={reformerPercent}
          sublabel={`${formatHours(reformerLogged)} of 150 hours`}
        />
        <ProgressBar
          label="Apparatus Practical"
          value={apparatusPercent}
          sublabel={`${formatHours(apparatusLogged)} of 150 hours`}
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
