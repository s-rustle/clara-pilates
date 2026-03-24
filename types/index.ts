export type QuizDifficulty = "Foundational" | "Intermediate" | "Exam-Ready";
export type QuizResult = "correct" | "partial" | "incorrect";
export type QuizStatus = "in_progress" | "complete";

export type QuizQuestionFormat =
  | "open_ended"
  | "multiple_choice"
  | "fill_blank"
  | "matching"
  | "diagram_matching"
  | "anatomy_multiple_choice"
  | "anatomy_diagram";

export interface McOption {
  id: string;
  text: string;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface CueDimension {
  score: string;
  note: string;
}

export interface CueFeedback {
  anatomical_accuracy: CueDimension;
  starting_position: CueDimension;
  breath_cue: CueDimension;
  precaution_language: CueDimension;
  client_accessibility: CueDimension;
  overall: string;
  better_version: string;
}

/** Parsed BB manual subsection text keyed for storage / filtering */
export interface ExerciseChunkSections {
  starting_position?: string;
  movement_sequence?: string;
  modifications?: string;
  optimum_form?: string;
  transition?: string;
  cueing_and_imagery?: string;
  purpose?: string;
  precautions?: string;
}

/** One exercise block from PDF text (processPdf); drives per-exercise embedding chunks */
export interface PdfExerciseSegment {
  exercise_name: string;
  difficulty: string | null;
  rep_range: string | null;
  content: string;
  sections: ExerciseChunkSections;
}

export interface ExtractedContent {
  printed_text: string;
  diagrams: string[];
  handwritten_notes: string[];
  fileName: string;
  folderName: string;
  /** When set (PDF path), chunkContent emits one row per exercise instead of size-based splits */
  pdf_exercise_segments?: PdfExerciseSegment[];
  /** Text before the first detected exercise (e.g. TOC), embedded as its own chunk when substantial */
  pdf_preamble?: string | null;
}

export interface ContentChunk {
  content: string;
  content_type: "text" | "diagram" | "handwritten";
  upload_id: string;
  folder_name: string;
  file_name: string;
  chunk_index: number;
  /** Google Drive file id for this source (same for all chunks from one file) */
  drive_file_id?: string | null;
  source_mime_type?: string | null;
  exercise_name?: string | null;
  difficulty?: string | null;
  rep_range?: string | null;
  sections?: ExerciseChunkSections | null;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

/** Saved in `profiles.hour_targets` (jsonb). Keys use snake_case. */
export interface HourTargets {
  mat_practical: number;
  reformer_practical: number;
  apparatus_practical: number;
  total: number;
}

export const DEFAULT_HOUR_TARGETS: HourTargets = {
  mat_practical: 70,
  reformer_practical: 150,
  apparatus_practical: 150,
  total: 536,
};

export interface Profile {
  id: string;
  full_name: string | null;
  exam_target_date: string | null;
  hour_targets?: HourTargets | null;
  google_access_token: string | null;
  google_refresh_token: string | null;
  created_at: string;
}

export interface HourLog {
  id: string;
  user_id: string;
  category: string;
  sub_type: string;
  session_date: string;
  duration_minutes: number;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface QuizSession {
  id: string;
  user_id: string;
  apparatus: string;
  topic: string | null;
  difficulty: string;
  question_count: number;
  score_percent: number | null;
  completed_at: string | null;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  session_id: string;
  question: string;
  user_answer: string | null;
  retry_answer: string | null;
  correct_answer: string | null;
  result: string | null;
  feedback: string | null;
  folder_name: string | null;
  created_at: string;
}

export type SessionMode = "plan" | "log";
export type SessionType = "teaching" | "personal";
export type SessionStatus = "draft" | "complete";

export interface WarmUpMove {
  move_name: string;
  sets: number;
  reps: number;
}

export interface ExerciseItem {
  exercise_name: string;
  sets: number;
  reps: number;
  notes?: string;
}

export interface SessionPlan {
  id: string;
  user_id: string;
  mode: SessionMode;
  session_type: SessionType;
  apparatus: string;
  client_level: string | null;
  warm_up: WarmUpMove[];
  exercise_sequence: ExerciseItem[];
  feedback: Record<string, unknown> | null;
  linked_hour_log_id: string | null;
  session_date: string | null;
  status: SessionStatus;
  created_at: string;
}

export interface SessionFeedback {
  progression_logic: { score: string; note: string };
  contraindication_flags: {
    score: string;
    flags: Array<{
      exercise_name: string;
      flag: string;
      recommendation: string;
    }>;
  };
  volume_assessment: {
    score: string;
    note: string;
    flagged_exercises: string[];
  };
  muscle_group_balance: { score: string; note: string; gaps: string[] };
  sequence_alignment: { score: string; note: string };
  overall: string;
  suggested_adjustments: string[];
}

/** LLM-generated readiness copy (also persisted on ReadinessSnapshot). */
export interface ReadinessBrief {
  narrative: string;
  recommendations: string[];
}

export interface ReadinessSnapshot {
  id: string;
  user_id: string;
  overall_score: number;
  curriculum_score: number;
  quiz_score: number;
  hours_score: number;
  narrative: string | null;
  recommendations: unknown[] | null;
  created_at: string;
}

export interface CurriculumUpload {
  id: string;
  user_id: string;
  folder_name: string;
  drive_folder_id: string;
  file_count: number | null;
  status: string;
  last_ingested_at: string | null;
  error_message: string | null;
  created_at: string;
}

/** Diagram / illustration text from retrieved chunks (no binary images stored in RAG). */
export interface SourceFigure {
  file_name: string;
  description: string;
  content_type: "diagram" | "text";
  drive_file_id?: string | null;
}

/** Image file from your Drive linked to a matched chunk (shown in Study). */
export interface SourceImage {
  drive_file_id: string;
  file_name: string;
  mime_type: string;
}

/** PDF (or other non-image) source file for “open in Drive” links. */
export interface SourceDocument {
  drive_file_id: string;
  file_name: string;
  mime_type: string;
}

export interface TutorialContent {
  exercise_name: string;
  apparatus: string;
  /** Program level from manual header (e.g. Intermediate) when stated */
  difficulty_level: string;
  /** Recommended rep range from exercise header (e.g. 4-6) when stated */
  rep_range: string | null;
  starting_position: string;
  movement_description: string;
  breath_cues: string;
  spring_settings: string | null;
  precautions: string;
  teaching_tips: string;
  /** Muscle groups / goals from Purpose sections in source material */
  muscle_groups: string;
  /** Prior/next exercises in Balanced Body progressions when documented */
  progressions: string | null;
  source_folder: string;
  error?: string;
  /** First curriculum image chunk from RAG (Drive), when available */
  manual_image?: { file_name: string; folder_name: string } | null;
}

export interface CurriculumResponse {
  answer: string;
  confidence: "confident" | "partial" | "not_found";
  source_folder: string | null;
  chunks_used: number;
  /** Excerpts from textbook figures/diagrams found in source chunks */
  figures?: SourceFigure[];
  /** Image files from Drive tied to retrieved chunks (requires re-ingest after migration) */
  source_images?: SourceImage[];
  /** PDFs and other documents matched in RAG (open in Google Drive) */
  source_documents?: SourceDocument[];
}

export interface RagChunk {
  content: string;
  content_type: "text" | "diagram" | "handwritten";
  folder_name: string;
  file_name: string;
  similarity: number;
  drive_file_id?: string | null;
  source_mime_type?: string | null;
}

export interface RAGResult {
  chunks: RagChunk[];
  notFound: boolean;
}

export interface CurriculumChunk {
  id: string;
  user_id: string;
  upload_id: string;
  folder_name: string;
  file_name: string;
  chunk_index: number;
  content: string;
  content_type: string | null;
  embedding: number[] | null;
  drive_file_id?: string | null;
  source_mime_type?: string | null;
  exercise_name?: string | null;
  difficulty?: string | null;
  rep_range?: string | null;
  sections?: ExerciseChunkSections | null;
  created_at: string;
}

export interface WeakSpotItem {
  area: string;
  accuracy_percent: number;
  question_count: number;
  pattern_description: string;
  recommended_action: string;
}

/** Runtime result from analyzeWeakSpots / API (not necessarily a persisted row). */
export interface WeakSpotResult {
  insufficient_data: boolean;
  sessions_needed?: number;
  top_three?: WeakSpotItem[];
  sessions_analyzed?: number;
}

export interface WeakSpotAnalysis {
  id: string;
  user_id: string;
  top_three: WeakSpotItem[];
  sessions_analyzed: number;
  insufficient_data: boolean;
  sessions_needed: number | null;
  created_at: string;
}
