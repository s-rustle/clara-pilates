"use client";

import Link from "next/link";

const EVALUATION_POINTS: { title: string; why: string }[] = [
  {
    title: "Anatomical accuracy",
    why: "Correct joint and muscle language keeps clients safe and matches how examiners expect you to teach.",
  },
  {
    title: "Starting position",
    why: "Clients need a clear setup before movement; vague setup leads to compensation and confusion.",
  },
  {
    title: "Breath",
    why: "Breath supports control and rhythm; pairing inhale/exhale with the right phase helps motor learning.",
  },
  {
    title: "Precautions",
    why: "Flagging contraindications and modifications protects clients and shows professional judgment.",
  },
  {
    title: "Client accessibility",
    why: "Cues should match the person in front of you—level, imagery, and pacing they can actually use.",
  },
];

export default function CueEducationPanel() {
  return (
    <details className="group rounded-sm border border-clara-highlight bg-clara-surface">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-clara-strong marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span
            className="text-clara-muted transition-transform group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          Learn about cues and how Clara gives feedback
        </span>
      </summary>
      <div className="border-t border-clara-highlight px-4 pb-4 pt-2 text-sm text-clara-deep">
        <p className="mb-3">
          A <strong className="text-clara-strong">verbal cue</strong> is a short,
          specific instruction—about alignment, effort, breath, or rhythm—that
          helps someone perform the exercise well. Strong cues are grounded in
          the repertoire and in how real bodies move.
        </p>
        <p className="mb-3">
          Good cues matter because they reduce guesswork, support safety, build
          confidence, and make your teaching easier to follow—especially under
          exam conditions when clarity counts.
        </p>
        <p className="mb-2 font-bold text-clara-strong">
          What Clara evaluates (and why)
        </p>
        <ul className="mb-4 flex list-none flex-col gap-2">
          {EVALUATION_POINTS.map(({ title, why }) => (
            <li key={title} className="border-l-2 border-clara-accent/50 pl-3">
              <span className="font-bold text-clara-strong">{title}.</span>{" "}
              {why}
            </li>
          ))}
        </ul>
        <p>
          For full tutorials (starting position, sequence, and images from your
          manual), open{" "}
          <Link
            href="/learn"
            className="font-bold text-clara-accent underline-offset-2 hover:underline"
          >
            Learn
          </Link>
          .
        </p>
      </div>
    </details>
  );
}
