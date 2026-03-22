# Task Setting: Clara
*Balanced Body Comprehensive Certification Study System — Version 1.0 — Phase 1*

---

## How To Use This Document

Work through tasks in order. Each task is a single Cursor prompt session. Do not combine tasks — one task, one session, one stable checkpoint before moving on.

When starting each task, paste the relevant task block into Cursor along with this instruction:

> "Reference the Clara Constitution, Specification, and Planning documents. Complete only the task described below. Do not add features beyond what is specified. When done, confirm what was built and list any decisions made."

---

## Phase 1 — Project Setup, Auth, Navigation Shell

**Goal:** A working Next.js app with login and empty dashboard screens. Nothing functional yet — just the skeleton.

---

**Task 1.1 — Initialize Project**
```
Create a new Next.js 14 app called "clara" using the App Router with TypeScript and Tailwind CSS.

Install the following dependencies:
- @anthropic-ai/sdk
- @supabase/supabase-js
- @supabase/ssr
- googleapis
- date-fns
- clsx

Create .env.local with all environment variable keys from the Planning document (values empty). Create .env.example with the same keys.

Create the full folder structure from the Planning document Section 4 — create all files as empty placeholders with a single comment: "// TODO: implement".

Confirm the app runs locally on localhost:3000.
```

---

**Task 1.2 — Tailwind Theme**
```
Configure tailwind.config.ts to include the Clara color palette (Red Rocks brutalist — Constitution §6):

clara: {
  bg: '#E8E0D5',
  surface: '#DDD5C8',
  highlight: '#C9BFB0',
  accent: '#C4522A',
  primary: '#5C4A32',
  strong: '#3D3128',
  deep: '#1C1610',
  muted: '#8A7F74',
  rock: '#A63D1F',
}

Set the default background color to clara-bg and default text color to clara-deep.
Set the base font to Inter.
```

---

**Task 1.3 — Base UI Components**
```
Build the following reusable UI components in /components/ui/:

- Button.tsx — primary (clara-primary bg, white text), secondary (clara-surface bg, clara-deep text), destructive (red). All with hover states using clara-accent.
- Card.tsx — white surface, subtle border, light shadow. Accepts children and optional className.
- Input.tsx — full width, clara-surface background, clara-deep text, clara-strong border on focus.
- Select.tsx — same styling as Input, dropdown arrow in clara-strong.
- ProgressBar.tsx — accepts value (0-100), label, and sublabel. Fill color clara-primary. Background clara-highlight.
- Badge.tsx — small pill. Variants: green (clara-primary), yellow, red, grey.
- ErrorMessage.tsx — red-tinted card with error icon and message string prop.
- LoadingSpinner.tsx — animated, clara-primary color.

No external component library. Pure Tailwind only.
```

---

**Task 1.4 — Wordmark Component**
```
Build /components/layout/Wordmark.tsx.

Display the initials "SR" in Inter Bold, color clara-strong.
Below the initials, display "Clara" in Inter Bold (hierarchy via size), color clara-primary.
The wordmark should work on both light (clara-bg) and clara-surface backgrounds.
Accept a size prop: "sm" | "md" | "lg".
```

---

**Task 1.5 — Supabase Client Setup**
```
Configure Supabase clients:

- /lib/supabase/client.ts — browser client using createBrowserClient from @supabase/ssr
- /lib/supabase/server.ts — server client using createServerClient from @supabase/ssr, reads cookies
- /lib/supabase/middleware.ts — session refresh logic

Create /middleware.ts at project root:
- Protect all routes under /dashboard/* and /api/agents/*, /api/hours/*, /api/ingest/*
- Unauthenticated requests redirect to /login
- Use the Supabase middleware pattern for session management
```

---

**Task 1.6 — Login Screen**
```
Build /app/(auth)/login/page.tsx.

Design:
- Full screen, clara-bg background
- Centered card (clara-surface) with clara-strong border
- Wordmark at top of card (size "md")
- Email input field
- Password input field
- "Sign in" button (primary)
- Error message displayed below button if login fails (use ErrorMessage component)
- No registration link — this is invite-only

Functionality:
- On submit, call Supabase Auth signInWithPassword
- On success, redirect to /dashboard
- On failure, display explicit error: "Incorrect email or password. Please try again."
- Show LoadingSpinner on button while request is in flight
- Disable button during loading
```

---

**Task 1.7 — Dashboard Layout + Navigation**
```
Build /app/(dashboard)/layout.tsx with a persistent sidebar.

Sidebar design:
- clara-surface background, full height
- Wordmark at top (size "sm")
- Navigation links:
  - Dashboard (home icon)
  - Study (book icon)
  - Quiz (clipboard icon)
  - Practice Cues (microphone icon — greyed out, Phase 2 label)
  - Hours (clock icon)
  - Curriculum (folder icon)
  - Settings (gear icon)
- Active link: clara-primary text, clara-highlight background pill
- Inactive link: clara-deep text, hover clara-highlight background
- Sign out button at bottom

Main content area: clara-bg background, full width, scrollable.

TopBar: displays current page title and user initials avatar (clara-primary circle, white text "SR").
```

---

