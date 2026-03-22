/**
 * PDF text extraction with per-page reading-order heuristics so upside-down
 * or odd column ordering still yields usable Latin text for tagging/RAG.
 * Uses pdf-parse’s pagerender hook (same pdf.js build as the library).
 */

type TextItem = { str: string; transform: number[] };

type PageLike = {
  getTextContent: (opts?: {
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
  }) => Promise<{ items: unknown[] }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
};

function scoreReadableLatin(text: string): number {
  if (!text || text.length < 8) return 0;
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const words = (text.match(/\b[A-Za-z]{3,}\b/g) ?? []).length;
  let bonus = 0;
  const u = text.toUpperCase();
  if (/\b(REPS?|INTERMEDIATE|BEGINNER|ADVANCED|STARTING\s+POSITION|MOVEMENT)\b/.test(u)) {
    bonus += 10;
  }
  const weird = (text.match(/[^\t\n\r\x20-\x7E]/g) ?? []).length;
  return letters + words * 1.4 + bonus - weird * 2;
}

function isTextItem(item: unknown): item is TextItem {
  if (item == null || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;
  return typeof o.str === "string" && Array.isArray(o.transform);
}

/** pdf-parse default: break lines when transform[5] (y) changes. */
function sequentialMerge(items: TextItem[]): string {
  let lastY: number | undefined;
  let text = "";
  for (const item of items) {
    const y = item.transform[5];
    if (lastY === undefined || Math.abs(lastY - y) < 0.02) {
      text += item.str;
    } else {
      text += "\n" + item.str;
    }
    lastY = y;
  }
  return text;
}

/**
 * Bucket by y, order lines by two vertical directions; pick stronger score.
 * `flipY` mirrors y in viewport space to handle some inverted layouts.
 */
function spatialLayout(
  items: TextItem[],
  viewport: { width: number; height: number },
  flipY: boolean
): string {
  const bucket = 6;
  const lineMap = new Map<number, { x: number; str: string }[]>();

  for (const item of items) {
    let y = item.transform[5];
    const x = item.transform[4];
    if (flipY) {
      y = viewport.height - y;
    }
    const yKey = Math.round(y / bucket) * bucket;
    const arr = lineMap.get(yKey) ?? [];
    arr.push({ x, str: item.str });
    lineMap.set(yKey, arr);
  }

  const keys = [...lineMap.keys()];
  const render = (orderedKeys: number[]) =>
    orderedKeys
      .map((k) => {
        const parts = lineMap.get(k)!;
        return parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.str)
          .join(" ");
      })
      .join("\n");

  const hiFirst = render([...keys].sort((a, b) => b - a));
  const loFirst = render([...keys].sort((a, b) => a - b));
  return scoreReadableLatin(hiFirst) >= scoreReadableLatin(loFirst)
    ? hiFirst
    : loFirst;
}

export async function orientationAwarePageRender(
  pageData: PageLike
): Promise<string> {
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: true,
    disableCombineTextItems: false,
  });

  const items = textContent.items.filter(isTextItem).filter((i) => i.str.trim());
  if (items.length === 0) {
    return "\n";
  }

  const viewport = pageData.getViewport({ scale: 1 });
  const sequential = sequentialMerge(items);
  const spatial = spatialLayout(items, viewport, false);
  const spatialFlipped = spatialLayout(items, viewport, true);
  const revLines = sequential.split(/\n/).reverse().join("\n");

  const candidates = [sequential, spatial, spatialFlipped, revLines];
  let best = sequential;
  let bestScore = scoreReadableLatin(sequential);
  for (const c of candidates) {
    const s = scoreReadableLatin(c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  return `${best.trim()}\n\n`;
}

export async function extractPdfTextOrientationAware(
  dataBuffer: Buffer
): Promise<{ text: string; numpages: number; numrender: number }> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(dataBuffer, {
    max: 0,
    version: "v1.10.100",
    pagerender: orientationAwarePageRender,
  });
  return {
    text: result.text.trim(),
    numpages: result.numpages,
    numrender: result.numrender,
  };
}
