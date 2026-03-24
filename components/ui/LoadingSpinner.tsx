interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-4",
};

export default function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-clara-primary border-t-transparent ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  );
}