**Task 1.8 — Empty Screen Placeholders**
```
Build empty placeholder screens for all dashboard routes. Each screen should:
- Display the page title in clara-strong, Inter Bold
- Display a single Card with the text "Coming soon — [feature name]"
- Be fully navigable from the sidebar

Screens to create:
- /app/(dashboard)/page.tsx — "Dashboard"
- /app/(dashboard)/study/page.tsx — "Study"
- /app/(dashboard)/quiz/page.tsx — "Quiz"
- /app/(dashboard)/cues/page.tsx — "Practice Cues"
- /app/(dashboard)/hours/page.tsx — "Hour Tracking"
- /app/(dashboard)/curriculum/page.tsx — "Curriculum Manager"
- /app/(dashboard)/settings/page.tsx — "Settings"

Confirm all routes load without error and sidebar navigation works correctly.
```

---

## Phase 2 — Hour Tracking

**Goal:** Complete, working hour logging and progress tracking. No AI involved yet.

---

**Task 2.1 — Supabase Schema: Hours**
```
Run the following in the Supabase SQL editor (from Planning document Section 5):

1. Create the profiles table
2. Create the hour_logs table
3. Enable RLS on both tables
4. Apply RLS policies for both tables

Confirm tables exist and RLS is active in the Supabase dashboard.
```

---

**Task 2.2 — Hour Log API Route**
```
Build /app/api/hours/route.ts.

POST — create a new hour log entry
  - Accepts: category, sub_type, session_date, duration_minutes, notes, status
  - Validates all required fields present
  - Inserts into hour_logs table for authenticated user
  - Returns created record or explicit error message

GET — retrieve hour logs for authenticated user
  - Accepts optional query params: category, status, date_from, date_to
  - Returns array of matching hour logs
  - Returns explicit error if query fails

PATCH — update status of an existing log (scheduled → complete)
  - Accepts: id, status
  - Only allows status change on/after session_date
  - Returns updated record or explicit error
```

---

**Task 2.3 — Hours Progress Calculations**
```
Build /lib/utils/hours.ts with the following functions:

calculateTotalHours(logs) — returns total logged + complete hours in decimal hours
calculatePracticalHours(logs, type: 'mat' | 'reformer' | 'apparatus') — returns practical hours for each category
calculateScheduledHours(logs) — returns total scheduled (not yet complete) hours
calculateGaps(logs) — returns object with remaining hours needed per practical category and overall

Hour targets:
- Total: 536 hours
- Mat practical: 70 hours
- Reformer practical: 150 hours
- Apparatus practical: 150 hours

All functions accept the hour_logs array and return numbers rounded to 1 decimal place.
```

---

**Task 2.4 — Hour Log Form Component**
```
Build /components/hours/HourLogForm.tsx.

Fields:
- Category — Select dropdown with all 11 categories:
  Anatomy, Movement Principles, Mat 1, Mat 2, Mat 3,
  Reformer 1, Reformer 2, Reformer 3, Trapeze/Cadillac, Chair, Barrels
- Sub-type — Select: Theory, Practical, Observation, Teaching
- Date — CalendarPicker component (see Task 2.5)
- Duration — two inputs side by side: hours (number) and minutes (select: 0, 15, 30, 45)
- Notes — optional textarea
- Status — automatically set based on date selected:
  - Past or today: defaults to "logged"
  - Future date: defaults to "scheduled"
  - Display status as read-only Badge (green=logged, yellow=scheduled)

Submit button: "Log Hours"
On submit: POST to /api/hours, show LoadingSpinner, display success confirmation or ErrorMessage
On success: reset form, emit onSuccess callback to parent
```

---

**Task 2.5 — Calendar Picker Component**
```
Build /components/hours/CalendarPicker.tsx without any external calendar library — pure Tailwind and React state.

Features:
- Month/year navigation (prev/next arrows)
- No restriction on past dates (retroactive logging supported)
- Future dates selectable (for scheduling)
- Selected date highlighted in clara-primary
- Today's date outlined in clara-accent
- Dates with existing logs shown with a small clara-highlight dot indicator
- Keyboard accessible
- Returns selected date as ISO string to parent via onChange prop
```

---

**Task 2.6 — Hours Progress Panel**
```
Build /components/hours/HoursProgressPanel.tsx.

Display:
- Total progress bar: "X of 536 hours logged" — ProgressBar component, shows percentage
- Three practical progress bars:
  - Mat Practical: X of 70 hours
  - Reformer Practical: X of 150 hours
  - Apparatus Practical: X of 150 hours
- Gap summary section: plain language using calculateGaps()
  Example: "You need 42 more Reformer practical hours to meet your target."
- Scheduled hours note: "You have X hours scheduled upcoming — not yet counted toward progress."

Accepts logs array as prop. Calculates all values using /lib/utils/hours.ts functions.
```

---

**Task 2.7 — Hour Log Table**
```
Build /components/hours/HourLogTable.tsx.

Display:
- Sortable table of all hour logs (default: most recent first)
- Columns: Date, Category, Sub-type, Duration, Status, Notes
- Status column: Badge component (green=logged, yellow=scheduled, blue=complete)
- Scheduled entries show "Mark Complete" button — only active on/after session_date
- On "Mark Complete": PATCH /api/hours, update row status in UI optimistically
- Pagination: 20 rows per page
- Empty state: "No hours logged yet. Log your first session above."
```

---

**Task 2.8 — Hours Screen Assembly**
```
Assemble /app/(dashboard)/hours/page.tsx.

Layout (desktop):
- Page title: "Hour Tracking"
- Two-column layout:
  Left column (40%): HourLogForm + CalendarPicker
  Right column (60%): HoursProgressPanel
- Full-width below: HourLogTable

Data flow:
- Fetch all hour logs for authenticated user on page load
- Pass logs to HoursProgressPanel and HourLogTable
- On new log submitted via HourLogForm: refetch logs and update all components
- On "Mark Complete": refetch logs and update all components

Explicit error handling: if fetch fails, display ErrorMessage above the table.
```

