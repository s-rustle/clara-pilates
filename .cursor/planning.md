# Planning: Clara
*Balanced Body Comprehensive Certification Study System — Version 1.0 — Phase 1*

---

## 1. Build Sequence

Build in this order. Do not skip ahead. Each phase depends on the previous being stable.

| Phase | What Gets Built | Stable When |
|---|---|---|
| 1 | Project setup, auth, navigation shell | Login works, all screens render (empty) |
| 2 | Supabase schema + hour tracking | Hours log, display, and progress bars work |
| 3 | Google Drive connection + ingestion pipeline | Folder connects, files process, embeddings stored |
| 4 | Curriculum Agent (study Q&A) | Answers questions grounded in uploaded material |
| 5 | Examiner Agent (quiz mode) | Full quiz session runs, saves to Supabase |
| 6 | Cueing Feedback Agent | Written cue submitted, structured feedback returned |
| 7 | Session Planner Agent | Routine submitted, five-dimension feedback returned; Log Mode links to hours |
| 8 | Learn Agent (tutorial mode) | Exercise-by-exercise tutorials from RAG; manual images; Next/Previous navigation |
| 9 | Weak Spot Agent | Patterns surface after 5+ quiz sessions |
| 10 | Readiness Synthesizer | Score calculates and displays correctly |
| 11 | Polish + error handling audit | All error states tested, UI consistent |
| 12 | Vercel deployment + smoke test | Live URL works end to end |

---

## 2. Project Initialization

```bash
npx create-next-app@14 clara --typescript --tailwind --app
cd clara
```

### 2.1 Dependencies to Install
```bash
npm install @anthropic-ai/sdk
npm install @supabase/supabase-js @supabase/ssr
npm install googleapis
npm install ai
npm install date-fns
npm install clsx
```

---

## 3. Environment Variables

Create `.env.local` at project root. Never commit this file.

