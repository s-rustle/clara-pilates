import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-none border border-clara-border bg-clara-surface p-3 text-clara-deep"
    >
      <AlertCircle
        className="mt-0.5 h-5 w-5 flex-shrink-0 text-clara-primary"
        aria-hidden
      />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