---

## Phase 3 — Google Drive Connection + Ingestion Pipeline

**Goal:** Connect Google Drive, ingest manual images, store embeddings in Supabase pgvector.

---

**Task 3.1 — Supabase Schema: Curriculum**
```
Run in Supabase SQL editor (Planning document Section 5):

1. Enable pgvector extension: create extension if not exists vector;
2. Create curriculum_uploads table
3. Create curriculum_chunks table with vector(1536) embedding column
4. Create ivfflat index on embedding column
5. Enable RLS on both tables
6. Apply RLS policies

Confirm in Supabase dashboard that pgvector is enabled and tables exist.
```

---

**Task 3.2 — Google Drive OAuth**
```
Build /lib/google/auth.ts.

Implement:
- generateAuthUrl() — returns Google OAuth URL with Drive readonly scope
- getTokensFromCode(code) — exchanges auth code for tokens
- refreshAccessToken(refreshToken) — refreshes expired token
- Store tokens in Supabase profiles table (add google_access_token and google_refresh_token columns)

Build /app/api/auth/callback/route.ts:
- Handles Google OAuth redirect
- Exchanges code for tokens
- Stores tokens against authenticated user profile
- Redirects to /dashboard/curriculum on success
- Displays explicit error if exchange fails
```

---

**Task 3.3 — Google Drive File Fetching**
```
Build /lib/google/drive.ts.

Implement:
- listFolders(accessToken) — lists all folders in the user's Google Drive root (for folder selector)
- listFilesInFolder(accessToken, folderId) — lists all image files in a specific folder
- downloadFile(accessToken, fileId) — downloads file as buffer
- Handle token refresh automatically when 401 received

All functions return explicit error objects — never throw silently.
```

---

**Task 3.4 — Vision Extraction + Chunking**
```
Build /lib/google/ingest.ts.

Implement processImage(imageBuffer, fileName, folderName):
- Send image to Claude vision API (claude-sonnet-4-20250514)
- System prompt instructs Claude to:
  - Extract all printed text faithfully
  - Describe anatomical diagrams in detail
  - Flag and extract handwritten annotations separately with label "HANDWRITTEN NOTE:"
  - Preserve exercise names, spring settings, anatomical terms exactly as written
  - Return structured JSON: { printed_text, diagrams, handwritten_notes }
- On extraction failure: return explicit error with fileName

Implement chunkContent(extractedContent, uploadId, folderName, fileName):
- Chunk printed_text into 500-token segments with 50-token overlap
- Each diagram description becomes its own chunk
- Each handwritten note becomes its own chunk with content_type: 'handwritten'
- Returns array of chunk objects ready for embedding and insertion
```

---

**Task 3.5 — Embedding + Vector Storage**
```
Add to /lib/google/ingest.ts:

Implement embedAndStore(chunks, userId):
- For each chunk: generate embedding using Anthropic embeddings API (or text-embedding-ada-002 — use whichever Cursor recommends for pgvector compatibility)
- Insert chunk + embedding into curriculum_chunks table
- Update curriculum_uploads status to 'processing' at start, 'complete' on finish, 'failed' with error_message on any failure
- Process chunks in batches of 10 to avoid rate limits
- Return count of successfully stored chunks
```

---

**Task 3.6 — Ingestion API Route**
```
Build /app/api/ingest/route.ts.

POST — trigger ingestion for a specific folder
  - Accepts: drive_folder_id, folder_name
  - Creates or updates curriculum_uploads record with status 'processing'
  - Fetches all image files from folder via Drive API
  - Processes each file through processImage() and chunkContent()
  - Embeds and stores all chunks via embedAndStore()
  - Updates curriculum_uploads status on completion or failure
  - Returns: { success, chunks_stored, errors[] }
  - Explicit error response if Drive connection fails or API errors

DELETE — remove all chunks for a folder (re-ingest preparation)
  - Accepts: upload_id
  - Deletes all curriculum_chunks for that upload
  - Resets curriculum_uploads status to 'pending'
```

---

**Task 3.7 — Curriculum Manager Screen**
```
Build /app/(dashboard)/curriculum/page.tsx and supporting components.

DriveConnect component (/components/curriculum/DriveConnect.tsx):
- Shows Google Drive connection status (connected / not connected)
- "Connect Google Drive" button — initiates OAuth flow
- "Disconnect" button if connected — clears tokens from profile

FolderList component (/components/curriculum/FolderList.tsx):
- Shows all Drive folders available for ingestion
- Pre-populated with the 12 expected folder names from Specification Section 4.1
- Each folder row shows: folder name, ingestion status Badge, last ingested date, file count
- "Ingest" button per folder — calls POST /api/ingest
- "Re-ingest" button if already ingested — confirms before deleting and re-ingesting

IngestionStatus component (/components/curriculum/IngestionStatus.tsx):
- Real-time status updates during ingestion (poll every 3 seconds)
- Shows per-folder progress: "Processing file 4 of 12..."
- On completion: "12 files processed, 847 chunks stored"
- On failure: ErrorMessage with specific file name and error

Page assembly: DriveConnect at top, FolderList below, IngestionStatus panel on right.
```

---

## Phase 4 — Curriculum Agent

**Goal:** Study Q&A grounded in uploaded materials.

---

