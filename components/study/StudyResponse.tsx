"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SourceBadge from "./SourceBadge";

type Confidence = "confident" | "partial" | "not_found";

const CONFIDENCE_BADGE: Record<Confidence, { variant: "green" | "yellow" | "red"; label: string }> = {
  confident: { variant: "green", label: "Source confirmed" },
  partial: { variant: "yellow", label: "Partial match" },
  not_found: { variant: "red", label: "Not in your materials" },
};

interface StudyResponseProps {
  question: string;
  answer: string;
  confidence: Confidence;
  source_folder: string | null;
  onFollowUp: (answer: string) => void;
}

export default function StudyResponse({
  question,
  answer,
  confidence,
  source_folder,
  onFollowUp,
}: StudyResponseProps) {
  const badge = CONFIDENCE_BADGE[confidence];

  return (
    <Card className="flex flex-col gap-3">
      <p className="font-medium text-clara-strong">{question}</p>
      <p className="whitespace-pre-wrap text-clara-deep">{answer}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge folderName={source_folder} />
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <Button variant="secondary" onClick={() => onFollowUp(answer)}>
        Ask a follow-up
      </Button>
    </Card>
  );
}
