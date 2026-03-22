import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import ReadinessCard from "@/components/dashboard/ReadinessCard";
import HoursSummaryCard from "@/components/dashboard/HoursSummaryCard";
import WeakSpotCard from "@/components/dashboard/WeakSpotCard";
import type { QuizSession } from "@/types";

const quickActionClass =
  "inline-flex items-center justify-center rounded-md bg-clara-primary px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-clara-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clara-primary";

function formatCompletedAt(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let recentSessions: Pick<
    QuizSession,
    "id" | "apparatus" | "topic" | "difficulty" | "score_percent" | "completed_at"
  >[] = [];

  if (user) {
    const { data } = await supabase
      .from("quiz_sessions")
      .select("id, apparatus, topic, difficulty, score_percent, completed_at")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(5);

    recentSessions = (data ?? []) as typeof recentSessions;
  }

  return (
    <div className="flex flex-col gap-6">
      <ReadinessCard />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="md:col-span-3">
          <HoursSummaryCard />
        </div>
        <div className="md:col-span-2">
          <WeakSpotCard />
        </div>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-clara-strong">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/study" className={quickActionClass}>
            Study
          </Link>
          <Link href="/quiz" className={quickActionClass}>
            Quiz
          </Link>
          <Link href="/sessions" className={quickActionClass}>
            Sessions
          </Link>
          <Link href="/hours" className={quickActionClass}>
            Log hours
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-bold text-clara-strong">
          Recent activity
        </h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-clara-deep">
            No completed quiz sessions yet. Finish a quiz to see it here.
          </p>
        ) : (
          <ul className="divide-y divide-clara-border text-sm text-clara-deep">
            {recentSessions.map((s) => {
              const label = [s.apparatus, s.topic].filter(Boolean).join(" · ");
              const score =
                typeof s.score_percent === "number"
                  ? `${Math.round(s.score_percent)}%`
                  : "—";
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-clara-strong">{label}</p>
                    <p className="text-xs text-clara-muted">{s.difficulty}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
                    <span className="text-clara-strong">{score}</span>
                    <time
                      className="text-xs text-clara-muted"
                      dateTime={s.completed_at ?? undefined}
                    >
                      {formatCompletedAt(s.completed_at)}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