**Task 4.1 — RAG Query Utility**
```
Build /lib/anthropic/agents/curriculum.ts.

Implement queryRAG(userQuery, userId, folderFilter?):
- Embed user query
- Query curriculum_chunks via pgvector cosine similarity
- Return top 5 most relevant chunks with similarity score
- If folderFilter provided: restrict search to that folder's chunks
- If no chunks found (similarity below 0.7 threshold): return empty array with flag notFound: true

This utility is shared across all study-facing agents.
```

---

**Task 4.2 — Curriculum Agent**
```
Build the Curriculum Agent in /lib/anthropic/agents/curriculum.ts.

System prompt instructs the agent to:
- Answer questions about Pilates apparatus, anatomy, movement principles, cueing, contraindications, spring settings, and sequencing
- Ground every answer exclusively in the provided source chunks
- Always cite the source folder: "Based on your Mat 2 materials..."
- Return a confidence level: 'confident' | 'partial' | 'not_found'
- If not_found: respond "I couldn't find this in your uploaded materials. Consider adding relevant pages from your [folder name] folder."
- Never infer, extrapolate, or use general Pilates knowledge beyond the source chunks
- Be precise with anatomical terminology — do not paraphrase exercise names or body part names

Build /app/api/agents/curriculum/route.ts:
- POST: accepts { query, folder_filter? }
- Runs queryRAG
- Calls Curriculum Agent with chunks as context
- Returns { answer, confidence, source_folder, chunks_used }
- Explicit error if Claude API fails
```

---

**Task 4.3 — Study Screen**
```
Build /app/(dashboard)/study/page.tsx and components.

StudyInput component:
- Large text area: "Ask a study question..."
- Apparatus/topic filter — Select dropdown (All, or specific apparatus/category)
- Submit button: "Ask Clara"
- LoadingSpinner during API call

StudyResponse component:
- Answer text, formatted with paragraph breaks
- SourceBadge: "Based on your [folder name] materials" in clara-highlight pill
- Confidence indicator: 
  - Confident: green Badge "Source confirmed"
  - Partial: yellow Badge "Partial match"
  - Not Found: red Badge "Not in your materials" + suggestion text
- "Ask a follow-up" button — pre-fills StudyInput with context

Screen layout:
- StudyInput at top
- Conversation thread below — each Q&A pair in a Card
- Thread maintains context within session (not persisted across sessions)
- Empty state: "Ask Clara anything from your Balanced Body curriculum."
```

---

## Phase 5 — Examiner Agent

**Goal:** Full quiz sessions, scored and saved to Supabase.

---

**Task 5.1 — Supabase Schema: Quizzes**
```
Run in Supabase SQL editor:
1. Create quiz_sessions table
2. Create quiz_questions table
3. Enable RLS on both tables
4. Apply RLS policies

Confirm tables exist in Supabase dashboard.
```

---

**Task 5.2 — Examiner Agent**
```
Build /lib/anthropic/agents/examiner.ts.

Two functions:

generateQuestion(apparatus, topic, difficulty, previousQuestions, userId):
- Queries RAG for relevant source chunks on the selected apparatus/topic
- Generates one exam-style question grounded in source material
- Difficulty levels:
  - Foundational: recall and identification
  - Intermediate: application and explanation
  - Exam-Ready: synthesis, contraindications, edge cases
- Avoids repeating questions from previousQuestions array
- Returns: { question, expected_answer_elements[], source_chunks_used }

evaluateAnswer(question, userAnswer, expectedElements, isRetry, userId):
- Evaluates user answer against expected_answer_elements from source material
- Returns: { result: 'correct' | 'partial' | 'incorrect', feedback, correct_answer }
- If partial and isRetry is false: feedback encourages retry without revealing answer
- If partial and isRetry is true: reveals correct answer with full explanation
- If incorrect: reveals correct answer with full explanation
- All feedback grounded in source material

Build /app/api/agents/examiner/route.ts:
- POST /generate: generate next question
- POST /evaluate: evaluate submitted answer
- Explicit errors for all failure cases
```

---

**Task 5.3 — Quiz Screen**
```
Build /app/(dashboard)/quiz/page.tsx and components.

QuizSetup component:
- Apparatus selector (All, Mat, Reformer, Cadillac, Chair, Barrels, Anatomy, Movement Principles)
- Difficulty selector (Foundational, Intermediate, Exam-Ready)
- Question count selector (10, 15, 20)
- "Start Quiz" button

QuestionCard component:
- Question text
- Progress indicator: "Question 3 of 10"
- Score tracker: "7 correct so far"

AnswerInput component:
- Large textarea: "Type your answer..."
- "Submit Answer" button
- After first evaluation if partial: shows retry prompt "Not quite — try again"
- After retry (or if incorrect): shows EvaluationCard

EvaluationCard component:
- Result Badge: Correct (green) / Partial (yellow) / Incorrect (red)
- Feedback text
- Correct answer (shown after retry or if incorrect)
- "Next Question" button

QuizSummary component (shown on session complete):
- Final score: X of Y correct (percentage)
- Breakdown by topic
- Weakest area this session
- "Study weak areas" button — links to Study screen with filter pre-set
- "Try again" button

Data flow:
- Create quiz_session record in Supabase on quiz start
- Save each quiz_question record after evaluation
- Update quiz_session with final score on completion
- Trigger Weak Spot Agent analysis if total sessions ≥ 5
```

---

## Phase 6 — Cueing Feedback Agent

**Goal:** Written cue submission with structured feedback.

