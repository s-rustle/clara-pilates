/**
 * Balanced Body manual exercise headers:
 * Line 1: ALL CAPS exercise title (e.g. SWAN DIVE).
 * Line 2: LEVEL • rep range REPS (e.g. INTERMEDIATE • 3-5 REPS).
 * Section labels (STARTING POSITION, …) are ALL CAPS but are not followed by this level/reps line.
 */

/** Next line after an ALL CAPS title must match this (whole line, trimmed). */
export const LEVEL_REPS_LINE_REGEX =
  /^(BEGINNER|INTERMEDIATE|ADVANCED)\s*[•·]\s*\d+(?:-\d+)?\s*REPS?\s*$/i;

export function matchesLevelRepsLine(line: string): boolean {
  return LEVEL_REPS_LINE_REGEX.test(line.trim());
}

const SMALL_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "on",
  "at",
  "by",
]);

export function normalizeSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function capitalizeToken(token: string, isFirstWord: boolean): string {
  const parts = token.split("-").map((part) => {
    if (!part.length) return part;
    const lower = part.toLowerCase();
    if (!isFirstWord && SMALL_WORDS.has(lower)) {
      return lower;
    }
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
  return parts.join("-");
}

/**
 * Display exercise titles in Title Case (e.g. Swan Dive, Climb a Tree).
 * If the string already contains lowercase letters, returns trimmed as-is.
 */
export function toExerciseTitleCase(raw: string): string {
  const t = normalizeSpaces(raw);
  if (!t) return t;
  if (/[a-z]/.test(t)) return t;
  const words = t.split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => capitalizeToken(w, i === 0))
    .join(" ");
}

/**
 * UI helper: normalize stored names that may still be ALL CAPS from older data or sessions.
 */
export function formatExerciseNameForDisplay(name: string): string {
  const t = name.trim();
  if (!t) return t;
  if (/[a-z]/.test(t)) return t;
  if (!isAllCapsLine(t)) return t;
  return toExerciseTitleCase(t);
}

/** Level/reps header line → badge text e.g. "Intermediate • 3-5 reps". */
/** Badge text from Learn tutorial difficulty + rep_range fields. */
export function formatTutorialLevelRepsBadge(tutorial: {
  difficulty_level?: string;
  rep_range?: string | null;
}): string | null {
  const lv = tutorial.difficulty_level?.trim() ?? "";
  const rr = tutorial.rep_range?.trim() ?? "";
  if (!lv && !rr) return null;
  const lvBad = !lv || /^not specified/i.test(lv);
  if (lvBad && !rr) return null;
  if (lvBad) return rr;
  const levelNice = lv.charAt(0).toUpperCase() + lv.slice(1).toLowerCase();
  if (!rr) return levelNice;
  const rrNorm = rr.replace(/\s*reps?\s*$/i, "").trim();
  return `${levelNice} • ${rrNorm} reps`;
}

export function formatLevelRepsLineForDisplay(line: string): string {
  const trimmed = line.trim();
  const m = trimmed.match(
    /^(BEGINNER|INTERMEDIATE|ADVANCED)\s*[•·]\s*(\d+(?:-\d+)?)\s*REPS?\s*$/i
  );
  if (!m) return trimmed;
  const level = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return `${level} • ${m[2]} reps`;
}

export function isAllCapsLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 88) return false;
  if (!/[A-Z]/.test(t)) return false;
  if (/[a-z]/.test(t)) return false;
  return /^[A-Z0-9'’\s.,&\-–—]+$/u.test(t);
}

const IGNORE_ALL_CAPS_LINES = new Set(
  [
    "STARTING POSITION",
    "MOVEMENT SEQUENCE",
    "MOVEMENT",
    "PURPOSE",
    "BREATH",
    "PROGRESSIONS",
    "SPRING SETTINGS",
    "SESSION TEMPLATE",
    "PROGRESSION TABLE",
    "SEQUENCE",
    "LEVEL",
    "ARM VARIATIONS",
    "REPS",
    "ADVANCED",
    "BEGINNER",
    "INTERMEDIATE",
    "PRECAUTIONS",
    "NOTES",
    "TIPS",
    "INHALE",
    "EXHALE",
    "HANDWRITTEN NOTE",
  ].map((s) => s.toUpperCase())
);

