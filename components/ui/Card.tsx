import { clsx } from "clsx";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-none border border-clara-border bg-white p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
