"use client";

interface SourceBadgeProps {
  folderName: string | null;
  /** "from" = Learn copy; default matches Study. */
  variant?: "based" | "from";
}

export default function SourceBadge({
  folderName,
  variant = "based",
}: SourceBadgeProps) {
  if (folderName == null) return null;

  const label =
    variant === "from"
      ? `From your ${folderName} materials`
      : `Based on your ${folderName} materials`;

  return (
    <span className="inline-flex items-center rounded-sm border border-clara-border bg-clara-surface px-2.5 py-0.5 text-xs font-medium text-clara-deep">
      {label}
    </span>
  );
}