---

**Task 6.1 — Cueing Feedback Agent**
```
Build /lib/anthropic/agents/cues.ts.

System prompt instructs the agent to:
- Evaluate written Pilates cues against Balanced Body criteria
- Ground feedback in uploaded source materials where available
- Assess five dimensions: anatomical accuracy, starting position clarity, breath cue, precaution language, client accessibility
- Return structured JSON:
  {
    anatomical_accuracy: { score: 'correct' | 'needs_refinement', note: string },
    starting_position: { score: 'clear' | 'missing_elements', note: string },
    breath_cue: { score: 'present' | 'absent' | 'incorrect', note: string },
    precaution_language: { score: 'appropriate' | 'missing' | 'incorrect', note: string },
    client_accessibility: { score: 'appropriate' | 'needs_adjustment', note: string },
    overall: string,
    better_version: string
  }
- better_version: rewritten cue, presented as "Here is a better version:" — authoritative, grounded in source material

Build /app/api/agents/cues/route.ts:
- POST: accepts { cue, apparatus, exercise_name, client_level }
- Returns structured feedback JSON
- Explicit error if Claude API fails or source material not found for exercise
```

---

**Task 6.2 — Cueing Practice Screen**
```
Build /app/(dashboard)/cues/page.tsx and components.

CueInput component:
- Apparatus selector
- Exercise name input (free text)
- Client level selector: Beginner / Intermediate / Advanced
- Large textarea: "Write your cue here..."
- "Get Feedback" button + LoadingSpinner

FeedbackCard component:
- Five dimension rows — each with icon, label, score Badge, and note
  - Green Badge = correct/clear/present/appropriate
  - Yellow Badge = needs refinement / missing elements / needs adjustment
  - Red Badge = absent / incorrect
- Overall section: 1-2 sentence synthesis
- "Here is a better version:" section — clara-surface card, clara-strong text, italic
- "Try again" button — clears cue input, keeps exercise context

Session history:
- Below the input: list of cues submitted this session
- Each entry: exercise name, timestamp, overall score summary
- Clicking an entry re-displays its FeedbackCard
```

---

## Phase 7 — Session Planner Agent

**Goal:** Full session planning and logging with five-dimension AI feedback.

---

**Task 7.1 — Supabase Schema: Session Plans**
```
Run in Supabase SQL editor (Planning document Section 5.5):

1. Create the session_plans table
2. Enable RLS on the table
3. Apply RLS policy: "Users access own session plans"

Confirm table exists in Supabase dashboard.
```

---

**Task 7.2 — Session Plans API Route**
```
Build /app/api/sessions/route.ts.

POST — create or update a session plan
  - Accepts: mode, session_type, apparatus, client_level, warm_up (array), exercise_sequence (array), session_date, status
  - Validates all required fields
  - Inserts into session_plans for authenticated user
  - Returns created record or explicit error

GET — retrieve session plans for authenticated user
  - Accepts optional query params: mode, status, apparatus
  - Returns array of matching session plans ordered by created_at desc
  - Returns explicit error if query fails

PATCH — update session status or link hour log
  - Accepts: id, status, linked_hour_log_id (optional)
  - Used when Log Mode session is marked complete and linked to hours
  - Returns updated record or explicit error
```

---

**Task 7.3 — Session Planner Agent**
```
Build /lib/anthropic/agents/sessions.ts.

evaluateSession(sessionData, userId):
- Accepts full session object: mode, session_type, apparatus, client_level, warm_up array, exercise_sequence array
- Queries RAG for relevant source chunks across all exercises in the sequence
- Evaluates session across five dimensions, grounded in source material:

  1. Progression Logic
     - Is the pre-Pilates warm-up appropriate as preparation for the main sequence?
     - Are transitions between exercises logical?
     - Is there a closing/cool-down present or notably absent?
     - Returns: score ('sound' | 'needs_adjustment'), note

  2. Contraindication Flags
     - Any exercises with precautions for the stated client level?
     - Returns: array of { exercise_name, flag, recommendation } or empty array if none

  3. Volume Assessment
     - Are sets and reps within the 8-12 rep standard?
     - Flag any exercise with reps below 8 or above 12 with explanation
     - Assess total session volume for the apparatus and client level
     - Returns: score ('appropriate' | 'needs_adjustment'), note, flagged_exercises array

  4. Muscle Group Balance
     - Are anterior/posterior chains represented?
     - Is there flexion/extension balance?
     - Are lateral patterns included?
     - Returns: score ('balanced' | 'imbalanced'), note, gaps array

  5. Balanced Body Sequence Alignment
     - Does the sequence follow Balanced Body methodology from uploaded curriculum?
     - If source material not found for an exercise: flag as 'not verified' rather than invent
     - Returns: score ('aligned' | 'partially_aligned' | 'not_verified'), note

- Overall: 2-3 sentence synthesis
- Suggested adjustments: specific numbered recommendations with rationale
- Returns structured JSON matching session_plans.feedback schema

Build /app/api/agents/sessions/route.ts:
- POST: accepts session data, runs evaluateSession, returns structured feedback
- Saves feedback to session_plans record
- Explicit error if Claude API fails or RAG returns no relevant chunks
```

---

