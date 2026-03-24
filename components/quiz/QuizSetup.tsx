"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Card from "@/components/ui/Card";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

const APPARATUS_OPTIONS = [
  { value: "All", label: "All" },
  { value: "Mat", label: "Mat" },
  { value: "Reformer", label: "Reformer" },
  { value: "Trapeze Cadillac", label: "Trapeze Cadillac" },
  { value: "Chair", label: "Chair" },
  { value: "Barrels", label: "Barrels" },
  { value: "Anatomy", label: "Anatomy" },
  { value: "Movement Principles", label: "Movement Principles" },
];

const DIFFICULTY_OPTIONS = [
  { value: "Foundational", label: "Foundational" },
  { value: "Intermediate", label: "Intermediate" },
  { value: "Exam-Ready", label: "Exam-Ready" },
];

const QUESTION_COUNT_OPTIONS = [
  { value: "10", label: "10" },
  { value: "15", label: "15" },
  { value: "20", label: "20" },
];

const FORMAT_OPTIONS = [
  { value: "mixed", label: "Mixed (varied formats)" },
  { value: "multiple_choice", label: "Multiple choice" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "matching", label: "Matching" },
  { value: "open_ended", label: "Open-ended" },
  { value: "anatomy_multiple_choice", label: "Anatomy — multiple choice" },
  { value: "anatomy_diagram", label: "Anatomy — interactive diagram" },
];

interface QuizSetupProps {
  onStart: (
    apparatus: string,
    difficulty: string,
    questionCount: number,
    format: string
  ) => void;
  isStarting?: boolean;
}

export default function QuizSetup({ onStart, isStarting = false }: QuizSetupProps) {
  const [apparatus, setApparatus] = useState("All");
  const [difficulty, setDifficulty] = useState("Foundational");
  const [questionCount, setQuestionCount] = useState(10);
  const [format, setFormat] = useState("mixed");

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Select
          label="Apparatus"
          options={APPARATUS_OPTIONS}
          value={apparatus}
          onChange={(e) => setApparatus(e.target.value)}
          disabled={isStarting}
        />
        <Select
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          disabled={isStarting}
        />
        <Select
          label="Question count"
          options={QUESTION_COUNT_OPTIONS}
          value={String(questionCount)}
          onChange={(e) => setQuestionCount(Number(e.target.value))}
          disabled={isStarting}
        />
        <Select
          label="Question format"
          options={FORMAT_OPTIONS}
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          disabled={isStarting}
        />
        <Button
          variant="primary"
          onClick={() => onStart(apparatus, difficulty, questionCount, format)}
          disabled={isStarting}
        >
          {isStarting ? (
            <span className="inline-flex items-center gap-2">
              <LoadingSpinner size="sm" />
              Starting…
            </span>
          ) : (
            "Start Quiz"
          )}
        </Button>
      </div>
    </Card>
  );
}
