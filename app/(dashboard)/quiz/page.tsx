"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import QuizSetup from "@/components/quiz/QuizSetup";
import QuestionCard from "@/components/quiz/QuestionCard";
import AnswerInput from "@/components/quiz/AnswerInput";
import QuizSummary from "@/components/quiz/QuizSummary";

type Phase = "setup" | "in_progress" | "complete";

interface CurrentQuestion {
  format: "open_ended" | "multiple_choice" | "fill_blank" | "matching" | "diagram_matching";
  question: string;
  questionId: string;
  expectedAnswerElements: string[];
  options?: { id: string; text: string }[];
  correctId?: string;
  correctAnswer?: string;
  pairs?: { left: string; right: string }[];
  leftItems?: string[];
  rightItems?: string[];
  image_file_name?: string;
  folder_name?: string;
}

interface EvaluationState {
  result: "correct" | "partial" | "incorrect";
  feedback: string;
  correctAnswer: string | null;
  showRetry: boolean;
}

export default function QuizPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [apparatus, setApparatus] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState("");
  const [questionCount, setQuestionCount] = useState(0);
  const [format, setFormat] = useState("mixed");

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] =
    useState<CurrentQuestion | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationState | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const doFetchQuestion = useCallback(
    async (
      sid: string,
      prevQs: string[],
      app: string,
      tpc: string | null,
      diff: string,
      fmt: string
    ) => {
      setError(null);
      setIsLoadingQuestion(true);
      try {
        const res = await fetch("/api/agents/examiner/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apparatus: app || "Mat",
            topic: tpc,
            difficulty: diff || "Foundational",
            format: fmt || "mixed",
            previous_questions: prevQs,
            session_id: sid,
          }),
          credentials: "same-origin",
        });
        const json = await res.json();

        if (!res.ok) {
          setError(json?.error ?? `Failed to load question: ${res.status}`);
          return;
        }

        if (!json.success || !json.data) {
          setError("Unexpected response format");
          return;
        }

        const d = json.data;
        setCurrentQuestion({
          format: d.format ?? "open_ended",
          question: d.question,
          questionId: d.question_id,
          expectedAnswerElements: d.expected_answer_elements ?? [],
          options: d.options,
          correctId: d.correct_id,
          correctAnswer: d.correct_answer,
          pairs: d.pairs,
          leftItems: d.left_items,
          rightItems: d.right_items,
          image_file_name: d.image_file_name,
          folder_name: d.folder_name,
        });
        setPreviousQuestions((prev) => [...prev, d.question]);
        setEvaluation(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load question");
      } finally {
        setIsLoadingQuestion(false);
      }
    },
    []
  );

  const fetchQuestion = useCallback((): Promise<void> => {
    if (!sessionId) return Promise.resolve();
    return doFetchQuestion(
      sessionId,
      previousQuestions,
      apparatus,
      topic,
      difficulty,
      format
    );
  }, [sessionId, previousQuestions, apparatus, topic, difficulty, format, doFetchQuestion]);

  const handleStart = useCallback(
    async (app: string, diff: string, count: number, fmt: string) => {
      setError(null);
      setFormat(fmt);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to start a quiz.");
        return;
      }

      setIsLoadingQuestion(true);
      try {
        const topicVal = app === "All" ? null : app;
        const { data: session, error: insertError } = await supabase
          .from("quiz_sessions")
          .insert({
            user_id: user.id,
            apparatus: app,
            topic: topicVal,
            difficulty: diff,
            question_count: count,
          })
          .select("id")
          .single();

        if (insertError) {
          setError(`Failed to create session: ${insertError.message}`);
          setIsLoadingQuestion(false);
          return;
        }

        setSessionId(session.id);
        setApparatus(app);
        setTopic(topicVal);
        setDifficulty(diff);
        setQuestionCount(count);
        setPhase("in_progress");
        setCurrentIndex(0);
        setScore(0);
        setPreviousQuestions([]);
        setCurrentQuestion(null);
        setEvaluation(null);

        await doFetchQuestion(session.id, [], app, topicVal, diff, fmt);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start quiz");
      } finally {
        setIsLoadingQuestion(false);
      }
    },
    [doFetchQuestion]
  );

  const handleAnswerSubmit = useCallback(
    async (answer: string, isRetry: boolean) => {
      if (!currentQuestion) return;
      setError(null);
      setIsEvaluating(true);
      try {
        const res = await fetch("/api/agents/examiner/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_id: currentQuestion.questionId,
            question: currentQuestion.question,
            user_answer: answer,
            expected_elements: currentQuestion.expectedAnswerElements,
            is_retry: isRetry,
            format: currentQuestion.format,
            correct_id: currentQuestion.correctId,
            correct_answer: currentQuestion.correctAnswer,
            pairs: currentQuestion.pairs,
            options: currentQuestion.options,
          }),
          credentials: "same-origin",
        });
        const json = await res.json();

        if (!res.ok) {
          setError(json?.error ?? `Evaluation failed: ${res.status}`);
          return;
        }

        if (!json.success || !json.data) {
          setError("Unexpected response format");
          return;
        }

        const { result, feedback, correct_answer } = json.data;
        const showRetry =
          result === "partial" && !isRetry;

        setEvaluation({
          result,
          feedback,
          correctAnswer: correct_answer,
          showRetry,
        });

        if (result === "correct") {
          setScore((s) => s + 1);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to evaluate answer"
        );
      } finally {
        setIsEvaluating(false);
      }
    },
    [currentQuestion]
  );

  const handleNextQuestion = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questionCount) {
      const supabase = createClient();
      const percent =
        questionCount > 0 ? Math.round((score / questionCount) * 100) : 0;
      await supabase
        .from("quiz_sessions")
        .update({
          score_percent: percent,
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
      void fetch("/api/agents/weakspot", {
        method: "POST",
        credentials: "same-origin",
      });
      setPhase("complete");
    } else {
      setCurrentIndex(nextIndex);
      setCurrentQuestion(null);
      setEvaluation(null);
      await fetchQuestion();
    }
  }, [currentIndex, questionCount, score, sessionId, fetchQuestion]);

  const handleRequestExplanation = useCallback(async (): Promise<string> => {
    if (!currentQuestion) return "Explanation unavailable.";
    try {
      const res = await fetch("/api/agents/examiner/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: currentQuestion.question,
          format: currentQuestion.format,
          correct_answer: currentQuestion.correctAnswer,
          correct_id: currentQuestion.correctId,
          options: currentQuestion.options,
          pairs: currentQuestion.pairs,
          expected_elements: currentQuestion.expectedAnswerElements,
        }),
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        return json?.error ?? "Could not load explanation.";
      }
      return json.data?.explanation ?? "Explanation unavailable.";
    } catch {
      return "Could not load explanation.";
    }
  }, [currentQuestion]);

  const handleTryAgain = useCallback(() => {
    setPhase("setup");
    setSessionId(null);
    setCurrentQuestion(null);
    setEvaluation(null);
    setError(null);
    setCurrentIndex(0);
    setScore(0);
    setPreviousQuestions([]);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-clara-strong">
        Quiz
      </h1>

      {error && <ErrorMessage message={error} />}

      {phase === "setup" && (
        <QuizSetup
          onStart={(app, diff, count, fmt) => handleStart(app, diff, count, fmt)}
        />
      )}

      {phase === "in_progress" && (
        <>
          {isLoadingQuestion && !currentQuestion ? (
            <Card>
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            </Card>
          ) : currentQuestion ? (
            <Card>
              <div className="flex flex-col gap-6">
                <QuestionCard
                  question={currentQuestion.question}
                  currentIndex={currentIndex}
                  totalCount={questionCount}
                  scoreSoFar={score}
                  image_file_name={currentQuestion.image_file_name}
                  folder_name={currentQuestion.folder_name}
                />
                <AnswerInput
                  key={currentQuestion.questionId}
                  format={currentQuestion.format}
                  onSubmit={handleAnswerSubmit}
                  isLoading={isEvaluating}
                  showRetry={evaluation?.showRetry ?? false}
                  result={evaluation?.result ?? null}
                  feedback={evaluation?.feedback}
                  correctAnswer={evaluation?.correctAnswer}
                  onNext={handleNextQuestion}
                  options={currentQuestion.options}
                  correctId={currentQuestion.correctId}
                  leftItems={currentQuestion.leftItems}
                  rightItems={currentQuestion.rightItems}
                  pairs={currentQuestion.pairs}
                  requestExplanation={handleRequestExplanation}
                />
              </div>
            </Card>
          ) : null}
        </>
      )}

      {phase === "complete" && (
        <QuizSummary
          score={score}
          total={questionCount}
          sessionId={sessionId ?? ""}
          apparatus={apparatus}
          topic={topic}
          onTryAgain={handleTryAgain}
        />
      )}
    </div>
  );
}
