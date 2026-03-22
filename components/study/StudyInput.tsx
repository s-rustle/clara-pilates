"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Select from "@/components/ui/Select";

const FILTER_OPTIONS = [
  { value: "", label: "All" },
  { value: "Anatomy", label: "Anatomy" },
  { value: "Movement Principles", label: "Movement Principles" },
  { value: "Mat 1", label: "Mat 1" },
  { value: "Mat 2", label: "Mat 2" },
  { value: "Mat 3", label: "Mat 3" },
  { value: "Reformer 1", label: "Reformer 1" },
  { value: "Reformer 2", label: "Reformer 2" },
  { value: "Reformer 3", label: "Reformer 3" },
  { value: "Trapeze Cadillac", label: "Trapeze Cadillac" },
  { value: "Chair", label: "Chair" },
  { value: "Barrels", label: "Barrels" },
];

interface StudyInputProps {
  onSubmit: (query: string, folderFilter?: string) => void;
  isLoading: boolean;
  initialQuery?: string;
  folderFilter: string;
  onFolderFilterChange: (value: string) => void;
}

export default function StudyInput({
  onSubmit,
  isLoading,
  initialQuery = "",
  folderFilter,
  onFolderFilterChange,
}: StudyInputProps) {
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      onSubmit(trimmed, folderFilter || undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask Clara a study question..."
        rows={4}
        disabled={isLoading}
        className="w-full resize-y rounded-sm border border-clara-highlight bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted/80 focus:border-clara-accent focus:outline-none focus:ring-1 focus:ring-clara-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={FILTER_OPTIONS}
          value={folderFilter}
          onChange={(e) => onFolderFilterChange(e.target.value)}
          disabled={isLoading}
          className="w-48"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Asking...
            </span>
          ) : (
            "Ask Clara"
          )}
        </Button>
      </div>
    </form>
  );
}
