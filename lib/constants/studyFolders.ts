/** Values accepted by Study `folder_filter` (matches StudyInput options, excluding "All"). */
export const STUDY_FOLDER_VALUES = [
  "Anatomy",
  "Movement Principles",
  "Mat 1",
  "Mat 2",
  "Mat 3",
  "Reformer 1",
  "Reformer 2",
  "Reformer 3",
  "Trapeze Cadillac",
  "Chair",
  "Barrels",
] as const;

const VALID = new Set<string>(STUDY_FOLDER_VALUES);

const AREA_SEP = " — ";

/**
 * Map a weak-spot `area` label ("{apparatus} — {topic|General}") to a Study folder filter value.
 */
export function studyFolderFromWeakSpotArea(area: string): string {
  const idx = area.indexOf(AREA_SEP);
  if (idx === -1) return "";
  const apparatus = area.slice(0, idx).trim();
  const topicPart = area.slice(idx + AREA_SEP.length).trim();

  if (topicPart && topicPart !== "General" && VALID.has(topicPart)) {
    return topicPart;
  }
  if (VALID.has(apparatus)) {
    return apparatus;
  }
  if (apparatus === "Mat") return "Mat 1";
  if (apparatus === "Reformer") return "Reformer 1";
  return "";
}

/**
 * Resolve Study folder from `?folder=` or legacy `?apparatus=` query params.
 */
export function studyFolderFromSearchParams(
  folderParam: string | null,
  apparatusParam: string | null
): string {
  if (folderParam && VALID.has(folderParam)) {
    return folderParam;
  }
  if (!apparatusParam) return "";
  if (VALID.has(apparatusParam)) return apparatusParam;
  if (apparatusParam === "Mat") return "Mat 1";
  if (apparatusParam === "Reformer") return "Reformer 1";
  const fromWeakSpot = studyFolderFromWeakSpotArea(apparatusParam);
  return fromWeakSpot;
}
