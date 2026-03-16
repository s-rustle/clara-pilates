export interface ExtractedContent {
  printed_text: string;
  diagrams: string[];
  handwritten_notes: string[];
  fileName: string;
  folderName: string;
}

export interface ContentChunk {
  content: string;
  content_type: "text" | "diagram" | "handwritten";
  upload_id: string;
  folder_name: string;
  file_name: string;
  chunk_index: number;
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

export interface Profile {
  id: string;
  full_name: string | null;
  exam_target_date: string | null;
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
  created_at: string;
}

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
  mode: string;
  session_type: string;
  apparatus: string;
  client_level: string | null;
  warm_up: WarmUpMove[];
  exercise_sequence: ExerciseItem[];
  feedback: Record<string, unknown> | null;
  linked_hour_log_id: string | null;
  session_date: string | null;
  status: string;
  created_at: string;
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

export interface CurriculumResponse {
  answer: string;
  confidence: "confident" | "partial" | "not_found";
  source_folder: string | null;
  chunks_used: number;
}

export interface RagChunk {
  content: string;
  content_type: "text" | "diagram" | "handwritten";
  folder_name: string;
  file_name: string;
  similarity: number;
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
  created_at: string;
}

export interface WeakSpotItem {
  area: string;
  accuracy_percent: number;
  question_count: number;
  pattern_description: string;
  recommended_action: string;
}

export interface WeakSpotAnalysis {
  id: string;
  user_id: string;
  top_three: WeakSpotItem[];
  sessions_analyzed: number;
  created_at: string;
}
