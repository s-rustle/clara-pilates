"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import ErrorMessage from "@/components/ui/ErrorMessage";
import StudyInput from "@/components/study/StudyInput";
import StudyResponse from "@/components/study/StudyResponse";
import type { CurriculumResponse } from "@/types";

interface ConversationItem {
  question: string;
  response: CurriculumResponse;
}

export default function StudyPage() {
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefillQuery, setPrefillQuery] = useState("");

  const handleSubmit = async (query: string, folderFilter?: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/agents/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, folder_filter: folderFilter }),
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

      setConversation((prev) => [
        ...prev,
        { question: query, response: json.data as CurriculumResponse },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get answer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowUp = (answer: string) => {
    setPrefillQuery(answer);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-clara-strong">Study</h1>

      <StudyInput
        onSubmit={handleSubmit}
        isLoading={isLoading}
        initialQuery={prefillQuery}
      />

      {error && (
        <ErrorMessage message={error} />
      )}

      <div className="flex flex-col gap-4">
        {conversation.length === 0 && !error && (
          <Card>
            <p className="text-clara-deep">
              Ask Clara anything from your Balanced Body curriculum.
            </p>
          </Card>
        )}

        {conversation.map((item, i) => (
          <StudyResponse
            key={i}
            question={item.question}
            answer={item.response.answer}
            confidence={item.response.confidence}
            source_folder={item.response.source_folder}
            onFollowUp={handleFollowUp}
          />
        ))}
      </div>
    </div>
  );
}