const IGNORE_ALL_CAPS_TOKENS = new Set(
  [
    "STARTING",
    "POSITION",
    "MOVEMENT",
    "SEQUENCE",
    "ARM",
    "VARIATIONS",
    "REPS",
    "REP",
    "ADVANCED",
    "BEGINNER",
    "INTERMEDIATE",
    "PRECAUTIONS",
    "PURPOSE",
    "PROGRESSIONS",
    "PROGRESSION",
    "TABLE",
    "SESSION",
    "TEMPLATE",
    "SPRING",
    "SETTINGS",
    "BREATH",
    "LEVEL",
    "NOTES",
    "TIPS",
    "INHALE",
    "EXHALE",
    "HANDWRITTEN",
    "NOTE",
    "THE",
    "AND",
    "OR",
    "OF",
    "TO",
    "IN",
    "FOR",
    "A",
    "AN",
    "FIG",
    "FIGURE",
    "PAGE",
    "SEE",
  ].map((s) => s.toUpperCase())
);

export function shouldSkipAllCapsLine(line: string): boolean {
  const u = normalizeSpaces(line).toUpperCase();
  if (IGNORE_ALL_CAPS_LINES.has(u)) return true;
  const tokens = u.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.every((tok) => IGNORE_ALL_CAPS_TOKENS.has(tok))) return true;
  return false;
}

function isProbableAllCapsExerciseTitle(line: string): boolean {
  const trimmed = line.trim();
  if (!isAllCapsLine(trimmed)) return false;
  if (shouldSkipAllCapsLine(trimmed)) return false;
  const wc = normalizeSpaces(trimmed).split(/\s+/).filter(Boolean).length;
  if (wc >= 2) return true;
  if (wc === 1) {
    const tok = normalizeSpaces(trimmed);
    return tok.length >= 5 && tok.length <= 36;
  }
  return false;
}

/**
 * Remove ALL CAPS title + following LEVEL • N-N REPS line pairs from chunk/tutorial text
 * so body copy does not repeat the header; level/reps should be shown as metadata elsewhere.
 */
export function stripBalancedBodyExerciseHeadersFromText(text: string): string {
  if (!text) return text;
  const rawLines = text.split(/\n/);
  const out: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const next = rawLines[i + 1];
    if (
      next !== undefined &&
      isProbableAllCapsExerciseTitle(cur) &&
      matchesLevelRepsLine(next)
    ) {
      i += 1;
      continue;
    }
    out.push(cur);
  }
  return out.join("\n");
}

/** Strip standalone level/reps lines (e.g. pasted into a section). */
export function stripStandaloneLevelRepsLines(text: string): string {
  return text
    .split(/\n/)
    .filter((ln) => !matchesLevelRepsLine(ln))
    .join("\n");
}

const EXERCISE_TAGGED = /\*\*EXERCISE:\s*\[([^\]\*]+)\]\*\*/gi;
const EXERCISE_TAGGED_UNBRACKETED = /\*\*EXERCISE:\s*([^*\n]+?)\*\*/gi;
const BOLD_SPAN = /\*\*([^*]{2,100})\*\*/g;
const BOLD_SECTION_PREFIX =
  /^(EXERCISE|PURPOSE|MOVEMENT|LEVEL|PRECAUTIONS|BREATH|SESSION|PROGRESSION|SPRING|STARTING|NOTES?|TIPS?)\b/i;

const TITLE_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "fig",
  "figure",
  "page",
  "see",
  "note",
]);

function plausibleExerciseTitle(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 100) return false;
  if (/^\d+$/.test(t)) return false;
  const lower = t.toLowerCase();
  if (TITLE_STOP.has(lower)) return false;
  if (/^chunk\s*\d/i.test(t)) return false;
  if (/^exercise:\s*/i.test(t)) return false;
  return true;
}

