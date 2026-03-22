"use client";

import { clsx } from "clsx";
import ReactMarkdown from "react-markdown";

const baseProse =
  "prose prose-sm max-w-none text-clara-deep prose-headings:font-display prose-headings:font-semibold prose-headings:text-clara-strong prose-strong:font-bold prose-strong:text-clara-strong prose-p:text-clara-deep prose-li:text-clara-deep prose-ul:text-clara-deep prose-ol:text-clara-deep prose-a:text-clara-primary";

interface MarkdownBodyProps {
  children: string;
  className?: string;
}

export default function MarkdownBody({ children, className }: MarkdownBodyProps) {
  return (
    <div className={clsx(baseProse, className)}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