```env
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Drive OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. File & Folder Structure

```
clara/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx               # Sidebar + nav shell
│   │   ├── page.tsx                 # Dashboard home
│   │   ├── study/
│   │   │   └── page.tsx             # Curriculum Agent Q&A
│   │   ├── quiz/
│   │   │   └── page.tsx             # Examiner Agent quiz mode
│   │   ├── cues/
│   │   │   └── page.tsx             # Cueing Feedback Agent
│   │   ├── sessions/
│   │   │   └── page.tsx             # Session Planner
│   │   ├── learn/
│   │   │   └── page.tsx             # Learn (tutorial mode)
│   │   ├── hours/
│   │   │   └── page.tsx             # Hour tracking + calendar
│   │   ├── curriculum/
│   │   │   └── page.tsx             # Curriculum Manager (admin)
│   │   └── settings/
│   │       └── page.tsx             # Profile + exam date
│   └── api/
│       ├── agents/
│       │   ├── curriculum/
│       │   │   └── route.ts         # Curriculum Agent endpoint
│       │   ├── examiner/
│       │   │   └── route.ts         # Examiner Agent endpoint
│       │   ├── cues/
│       │   │   └── route.ts         # Cueing Feedback Agent endpoint
│       │   ├── sessions/
│       │   │   └── route.ts         # Session Planner Agent endpoint
│       │   ├── learn/
│       │   │   └── route.ts         # Learn Agent endpoint
│       │   ├── weakspot/
│       │   │   └── route.ts         # Weak Spot Agent endpoint
│       │   └── readiness/
│       │       └── route.ts         # Readiness Synthesizer endpoint
│       ├── hours/
│       │   └── route.ts             # Hour log CRUD
│       ├── sessions/
│       │   └── route.ts             # Session plan CRUD
│       ├── ingest/
│       │   └── route.ts             # Google Drive ingestion trigger
│       └── auth/
│           └── callback/
│               └── route.ts         # Supabase auth callback
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── Badge.tsx
│   │   ├── ErrorMessage.tsx
│   │   └── LoadingSpinner.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── Wordmark.tsx             # SC initials wordmark
│   ├── dashboard/
│   │   ├── ReadinessCard.tsx
│   │   ├── HoursSummaryCard.tsx
│   │   ├── WeakSpotCard.tsx
│   │   └── QuickActions.tsx
│   ├── study/
│   │   ├── StudyInput.tsx
│   │   ├── StudyResponse.tsx
│   │   └── SourceBadge.tsx          # "Based on your Mat 2 materials"
│   ├── quiz/
│   │   ├── QuizSetup.tsx
│   │   ├── QuestionCard.tsx
│   │   ├── AnswerInput.tsx
│   │   ├── EvaluationCard.tsx
│   │   └── QuizSummary.tsx
│   ├── cues/
│   │   ├── CueInput.tsx
│   │   └── FeedbackCard.tsx
│   ├── learn/
│   │   ├── LearnSelector.tsx
│   │   ├── TutorialCard.tsx
│   │   └── ManualImage.tsx
│   ├── sessions/
│   │   ├── SessionPlannerForm.tsx
│   │   ├── WarmUpSection.tsx
│   │   ├── ExerciseSequence.tsx
│   │   ├── SessionFeedbackCard.tsx
│   │   └── SessionHistory.tsx
│   ├── hours/
│   │   ├── HourLogForm.tsx
│   │   ├── CalendarPicker.tsx
│   │   ├── HoursProgressPanel.tsx
│   │   └── HourLogTable.tsx
│   └── curriculum/
│       ├── DriveConnect.tsx
│       ├── FolderList.tsx
│       └── IngestionStatus.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # Browser client
│   │   ├── server.ts                # Server client
│   │   └── middleware.ts
│   ├── anthropic/
│   │   ├── client.ts                # Anthropic SDK instance
│   │   └── agents/
│   │       ├── coordinator.ts
│   │       ├── curriculum.ts
│   │       ├── examiner.ts
│   │       ├── cues.ts
│   │       ├── sessions.ts
│   │       ├── learn.ts
│   │       ├── weakspot.ts
│   │       └── readiness.ts
│   ├── google/
│   │   ├── auth.ts                  # OAuth flow
│   │   ├── drive.ts                 # File fetching
│   │   └── ingest.ts                # Vision processing + chunking
│   └── utils/
│       ├── hours.ts                 # Progress calculations
│       └── readiness.ts             # Score calculations
├── types/
│   └── index.ts                     # All shared TypeScript types
├── middleware.ts                     # Auth protection
├── .env.local
└── .env.example
```

---

## 5. Supabase Schema

Run these in order in the Supabase SQL editor.

### 5.1 Enable pgvector
```sql
create extension if not exists vector;
```

### 5.2 Users (extends Supabase Auth)
```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  exam_target_date date,
  created_at timestamptz default now()
);
```

### 5.3 Hour Logs
```sql
create table public.hour_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  category text not null,
  sub_type text not null,
  session_date date not null,
  duration_minutes integer not null,
  notes text,
  status text default 'logged',    -- 'logged' | 'scheduled' | 'complete'
  created_at timestamptz default now()
);
```

### 5.4 Quiz Sessions
```sql
create table public.quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  apparatus text not null,
  topic text,
  difficulty text not null,
  question_count integer not null,
  score_percent numeric,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table public.quiz_questions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.quiz_sessions(id) on delete cascade,
  question text not null,
  user_answer text,
  retry_answer text,
  correct_answer text,
  result text,    -- 'correct' | 'partial' | 'incorrect'
  feedback text,
  created_at timestamptz default now()
);
```

### 5.5 Session Plans
```sql
create table public.session_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  mode text not null,               -- 'plan' | 'log'
  session_type text not null,       -- 'teaching' | 'personal'
  apparatus text not null,
  client_level text,                -- null for personal practice
  warm_up jsonb not null,           -- array of { move_name, sets, reps }
  exercise_sequence jsonb not null, -- array of { exercise_name, sets, reps, notes }
  feedback jsonb,                   -- structured five-dimension feedback from agent
  linked_hour_log_id uuid references public.hour_logs(id),
  session_date date,
  status text default 'draft',      -- 'draft' | 'complete'
  created_at timestamptz default now()
);
```

### 5.6 Readiness Snapshots
```sql
create table public.readiness_snapshots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  overall_score numeric not null,
  curriculum_score numeric not null,
  quiz_score numeric not null,
  hours_score numeric not null,
  narrative text,
  recommendations jsonb,
  created_at timestamptz default now()
);
```

### 5.7 Curriculum Uploads
```sql
create table public.curriculum_uploads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  folder_name text not null,
  drive_folder_id text not null,
  file_count integer,
  status text default 'pending',    -- 'pending' | 'processing' | 'complete' | 'failed'
  last_ingested_at timestamptz,
  error_message text,
  created_at timestamptz default now()
);
```

### 5.8 Curriculum Chunks (pgvector)
```sql
create table public.curriculum_chunks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  upload_id uuid references public.curriculum_uploads(id) on delete cascade,
  folder_name text not null,
  file_name text not null,
  chunk_index integer not null,
  content text not null,
  content_type text,    -- 'text' | 'diagram' | 'handwritten'
  embedding vector(1536),
  created_at timestamptz default now()
);