**Task 7.4 — Session Planner Screen**
```
Build /app/(dashboard)/sessions/page.tsx and all components.

SessionPlannerForm component (/components/sessions/SessionPlannerForm.tsx):
- Mode toggle at top: "Plan" / "Log" — clara-primary underline on active
- Session type selector: Teaching / Personal Practice
- Apparatus selector: Mat, Reformer, Trapeze/Cadillac, Chair, Barrels
- Client level selector (visible when Teaching only): Beginner / Intermediate / Advanced
- Session date: CalendarPicker (reuse from hours)

WarmUpSection component (/components/sessions/WarmUpSection.tsx):
- Section header: "Pre-Pilates Warm-Up"
- "Add warm-up move" button — opens searchable list of Balanced Body warm-up moves:
  (pelvic floor engagement, breathing, imprint, pelvic clock, ribcage placement, scapular movement, head/neck placement, stretching — populated from ingested materials where available, static fallback list otherwise)
- Each move row: move name | sets input (number, default 1) | reps input (number, default 8) | remove (×)
- Reorderable via up/down arrow buttons
- Empty state: "Add at least one warm-up move"

ExerciseSequence component (/components/sessions/ExerciseSequence.tsx):
- Section header: "Main Sequence"
- Rep range reference: "(Standard: 8–12 reps)" — clara-accent, small text, right-aligned
- "Add exercise" button — free text input with apparatus-filtered suggestions from ingested materials
- Each exercise row: exercise name | sets input | reps input | notes (optional, expandable) | remove (×)
- Reorderable via up/down arrow buttons
- Empty state: "Add at least one exercise"

Actions:
- "Get Feedback" button (primary) — submits to /api/agents/sessions, shows LoadingSpinner
- "Save Draft" button (secondary) — saves to /api/sessions without triggering agent
- Log Mode only: "Save & Link to Hours" button — on click:
  - Marks session status as 'complete'
  - Opens pre-filled HourLogForm modal with category auto-set from apparatus, date from session_date
  - On hour log saved: links hour log ID to session plan via PATCH /api/sessions

SessionFeedbackCard component (/components/sessions/SessionFeedbackCard.tsx):
- Appears below form after "Get Feedback" returns
- Five dimension rows:
  - Icon + label + score Badge + note
  - Progression Logic: green='Sound' / yellow='Needs adjustment'
  - Contraindication Flags: green='None flagged' / red='[N] flags — see details'
    - If flags present: expandable list of { exercise, flag, recommendation }
  - Volume Assessment: green='Appropriate' / yellow='Needs adjustment' + flagged exercises list
  - Muscle Group Balance: green='Balanced' / yellow='Imbalanced' + gaps list
  - Sequence Alignment: green='Aligned' / yellow='Partially aligned' / grey='Not verified'
- Overall: 2-3 sentence synthesis in clara-surface card
- Suggested Adjustments: numbered list, specific and actionable
- "Revise Routine" button — returns to edit mode with current routine intact (feedback panel closes)
- "Save Session" button — saves plan with feedback to Supabase

SessionHistory component (/components/sessions/SessionHistory.tsx):
- Visible below form, Log Mode only
- Table of completed sessions: Date | Apparatus | Session Type | Overall Score | Actions
- "View" button per row — opens read-only session + feedback in modal
- Empty state: "No sessions logged yet."

Page assembly:
- SessionPlannerForm (left, 55%)
- SessionFeedbackCard (right, 45%) — empty state when no feedback yet: "Build your session and get feedback from Clara."
- SessionHistory below (full width, Log Mode only)
```

---

**Task 7.5 — Sidebar Navigation Update**
```
Update /components/layout/Sidebar.tsx to add Session Planner nav item.

Add between Quiz and Practice Cues:
- Label: "Sessions"
- Icon: calendar or layout icon
- Route: /dashboard/sessions

Update the empty placeholder screen at /app/(dashboard)/sessions/page.tsx — remove placeholder, it is now built.

Confirm navigation works and active state highlights correctly.
```

---

## Phase 8 — Learn Agent (Tutorial Mode)

**Goal:** Exercise-by-exercise tutorial screen driven by RAG. User selects apparatus + exercise or body part; Clara presents structured content from source material only.

---

**Task 8.1 — Learn Agent**
```
Build /lib/anthropic/agents/learn.ts.

fetchTutorialContent(apparatus, query, userId):
- Accepts: apparatus (Mat, Reformer, Cadillac, Chair, Barrels), query (specific exercise name OR body part/muscle group)
- Searches pgvector for relevant curriculum chunks using queryRAG pattern
- If query is exercise name: search for that exercise
- If query is body part/muscle group: search for exercises targeting that area
- Returns structured array of exercises, each with:
  - exercise_name: string
  - starting_position: string
  - movement_description: string
  - breath_cues: string
  - spring_settings: string | null
  - precautions: string
  - source_file_name: string (for manual page image lookup)
  - source_folder: string

- Agent structures content exclusively from source chunks — never invents
- If no chunks found: return { not_found: true, suggestion: "Consider adding relevant pages from your [folder] manual." }
- Orders exercises logically (by sequence in source material when possible)

Build /app/api/agents/learn/route.ts:
- POST: accepts { apparatus, query } (query = exercise name OR body part)
- Returns { exercises: [...], not_found?: boolean, suggestion?: string }
- Fetches manual page image URL from Google Drive for each exercise's source_file_name (if available)
- Explicit error if Claude API fails or RAG returns empty
```

---