const BANNED_TITLE_LINE_START =
  /^(The|This|When|For|If|In|As|At|To|On|Your|Use|Keep|Repeat|Note|See|Figure|Chapter|Table|Each|Both|Place|Hold|Start|Begin|With|From|After|Before|During|Do|Never|Always|There|These|Those|Some|Many|Most|All|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b/i;

function isTitleCaseExerciseToken(w: string): boolean {
  if (/^\d+([-–]\d+)?$/.test(w)) return true;
  const segments = w.split("-");
  for (const seg of segments) {
    if (!seg.length) return false;
    if (!/^[A-Z][a-z0-9']{0,28}$/.test(seg)) return false;
  }
  return segments.length > 0;
}

function isLikelyTitleCaseExerciseLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 8 || t.length > 78) return false;
  if (/^\d+[\.)]\s/.test(t)) return false;
  if (/^[\W\d]/.test(t)) return false;
  const words = normalizeSpaces(t).split(/\s+/);
  if (words.length < 2 || words.length > 8) return false;
  if (BANNED_TITLE_LINE_START.test(words[0])) return false;
  for (const w of words) {
    if (!isTitleCaseExerciseToken(w)) return false;
  }
  return true;
}

function stripNumberedLineNoise(s: string): string {
  let t = normalizeSpaces(s.replace(/\*+/g, "").trim());
  t = t.replace(/\s*\.{2,}.*$/, "").trim();
  t = t.replace(/\s*[-–—]\s*p\.?\s*\d+.*$/i, "").trim();
  return t;
}

function titleFromNumberedLine(line: string): string | null {
  const trimmed = line.trim();
  const dotted = /^\s*\d{1,2}[\.)]\s+(.+)$/.exec(trimmed);
  if (dotted) {
    const inner = stripNumberedLineNoise(dotted[1]);
    return inner.length >= 3 ? inner : null;
  }
  const spaced = /^\s*\d{1,2}\s+([A-Z][^\n]{2,90})$/.exec(trimmed);
  if (spaced) {
    const inner = stripNumberedLineNoise(spaced[1]);
    return inner.length >= 3 ? inner : null;
  }
  return null;
}

function scanTwoLineBalancedBodyHeaders(text: string, seen: Set<string>, out: string[]): void {
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    const titleLine = lines[i];
    const nextLine = lines[i + 1];
    if (!isProbableAllCapsExerciseTitle(titleLine)) continue;
    if (!matchesLevelRepsLine(nextLine)) continue;
    const display = toExerciseTitleCase(normalizeSpaces(titleLine));
    if (!plausibleExerciseTitle(display)) continue;
    const key = display.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
    i += 1;
  }
}

/**
 * Infer exercise names from curriculum chunk text for Learn / Practice Cues lists.
 * Uses ALL CAPS + LEVEL • REPS line pairs as the primary Balanced Body PDF signal.
 */
export function extractExerciseNamesFromContents(contents: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const pushTitle = (raw: string) => {
    const name = formatExerciseNameForDisplay(normalizeSpaces(raw));
    if (!plausibleExerciseTitle(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };

  for (const text of contents) {
    if (!text) continue;

    scanTwoLineBalancedBodyHeaders(text, seen, out);

    EXERCISE_TAGGED.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = EXERCISE_TAGGED.exec(text)) !== null) {
      pushTitle(m[1]);
    }

    EXERCISE_TAGGED_UNBRACKETED.lastIndex = 0;
    while ((m = EXERCISE_TAGGED_UNBRACKETED.exec(text)) !== null) {
      const inner = m[1].trim();
      const unbracket = inner.replace(/^\[|\]$/g, "").trim();
      pushTitle(unbracket);
    }

    BOLD_SPAN.lastIndex = 0;
    while ((m = BOLD_SPAN.exec(text)) !== null) {
      const inner = normalizeSpaces(m[1].trim());
      if (/^exercise:\s*/i.test(inner)) continue;
      if (BOLD_SECTION_PREFIX.test(inner)) continue;
      pushTitle(inner);
    }

    const lines = text.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const numberedTitle = titleFromNumberedLine(trimmed);
      if (numberedTitle) {
        pushTitle(numberedTitle);
        continue;
      }
      if (isLikelyTitleCaseExerciseLine(trimmed)) {
        pushTitle(trimmed);
      }
    }
  }

  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out.slice(0, 200);
}