create index on public.curriculum_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
```

### 5.9 Row Level Security
```sql
-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.hour_logs enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.session_plans enable row level security;
alter table public.readiness_snapshots enable row level security;
alter table public.curriculum_uploads enable row level security;
alter table public.curriculum_chunks enable row level security;

-- Users can only access their own data
create policy "Users access own data" on public.profiles
  for all using (auth.uid() = id);

create policy "Users access own hours" on public.hour_logs
  for all using (auth.uid() = user_id);

create policy "Users access own quizzes" on public.quiz_sessions
  for all using (auth.uid() = user_id);

create policy "Users access own questions" on public.quiz_questions
  for all using (
    session_id in (
      select id from public.quiz_sessions where user_id = auth.uid()
    )
  );

create policy "Users access own session plans" on public.session_plans
  for all using (auth.uid() = user_id);

create policy "Users access own readiness" on public.readiness_snapshots
  for all using (auth.uid() = user_id);

create policy "Users access own uploads" on public.curriculum_uploads
  for all using (auth.uid() = user_id);

create policy "Users access own chunks" on public.curriculum_chunks
  for all using (auth.uid() = user_id);
```

---

## 6. Agent Architecture — Technical Design

### 6.1 RAG Query Pattern
All study-facing agents follow this pattern:
1. Embed user query using Claude (or OpenAI ada-002 — Cursor decides)
2. Query pgvector for top 5 relevant chunks using cosine similarity
3. If chunks found — pass to agent with source context
4. If no chunks found — agent returns explicit "not in your materials" message
5. Never fall back to general knowledge

### 6.2 Coordinator Routing Logic
```
User input → Coordinator
  → Is this a study question? → Curriculum Agent
  → Is this a learn/tutorial request? → Learn Agent
  → Is this a quiz request? → Examiner Agent
  → Is this a cue to evaluate? → Cueing Feedback Agent
  → Is this a readiness request? → Readiness Synthesizer
  → Ambiguous? → Ask clarifying question