**Task 8.2 — Manual Image Retrieval**
```
Extend ingestion/Drive logic to support fetching a specific file's image URL for display.

- Add utility or extend /lib/google/drive.ts: getFileImageUrl(accessToken, fileId) or getFileThumbnailUrl
- Curriculum chunks store upload_id, folder_name, file_name — use to lookup Drive file ID from curriculum_uploads + folder structure
- Learn Agent response includes image_url for each exercise when source image exists in Drive

If Drive file-to-chunk mapping is complex: Phase 1 can display "Manual page" placeholder with source citation (file name, folder) — image display in Phase 2.
```

---

**Task 8.3 — Learn Screen**
```
Build /app/(dashboard)/learn/page.tsx and components.

LearnSelector component (/components/learn/LearnSelector.tsx):
- Apparatus selector: Mat, Reformer, Cadillac, Chair, Barrels
- Search input: "Exercise name or body part (e.g., The Hundred, hip flexors)"
- "Start Tutorial" button
- On submit: POST to /api/agents/learn, store exercises in state
- LoadingSpinner during fetch
- If not_found: display ErrorMessage with suggestion

TutorialCard component (/components/learn/TutorialCard.tsx):
- Displays one exercise at a time
- Sections: Starting Position, Movement, Breath Cues, Spring Settings (if any), Precautions
- Manual page image (or placeholder + citation) alongside text
- "Next" and "Previous" buttons
- Progress indicator: "Exercise 2 of 6"

Page layout:
- LearnSelector at top
- When exercises loaded: TutorialCard with nav and progress
- Empty state before search: "Select an apparatus and enter an exercise name or body part to learn from your curriculum."
```

---

**Task 8.4 — Sidebar Navigation Update**
```
Update /components/layout/Sidebar.tsx to add Learn nav item.

Add between Sessions and Hours:
- Label: "Learn"
- Icon: GraduationCap or BookMarked
- Route: /learn

Update DashboardShell/titleMap if used to include "Learn" for /learn route.

Confirm navigation works and Learn screen is accessible.
```

---

## Phase 9 — Weak Spot Agent

**Goal:** Pattern analysis across quiz history, surfaced on dashboard.

---

**Task 9.1 — Weak Spot Agent**
```
Build /lib/anthropic/agents/weakspot.ts.

analyzeWeakSpots(userId):
- Fetch all quiz_questions for user from Supabase
- Group by apparatus, topic, and question type
- Calculate accuracy rate per group
- Identify top 3 groups with lowest accuracy (minimum 3 questions attempted per group)
- For each weak spot: generate plain-language pattern description
  Example: "You consistently miss questions about contraindications on the Cadillac (40% accuracy across 8 questions)"
- Return:
  {
    top_three: [{ area, accuracy_percent, question_count, pattern_description, recommended_action }],
    analysis_date: timestamp,
    sessions_analyzed: number
  }
- Only runs if user has completed ≥ 5 quiz sessions
- If fewer than 5 sessions: return { insufficient_data: true, sessions_needed: X }

Build /app/api/agents/weakspot/route.ts:
- POST: triggers analysis, saves result to Supabase (add weak_spot_analyses table)
- GET: returns most recent analysis for user
```

---

**Task 9.2 — Weak Spot Schema + Dashboard Card**
```
Add to Supabase SQL editor:
Create weak_spot_analyses table:
  id, user_id, top_three (jsonb), sessions_analyzed, created_at
Enable RLS, apply policy.

Build /components/dashboard/WeakSpotCard.tsx:
- Displays #1 priority weak spot only
- Shows: apparatus/topic label, accuracy percentage, pattern description
- "Study this now" button — links to Study screen with apparatus pre-filtered
- If insufficient data: "Complete 5 quiz sessions to unlock weak spot analysis" with progress indicator (e.g., "3 of 5 sessions complete")
- Updates after every quiz session completion
```

---

## Phase 9 — Readiness Synthesizer

**Goal:** Readiness score calculated, displayed, and tracked over time.

---

**Task 10.1 — Readiness Calculations**
```
Build /lib/utils/readiness.ts.

calculateCurriculumScore(userId):
- Count distinct folder_names in curriculum_chunks for user
- Count distinct folder_names that appear in quiz_questions source_chunks_used
- Score = (folders queried / folders ingested) * 100
- Returns 0 if no folders ingested

calculateQuizScore(userId):
- Fetch last 10 completed quiz_sessions
- Average score_percent across sessions
- Returns 0 if fewer than 1 session completed

calculateHoursScore(userId):
- Fetch all logged + complete hour_logs
- Total hours / 536 * 100
- Returns 0 if no hours logged

calculateOverallScore(curriculum, quiz, hours):
- (curriculum * 0.33) + (quiz * 0.34) + (hours * 0.33)
- Rounded to 1 decimal place
```

---

**Task 10.2 — Readiness Synthesizer Agent**
```
Build /lib/anthropic/agents/readiness.ts.

generateReadinessBrief(scores, userId):
- Accepts: { curriculum_score, quiz_score, hours_score, overall_score, weak_spots }
- Generates plain-language readiness brief covering:
  - What's strong
  - What needs the most attention
  - Top 3 recommended next actions (specific — not generic)
- Does not invent progress — works only from the score data passed in
- Returns: { narrative, recommendations: [string, string, string] }

Build /app/api/agents/readiness/route.ts:
- POST: calculates all scores, generates brief, saves snapshot to Supabase
- GET: returns most recent snapshot for user
- Snapshot saved after every quiz session completion and every hour log entry
```

---

