"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import ErrorMessage from "@/components/ui/ErrorMessage";
import StudyInput from "@/components/study/StudyInput";
import StudyResponse from "@/components/study/StudyResponse";
import { useHasIngestedCurriculum } from "@/lib/hooks/useHasIngestedCurriculum";
import type { CurriculumResponse } from "@/types";
import { studyFolderFromSearchParams } from "@/lib/constants/studyFolders";

interface ConversationItem {
  id: string;
  question: string;
  response: CurriculumResponse;
}

export default function StudyPageClient() {
  const searchParams = useSearchParams();
  const hasIngestedCurriculum = useHasIngestedCurriculum();
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillQuery, setPrefillQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("");

  useEffect(() => {
    const folder = studyFolderFromSearchParams(
      searchParams.get("folder"),
      searchParams.get("apparatus")
    );
    if (folder) {
      setFolderFilter(folder);
    }
  }, [searchParams]);

  const runQuery = async (query: string, filter?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/agents/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, folder_filter: filter }),
        credentials: "same-origin",
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error ?? `Request failed: ${res.status}`);
        return;
      }

      if (!json.success || !json.data) {
        setError("Unexpected response format");
        return;
      }

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `msg-${Date.now()}`;

      setConversation((prev) => [
        { id, question: query, response: json.data as CurriculumResponse },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (query: string, filterFromForm?: string) => {
    const filter = filterFromForm ?? folderFilter;
    await runQuery(query, filter || undefined);
  };

  const handleSuggestedQuestion = (prompt: string) => {
    setPrefillQuery(prompt);
    void runQuery(prompt, folderFilter || undefined);
  };

  return (
    <div className="flex flex-col gap-6">
      <StudyInput
        onSubmit={handleSubmit}
        isLoading={isLoading}
        initialQuery={prefillQuery}
        folderFilter={folderFilter}
        onFolderFilterChange={setFolderFilter}
      />

      {hasIngestedCurriculum === false && (
        <Card>
          <p className="text-clara-deep">
            No curriculum has been ingested yet. Open{" "}
            <a
              href="/curriculum"
              className="font-medium text-clara-accent underline"
            >
              Curriculum Manager
            </a>{" "}
            to connect Google Drive and ingest at least one folder. Until then,
            Clara can only tell you that topics are not in your uploaded
            materials.
          </p>
        </Card>
      )}

      {error && <ErrorMessage message={error} />}

      <div className="flex flex-col gap-4">
        {conversation.length === 0 && !error && (
          <Card>
            <p className="text-clara-deep">
              Ask Clara anything from your Balanced Body curriculum.
            </p>
          </Card>
        )}

        {conversation.map((item) => (
          <StudyResponse
            key={item.id}
            question={item.question}
            answer={item.response.answer}
            confidence={item.response.confidence}
            source_folder={item.response.source_folder}
            figures={item.response.figures}
            source_images={item.response.source_images}
            source_documents={item.response.source_documents}
            onSuggestedQuestion={handleSuggestedQuestion}
            suggestionsDisabled={isLoading}
          />
        ))}
      </div>
    </div>
  );
}
