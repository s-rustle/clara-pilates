"use client";

import { useState, useEffect, useRef } from "react";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ErrorMessage from "@/components/ui/ErrorMessage";

interface QuestionCardProps {
  question: string;
  currentIndex: number;
  totalCount: number;
  scoreSoFar: number;
  image_file_name?: string;
  folder_name?: string;
}

/** Renders question text with **exercise** marked segments in bold (matches source material style). */
function QuestionText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="text-base font-bold text-clara-strong">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

function DiagramImage({
  file_name,
  folder_name,
}: {
  file_name: string;
  folder_name: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const apiUrl = `/api/drive/image?file_name=${encodeURIComponent(file_name)}&folder_name=${encodeURIComponent(folder_name)}`;
    fetch(apiUrl, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Image not found" : "Failed to load image");
        }
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        urlRef.current = objectUrl;
        setSrc(objectUrl);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [file_name, folder_name]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (error) {
    return <ErrorMessage message={error} />;
  }
  if (src) {
    return (
      <img
        src={src}
        alt="Anatomy diagram"
        className="max-h-64 w-auto rounded-lg border border-clara-border object-contain"
      />
    );
  }
  return null;
}

export default function QuestionCard({
  question,
  currentIndex,
  totalCount,
  scoreSoFar,
  image_file_name,
  folder_name,
}: QuestionCardProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-clara-deep">
        Question {currentIndex + 1} of {totalCount}
      </p>
      <p className="text-sm text-clara-primary">
        {scoreSoFar} correct so far
      </p>
      {image_file_name && folder_name && (
        <DiagramImage file_name={image_file_name} folder_name={folder_name} />
      )}
      <QuestionText text={question} />
    </div>
  );
}
