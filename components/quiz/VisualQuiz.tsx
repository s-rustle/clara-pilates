"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { claraPalette } from "@/lib/design/claraPalette";

const WORKER_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const MAX_CANVAS_H = 500;

type ApparatusKey = "mat2" | "barrels";

const APPARATUS: Record<
  ApparatusKey,
  { label: string; folderId: string }
> = {
  mat2: {
    label: "Mat 2",
    folderId: "17nIjfkN73yVju53b1yFiWPa2FRfq9Jka",
  },
  barrels: {
    label: "Barrels",
    folderId: "1-UeK3mlSReqezP_M6_r0s3XwzcR5a4T9",
  },
};

type Phase = "pick" | "loading_pdf" | "answering" | "loading_eval";

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default function VisualQuiz() {
  const [apparatus, setApparatus] = useState<ApparatusKey>("mat2");
  const [phase, setPhase] = useState<Phase>("pick");
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [pdfBase64, setPdfBase64] = useState<string>("");
  const [pageShown, setPageShown] = useState<number>(1);
  const [answer, setAnswer] = useState("");
  const [evalResult, setEvalResult] = useState<{
    result: "correct" | "close" | "incorrect";
    correctName: string;
    feedback: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [wrapWidth, setWrapWidth] = useState(640);
  const pdfDocRef = useRef<{ destroy: () => Promise<void> } | null>(null);
  const [pdfRenderBusy, setPdfRenderBusy] = useState(false);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWrapWidth(Math.max(200, el.clientWidth));
    });
    ro.observe(el);
    setWrapWidth(Math.max(200, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const renderPdfToCanvas = useCallback(
    async (base64: string, pickRandomPage: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await pdfDocRef.current?.destroy();
      pdfDocRef.current = null;

      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;

      const data = base64ToUint8Array(base64);
      const task = pdfjs.getDocument({ data, stopAtErrors: true });
      const pdf = await task.promise;
      pdfDocRef.current = pdf;

      const numPages = pdf.numPages || 1;
      const pageNum = pickRandomPage
        ? 1 + Math.floor(Math.random() * numPages)
        : 1;
      setPageShown(pageNum);

      const page = await pdf.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = Math.min(
        wrapWidth / baseVp.width,
        MAX_CANVAS_H / baseVp.height
      );
      const viewport = page.getViewport({ scale });

      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      ctx.fillStyle = claraPalette.bg;
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
    },
    [wrapWidth]
  );

  useEffect(() => {
    if (!pdfBase64 || phase === "pick" || phase === "loading_pdf") return;

    let cancelled = false;
    setPdfRenderBusy(true);
    void (async () => {
      try {
        await renderPdfToCanvas(pdfBase64, true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not render PDF page");
        }
      } finally {
        if (!cancelled) setPdfRenderBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBase64, phase, renderPdfToCanvas]);

  useEffect(() => {
    return () => {
      void pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, []);

  const loadRandomPdf = useCallback(async () => {
    setError("");
    setEvalResult(null);
    setAnswer("");
    setPdfBase64("");
    setFileName("");
    setPhase("loading_pdf");

    const folderId = APPARATUS[apparatus].folderId;
    const res = await fetch(
      `/api/quiz/visual-page?folderId=${encodeURIComponent(folderId)}`,
      { credentials: "same-origin" }
    );
    const json = (await res.json()) as {
      fileName?: string;
      base64?: string;
      mimeType?: string;
      error?: string;
    };

    if (!res.ok) {
      setError(json.error ?? `Request failed (${res.status})`);
      setPhase("pick");
      return;
    }

    if (!json.fileName || !json.base64) {
      setError("Unexpected response from server");
      setPhase("pick");
      return;
    }

    setFileName(json.fileName);
    setPdfBase64(json.base64);
    setPhase("answering");
  }, [apparatus]);

  const submitAnswer = useCallback(async () => {
    const trimmed = answer.trim();
    if (!trimmed || !fileName) return;
    setError("");
    setPhase("loading_eval");
    try {
      const res = await fetch("/api/quiz/visual-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userAnswer: trimmed, fileName }),
      });
      const json = (await res.json()) as {
        result?: string;
        correctName?: string;
        feedback?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(json.error ?? "Evaluation failed");
        setPhase("answering");
        return;
      }

      const r = json.result;
      if (r !== "correct" && r !== "close" && r !== "incorrect") {
        setError("Unexpected evaluation response");
        setPhase("answering");
        return;
      }

      setEvalResult({
        result: r,
        correctName: json.correctName ?? "",
        feedback: json.feedback ?? "",
      });
      setPhase("answering");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
      setPhase("answering");
    }
  }, [answer, fileName]);

  const handleNext = useCallback(() => {
    void loadRandomPdf();
  }, [loadRandomPdf]);

  return (
    <div className="flex flex-col gap-6">
      {error ? <ErrorMessage message={error} /> : null}

      <Card>
        <p className="mb-3 text-sm font-medium text-clara-deep">Apparatus</p>
        <div className="flex gap-0 rounded-none border border-clara-border bg-clara-bg p-0.5">
          {(Object.keys(APPARATUS) as ApparatusKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setApparatus(key);
                setPhase("pick");
                setPdfBase64("");
                setEvalResult(null);
                setAnswer("");
              }}
              disabled={phase === "loading_pdf" || phase === "loading_eval"}
              className={`flex-1 rounded-none px-3 py-2 text-xs font-medium transition-colors ${
                apparatus === key
                  ? "bg-clara-primary text-white"
                  : "text-clara-deep hover:bg-clara-border/50"
              } disabled:opacity-50`}
            >
              {APPARATUS[key].label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Button
            type="button"
            variant="primary"
            onClick={() => void loadRandomPdf()}
            disabled={phase === "loading_pdf" || phase === "loading_eval"}
            className="w-full sm:w-auto"
          >
            {phase === "loading_pdf" ? (
              <span className="inline-flex items-center gap-2 normal-case">
                <LoadingSpinner size="sm" />
                Loading…
              </span>
            ) : (
              "Start"
            )}
          </Button>
        </div>
      </Card>

      {phase !== "pick" && pdfBase64 ? (
        <Card>
          <p className="mb-1 text-xs text-clara-muted">
            Page {pageShown}
            {fileName ? ` · ${fileName}` : ""}
          </p>
          <div
            ref={canvasWrapRef}
            className="relative w-full overflow-hidden border border-clara-border bg-white"
          >
            {pdfRenderBusy ? (
              <div className="flex min-h-[240px] items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : null}
            <canvas
              ref={canvasRef}
              className={`mx-auto block max-w-full ${pdfRenderBusy ? "hidden" : ""}`}
            />
          </div>

          {!evalResult ? (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-sm font-medium text-clara-deep">
                  Name this exercise…
                </label>
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={phase === "loading_eval"}
                  placeholder="e.g. Spine Stretch Forward"
                  className="w-full rounded-none border border-clara-border bg-clara-bg px-3 py-2 text-sm text-clara-deep placeholder:text-clara-muted focus:border-clara-primary focus:outline-none focus:ring-1 focus:ring-clara-primary/40 disabled:opacity-50"
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="primary"
                onClick={() => void submitAnswer()}
                disabled={phase === "loading_eval" || !answer.trim()}
                className="shrink-0"
              >
                {phase === "loading_eval" ? (
                  <span className="inline-flex items-center gap-2 normal-case">
                    <LoadingSpinner size="sm" />
                    Checking…
                  </span>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4 border-t border-clara-border pt-4">
              <div className="flex flex-wrap items-center gap-3">
                {evalResult.result === "correct" ? (
                  <Badge variant="green">Correct</Badge>
                ) : evalResult.result === "close" ? (
                  <span className="inline-flex items-center rounded-none border border-clara-border bg-clara-exam-chip px-[10px] py-[2px] text-xs font-medium text-clara-exam-chip-ink">
                    Close
                  </span>
                ) : (
                  <Badge variant="red">Incorrect</Badge>
                )}
                <p className="text-sm text-clara-deep">
                  <span className="text-clara-muted">Answer: </span>
                  <span className="font-medium">{evalResult.correctName}</span>
                </p>
              </div>
              <p className="text-sm leading-relaxed text-clara-deep">
                {evalResult.feedback}
              </p>
              <Button type="button" variant="accent" onClick={handleNext}>
                Next
              </Button>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