**Task 10.3 — Readiness Dashboard Screen**
```
Update /app/(dashboard)/page.tsx (Dashboard home).

Build /components/dashboard/ReadinessCard.tsx:
- Overall readiness score: large, prominent percentage in clara-strong
- Radial or segmented progress indicator
- Three dimension scores below: Curriculum / Quiz / Hours — each with label and percentage
- Narrative text from Readiness Agent (2-3 sentences)
- "View recommendations" expandable section showing top 3 actions

Build /components/dashboard/HoursSummaryCard.tsx:
- Total hours progress bar
- Three practical category progress bars (Mat / Reformer / Apparatus)
- Link to Hours screen

Dashboard layout (final):
- Top row: ReadinessCard (full width)
- Second row: HoursSummaryCard (60%) + WeakSpotCard (40%)
- Third row: Quick Actions — four buttons: Study, Quiz, Practice Cues, Log Hours
- Bottom: Recent Activity — last 5 quiz sessions or hour logs
```

---

## Phase 11 — Polish + Error Handling Audit

**Goal:** Every error state tested. UI consistent across all screens.

---

**Task 11.1 — Error Handling Audit**
```
Review every API route and agent call in the application.

For each:
- Confirm try/catch is in place
- Confirm explicit error message is returned (not generic 500)
- Confirm ErrorMessage component is displayed in the UI when the call fails
- Confirm LoadingSpinner appears during every async operation
- Confirm no silent failures exist

Test the following failure scenarios manually:
- Google Drive disconnected mid-ingestion
- Claude API called with no RAG chunks found
- Supabase write fails during quiz session save
- Hour log submitted with missing required fields
- Quiz started with no curriculum ingested (show warning: "No curriculum uploaded yet — answers may be limited")
- Learn screen: no RAG chunks for exercise/body part (show "not found" with folder suggestion)
```

---

**Task 11.2 — UI Consistency Pass**
```
Review all screens for visual consistency:

- All headings: Inter Bold, clara-strong
- All body text: Inter Regular, clara-deep
- All Cards: clara-surface background, consistent border radius and padding
- All primary buttons: clara-primary, consistent sizing
- All progress bars: clara-primary fill, clara-highlight background
- All Badges: correct color variant per status
- Sidebar active state consistent across all pages
- Mobile browser view acceptable (not optimized, but not broken)

Fix any inconsistencies found. Do not add new features.
```

---

**Task 11.3 — Settings Screen**
```
Build /app/(dashboard)/settings/page.tsx.

Sections:
- Profile: display name (editable), email (read-only from Supabase Auth)
- Exam Target Date: date picker — optional, saves to profiles table. Note: "Exam countdown coming in Phase 2"
- Hour Targets: editable fields for each practical category target (defaults: Mat 70, Reformer 150, Apparatus 150) — saves to profiles table
- Sign out button

All saves: explicit success confirmation or ErrorMessage.
```

---

## Phase 12 — Vercel Deployment + Smoke Test

**Goal:** Live URL, accessible on phone, end-to-end working.

---

**Task 12.1 — Vercel Deployment**
```
Deploy Clara to Vercel:

1. Push final code to GitHub repository
2. Connect GitHub repo to Vercel project
3. Add all environment variables to Vercel project settings (match .env.local exactly)
4. Set NEXT_PUBLIC_APP_URL to the Vercel deployment URL
5. Update Google OAuth redirect URI to include the Vercel URL
6. Trigger deployment
7. Confirm build completes without errors

If build fails: fix errors before proceeding to smoke test.
```

---

**Task 12.2 — Smoke Test**
```
Test the following end-to-end on the live Vercel URL:

Authentication:
- [ ] Login with correct credentials — redirects to dashboard
- [ ] Login with incorrect credentials — shows error message
- [ ] Direct URL to /dashboard without auth — redirects to login

Hour Tracking:
- [ ] Log a past hour entry — appears in table, progress bars update
- [ ] Schedule a future hour entry — appears as "Scheduled" in table
- [ ] Mark a scheduled entry complete — status updates, counted in progress

Curriculum:
- [ ] Connect Google Drive
- [ ] Ingest one folder (minimum 3 files)
- [ ] Confirm chunks appear in Supabase curriculum_chunks table

Study:
- [ ] Ask a question about ingested material — answer cites source folder
- [ ] Ask a question not in materials — explicit "not found" response

Quiz:
- [ ] Complete a 10-question quiz — session saves to Supabase
- [ ] Verify correct/incorrect scoring
- [ ] Confirm retry logic works (one retry, then answer revealed)

Cueing:
- [ ] Submit a written cue — structured feedback returns
- [ ] "Better version" appears in feedback

Learn:
- [ ] Select apparatus + exercise name — tutorial loads, Next/Previous works
- [ ] Select apparatus + body part — tutorial loads from RAG
- [ ] Progress indicator shows "Exercise X of Y"
- [ ] Manual page image or citation displayed

Dashboard:
- [ ] Readiness score updates after completing quiz
- [ ] Hours progress bars reflect logged hours

Mobile browser:
- [ ] Open Vercel URL on phone — app loads, login works, dashboard visible

All checks must pass before the build is declared complete.
```

---

## Appendix: Cursor Session Protocol

Every Cursor session:

1. Open the relevant Task block above
2. Paste into Cursor with: *"Reference the Clara Constitution, Specification, and Planning documents. Complete only this task. Do not add features beyond what is specified."*
3. Review what Cursor built before accepting
4. Test the feature manually before moving to the next task
5. Commit to GitHub after each stable task

Never start the next task until the current one passes its manual test.

---

*Clara — Task Setting version 1.0 — ready for Implementation*