```

### 6.3 Agent System Prompt Pattern
Each agent receives:
- Its role and constraints
- Relevant RAG chunks as context
- User's current session state (apparatus focus, difficulty level)
- Hard rule: "If the answer is not present in the provided source material, say so explicitly."

---

## 7. Google Drive Ingestion — Technical Flow

1. User authenticates Google Drive via OAuth 2.0 (stored token in Supabase)
2. User selects folder in Curriculum Manager
3. App calls Drive API — lists all image files in folder
4. For each file:
   - Download image
   - Send to Claude vision with extraction prompt
   - Extract: printed text, diagram descriptions, handwritten annotations (flagged separately)
   - Chunk extracted content (500 tokens, 50 token overlap)
   - Generate embedding per chunk
   - Insert into `curriculum_chunks` with metadata
5. Update `curriculum_uploads` status on completion or failure
6. Display per-file status in Curriculum Manager

---

## 8. Hour Progress Calculations

### 8.1 Total Hours
```
total_logged = SUM(duration_minutes WHERE status IN ('logged', 'complete')) / 60
total_progress = total_logged / 536 * 100
```

### 8.2 Practical Targets
```
mat_practical = SUM(duration_minutes WHERE category LIKE 'Mat%' AND sub_type = 'Practical') / 60
reformer_practical = SUM(duration_minutes WHERE category LIKE 'Reformer%' AND sub_type = 'Practical') / 60
apparatus_practical = SUM(duration_minutes WHERE category IN ('Trapeze Cadillac', 'Chair', 'Barrels') AND sub_type = 'Practical') / 60
```

### 8.3 Scheduled Hours (not counted toward progress)
```
scheduled = SUM(duration_minutes WHERE status = 'scheduled') / 60
```
Displayed separately as "scheduled upcoming hours" — not included in progress bars until marked complete.

---

## 9. Readiness Score Calculation

```
curriculum_score = (unique folders queried / total folders ingested) * 100
quiz_score = AVG(score_percent) across last 10 quiz sessions
hours_score = (total_logged / 536) * 100

overall = (curriculum_score * 0.33) + (quiz_score * 0.34) + (hours_score * 0.33)
```

Readiness snapshot saved to Supabase after every quiz session completion and every hour log entry.

---

## 10. Tailwind Theme Configuration

Add to `tailwind.config.ts` (warm terracotta / whitewash identity — see Constitution §6):

```typescript
colors: {
  clara: {
    bg: '#F4EDE6',
    sidebar: '#D4C4B8',
    surface: '#EBE3D9',
    elevated: '#F7F1EA',
    muted: '#8A7268',
    ink: '#3D2E28',
    deep: '#4A352C',
    strong: '#5C2E24',
    border: '#C9B3A4',
    highlight: '#E5D5CA',
    primary: '#B8482E',
    accent: '#C45F3D',
    warm: '#A65D45',
  },
}
```

Shadows should use soft umber-tinted rgba, not cool gray.

---

## 11. Middleware — Auth Protection

All `/dashboard/*` routes require authenticated session. Unauthenticated users redirect to `/login`.

```typescript
// middleware.ts
export const config = {
  matcher: ['/dashboard/:path*', '/api/agents/:path*', '/api/hours/:path*', '/api/ingest/:path*']
}
```

---

## 12. External Services Setup Checklist

Before build starts, complete these:

- [ ] Create Supabase project — copy URL and keys to `.env.local`
- [ ] Enable pgvector extension in Supabase SQL editor
- [ ] Run all schema SQL in order (Sections 5.1–5.8)
- [ ] Create Google Cloud project — enable Drive API — create OAuth credentials
- [ ] Add Google redirect URI to OAuth config
- [ ] Create Google Drive folder structure (Section 4.1 of Specification)
- [ ] Create Vercel project — connect GitHub repo — add all env vars
- [ ] Verify Anthropic API key has sufficient credits

---

## 13. Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Manual image quality too low for vision extraction | Medium | Test one folder before full ingestion; re-photograph if needed |
| pgvector embedding costs at scale | Low | 536 hours of materials is manageable; monitor usage |
| Google Drive OAuth token expiry | Medium | Implement token refresh; surface re-auth prompt clearly |
| RAG retrieval misses relevant chunks | Medium | Tune chunk size and overlap after first test queries |
| Readiness score feels arbitrary without exam date | Low | Document as known Phase 1 limitation; Phase 2 adds countdown |

---

*Clara — Planning version 1.0 — ready for Task Setting*
