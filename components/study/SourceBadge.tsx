"use client";

interface SourceBadgeProps {
  folderName: string | null;
}

export default function SourceBadge({ folderName }: SourceBadgeProps) {
  if (folderName == null) return null;

  return (
    <span className="inline-flex items-center rounded-full border border-clara-border bg-clara-highlight px-2.5 py-0.5 text-xs font-medium text-clara-deep">
      Based on your {folderName} materials
    </span>
  );
}
