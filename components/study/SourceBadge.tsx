"use client";

interface SourceBadgeProps {
  folderName: string | null;
}

export default function SourceBadge({ folderName }: SourceBadgeProps) {
  if (folderName == null) return null;

  return (
    <span className="inline-flex items-center rounded-full bg-clara-highlight px-2 py-0.5 text-xs font-medium text-clara-strong">
      Based on your {folderName} materials
    </span>
  );
}
