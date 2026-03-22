"use client";

import Card from "@/components/ui/Card";
import MarkdownBody from "@/components/ui/MarkdownBody";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SourceBadge from "./SourceBadge";
import type { SourceDocument, SourceFigure, SourceImage } from "@/types";

type Confidence = "confident" | "partial" | "not_found";

const CONFIDENCE_BADGE: Record<Confidence, { variant: "green" | "yellow" | "red"; label: string }> = {
  confident: { variant: "green", label: "Source confirmed" },
  partial: { variant: "yellow", label: "Partial match" },
  not_found: { variant: "red", label: "Not in your materials" },
};

const FOLLOW_UP_SUGGESTIONS = [
  {
    label: "Tell me more about this move",
    prompt:
      "Tell me more about this move — form details, precautions, and anything else in my curriculum materials.",
  },
  {
    label: "A good following exercise",
    prompt:
      "What is a good following exercise to do after this, according to my curriculum materials?",
  },
] as const;

function driveMediaUrl(fileId: string) {
  return `/api/curriculum/drive-media?fileId=${encodeURIComponent(fileId)}`;
}

interface StudyResponseProps {
  question: string;
  answer: string;
  confidence: Confidence;
  source_folder: string | null;
  figures?: SourceFigure[];
  source_images?: SourceImage[];
  source_documents?: SourceDocument[];
  onSuggestedQuestion: (prompt: string) => void;
  suggestionsDisabled?: boolean;
}

export default function StudyResponse({
  question,
  answer,
  confidence,
  source_folder,
  figures = [],
  source_images = [],
  source_documents = [],
  onSuggestedQuestion,
  suggestionsDisabled = false,
}: StudyResponseProps) {
  const badge = CONFIDENCE_BADGE[confidence];
  const hasFigures = figures.length > 0;
  const hasImages = source_images.length > 0;
  const hasDocs = source_documents.length > 0;

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-medium text-clara-strong">{question}</p>
      <MarkdownBody>{answer}</MarkdownBody>

      {hasDocs && confidence !== "not_found" && (
        <div className="rounded-md border border-clara-highlight bg-clara-surface/80 p-3 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-clara-muted">
            Source files (Google Drive)
          </p>
          <ul className="flex flex-col gap-1.5">
            {source_documents.map((doc) => (
              <li key={doc.drive_file_id}>
                <a
                  href={`https://drive.google.com/file/d/${encodeURIComponent(doc.drive_file_id)}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-clara-strong underline decoration-clara-highlight underline-offset-2 hover:text-clara-warm"
                >
                  {doc.file_name}
                </a>
                <span className="ml-2 text-xs text-clara-muted">({doc.mime_type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasImages && confidence !== "not_found" && (
        <div className="space-y-2 rounded-md border border-clara-highlight bg-clara-surface/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-clara-muted">
            Images from your curriculum (Google Drive)
          </p>
          <p className="text-xs text-clara-deep/80">
            Matched pages or photos from files you ingested. Re-ingest folders after updating the app if
            images don&apos;t appear yet.
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {source_images.map((img) => (
              <li
                key={img.drive_file_id}
                className="overflow-hidden rounded border border-clara-border/60 bg-clara-bg"
              >
                <p className="border-b border-clara-border/40 px-2 py-1.5 text-xs font-medium text-clara-strong">
                  {img.file_name}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated same-origin proxy URL */}
                <img
                  src={driveMediaUrl(img.drive_file_id)}
                  alt=""
                  className="h-auto max-h-80 w-full object-contain"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasFigures && confidence !== "not_found" && (
        <div className="space-y-2 rounded-md border border-clara-highlight bg-clara-surface/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-clara-muted">
            From your textbook (figures &amp; illustrations)
          </p>
          {!hasImages && (
            <p className="text-xs text-clara-deep/80">
              Text descriptions from your materials. Add <strong>.jpg / .png</strong> page photos to Drive
              and ingest to see images above.
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {figures.map((fig, idx) => (
              <li
                key={`${fig.file_name}-${idx}`}
                className="rounded border border-clara-border/60 bg-clara-bg p-3 text-sm"
              >
                <p className="mb-1 font-medium text-clara-strong">{fig.file_name}</p>
                <p className="whitespace-pre-wrap text-clara-deep">{fig.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge folderName={source_folder} />
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {confidence !== "not_found" && (
        <div className="flex flex-col gap-2 border-t border-clara-highlight pt-3">
          <p className="text-xs font-medium text-clara-muted">Ask a follow-up</p>
          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_SUGGESTIONS.map((s) => (
              <Button
                key={s.label}
                type="button"
                variant="secondary"
                className="text-left text-sm"
                disabled={suggestionsDisabled}
                onClick={() => onSuggestedQuestion(s.prompt)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
