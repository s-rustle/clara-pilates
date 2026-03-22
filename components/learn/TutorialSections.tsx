"use client";

import Card from "@/components/ui/Card";
import MarkdownBody from "@/components/ui/MarkdownBody";
import type { TutorialContent } from "@/types";

const sectionClass =
  "text-[0.65rem] font-bold uppercase tracking-[0.2em] text-clara-strong";

interface TutorialSectionsProps {
  tutorial: TutorialContent;
}

export default function TutorialSections({ tutorial }: TutorialSectionsProps) {
  const sections: { key: string; label: string; value: string | null }[] = [
    { key: "sp", label: "Starting Position", value: tutorial.starting_position },
    {
      key: "md",
      label: "Movement Description",
      value: tutorial.movement_description,
    },
    { key: "bc", label: "Breath Cues", value: tutorial.breath_cues },
    {
      key: "ss",
      label: "Spring Settings",
      value: tutorial.spring_settings,
    },
    { key: "pr", label: "Precautions", value: tutorial.precautions },
    { key: "tt", label: "Teaching Tips", value: tutorial.teaching_tips },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-1">
      {sections.map(({ key, label, value }) => {
        if (key === "ss" && (value === null || value === "")) {
          return null;
        }
        const body =
          value && value.trim() !== ""
            ? value
            : "Not specified in your materials";
        return (
          <Card key={key} className="py-4">
            <h3 className={sectionClass}>{label}</h3>
            <div className="mt-2">
              <MarkdownBody>{body}</MarkdownBody>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
