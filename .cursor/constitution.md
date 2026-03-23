# Constitution: Clara
*Balanced Body Comprehensive Certification Study System — Personal Project*

---

## 1. Project Identity

**Project Name:** Clara
**App Name:** Clara
**Owner:** SRuss (personal project — not a Lumenalta product)  
**Purpose:** A web-based, AI-powered study companion for preparing for the Balanced Body Comprehensive Pilates certification exam. The tool supports curriculum study, written cueing practice, quiz-style examination, hour tracking, and readiness assessment.

---

## 2. Core Principles

These principles govern every architectural and design decision made during the build.

### 2.1 Never Invent Information
The Curriculum Agent, Examiner Agent, and all study-facing agents must reason **exclusively over uploaded source materials**. If the answer to a question cannot be found in the RAG layer (uploaded manuals, homework images, course documents), the agent must explicitly say so. Hallucinated contraindications, spring settings, or anatomical claims are a direct threat to exam integrity. No inference beyond source material is permitted.

### 2.2 Explicit Over Silent
When something fails — an upload, an agent call, a database write — the user sees a clear, specific error message. No silent degradation. No generic spinners that never resolve. The user always knows what broke and, where possible, what to do about it.

### 2.3 Study Fidelity Over Speed
Response quality matters more than response time. Agents should take the time to reason carefully over source material rather than produce fast, shallow answers. This is exam preparation — accuracy is the metric.

### 2.4 Honest Uncertainty
When the system is uncertain — partial source coverage, ambiguous material, conflicting notes across uploads — it says so explicitly and indicates the confidence level of its response. The user must always be able to distinguish confident answers from inferred ones.

### 2.5 Progressive Trust
The tool earns trust through consistent accuracy. Features that risk introducing inaccuracy (such as reasoning beyond uploaded materials) are never enabled, regardless of convenience.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Consistent with existing builds |
| Language | TypeScript (relaxed) | No strict mode required |
| Styling | Tailwind CSS | No component library; custom components only |
| AI Layer | Claude API via Anthropic SDK | claude-sonnet-4-20250514 |
| Database | Supabase (PostgreSQL) | Auth, hour logs, quiz history, readiness scores |
| Auth | Supabase Auth | Simple login Phase 1; hardened multi-user Phase 2 |
| Vector Store | Supabase pgvector | RAG embeddings from uploaded curriculum materials |
| File Ingestion | Google Drive API | Manual pages uploaded to Drive, ingested on demand |
| Deployment | Vercel | Web app, accessible on mobile browser |
| IDE | Cursor | Claude as AI layer |

---

## 4. Agent Architecture

### 4.1 Coordinator
Receives user queries and routes them to the appropriate specialist agent. Never answers directly — orchestrates only.

### 4.2 Curriculum Agent
Answers study questions about apparatus, anatomy, movement principles, and sequencing. Reasons exclusively over RAG layer. Returns source reference when possible (e.g., "Based on your Reformer manual, page section X...").

### 4.3 Examiner Agent
Generates exam-style questions (written format, Phase 1). Evaluates written answers against source material criteria. Does not give partial credit for vague answers — pushes for precision, consistent with exam standards. Covers: anatomy, cueing, starting position, precautions, spring settings, sequencing. **Anatomy diagram** (`anatomy_diagram`) questions use a fixed interactive body diagram (front/back) with canonical muscle group regions; the model must choose `target_muscle` only from that list while the question text stays grounded in RAG and must not name the answer. The learner selects a region and types the muscle group (active recall); the Examiner grades the typed response with Claude (exact names, synonyms, and reasonable partial matches).

### 4.4 Cueing Feedback Agent
Evaluates written cues submitted by the user against Balanced Body criteria: anatomical accuracy, breath cuing, starting position clarity, precaution language, client accessibility. Returns structured feedback: what landed, what was vague, what was missing. **Shipped** in the **Practice Cues** screen (`/cues`) as a full primary nav item alongside Study, Quiz, and Sessions. **Phase 2 (optional):** add OpenAI Whisper so the user can speak a cue before evaluation — the written flow remains the default.

### 4.5 Hour Tracking Agent
Logs and retrieves practice hours by category: Mat, Reformer, Apparatus. Calculates progress against Balanced Body requirements (requirements entered by user when available). Surfaces gaps and remaining hours per category.

### 4.6 Weak Spot Agent
Analyzes quiz history over time. Surfaces patterns — not just missed questions but recurring gaps by topic, apparatus, or knowledge domain. Routes identified weak spots back to the Curriculum Agent for targeted review sessions.

### 4.7 Session Planner Agent
Accepts a planned or completed session — pre-Pilates warm-up (pelvic floor engagement, breathing, stretching) plus full exercise sequence with sets, reps, and apparatus — and evaluates it against Balanced Body methodology. Assesses progression logic, contraindication risk, volume appropriateness (standard 8-12 rep range), muscle group balance, and sequence alignment with Balanced Body curriculum. Supports both planning mode (feedback before teaching/practicing) and logging mode (record what was actually done, feeds hour tracking). Reasons exclusively over uploaded source materials.

### 4.8 Learn Agent
Accepts apparatus + either a specific exercise name OR a body part/muscle group. Searches the RAG layer for relevant curriculum chunks and manual page images. Structures tutorial content from source material only — one exercise at a time covering **program level** and **recommended rep range** when the manual header states them (e.g. Intermediate • 4-6 REPS), plus starting position, movement description, breath cues, spring settings, and precautions. Never invents information not present in uploaded materials. Phase 2 adds audio narration via Whisper.

### 4.9 Readiness Synthesizer Agent
Produces a readiness score anchored to three dimensions: curriculum coverage (% of uploaded material queried and demonstrated), quiz performance (rolling accuracy score by domain), and hour completion (% of required hours logged). Generates a plain-language readiness brief with recommended next study actions.

---

## 5. Data Architecture

### 5.1 RAG Layer
- Source: Google Drive folder of photographed manual pages and uploaded course documents
- Ingestion: Claude vision processes images → text extracted → chunked → embedded via Supabase pgvector. PDFs use text extraction with **orientation-aware page assembly** (correcting common upside-down or scrambled reading order before tagging). Structured tags in stored text include **EXERCISE**, **LEVEL**, **REPS**, and section labels so agents can teach and quiz from header metadata.
- Ingestion is a manual trigger (user initiates when new material is added)
- All queries from study-facing agents search this vector store first

### 5.2 Supabase Tables (Core)
- `users` — auth, profile, exam target date (nullable)
- `hour_logs` — category, duration, date, notes, status
- `quiz_sessions` — agent, questions, answers, scores, timestamps
- `session_plans` — mode, apparatus, warm-up moves, exercise sequence, sets, reps, feedback, linked hour log
- `readiness_scores` — snapshot scores by dimension, date
- `curriculum_uploads` — file metadata, ingestion status, Drive reference

### 5.3 No PII Beyond Auth
No client data, no Lumenalta data, no third-party information of any kind touches this system.

---

## 6. Visual Identity

Clara’s UI is **Red Rocks — earthy brutalist**: warm sand and stone neutrals, **umber brown** structure, **terracotta** accent (`accent`), and a deeper **rock** red-brown for secondary emphasis (e.g. destructive actions, “info” badges). Surfaces are **flat** — no drop shadows; structure comes from **1px borders** in `highlight` and generous spacing. Nothing clinical or neon.

### 6.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| Background (`bg`) | `#E8E0D5` | Page canvas |
| Surface | `#DDD5C8` | Cards, panels, sidebar |
| Highlight | `#C9BFB0` | Borders, hovers, selected rows, active nav background |
| Accent | `#C4522A` | Links, CTAs, active nav text, wordmark “Clara”, progress fill, loading spinner ring |
| Primary | `#5C4A32` | Primary buttons (with white text), positive badges |
| Strong | `#3D3128` | Headings, strong labels, wordmark “SR” |
| Deep | `#1C1610` | Body copy |
| Muted | `#8A7F74` | Captions, metadata, secondary lines |
| Rock | `#A63D1F` | Destructive / strong warning emphasis, secondary accent (e.g. focus outlines on destructive controls) |

### 6.2 Typography
- **Font:** Inter (web; substitute for FK Grotesk)
- **Headings:** Bold, `text-clara-strong`
- **Body:** Regular, `text-clara-deep`
- **Captions / metadata:** `text-clara-muted`
- **Wordmark:** **SR** — Inter Black (`font-black`), `text-clara-strong`; **Clara** — Inter Light (`font-light`), `text-clara-accent`

### 6.3 Aesthetic Principles
- **Flat architecture** — cards and buttons use **no shadow**; `rounded-sm` at most; cards use `border border-clara-highlight` on `bg-clara-surface`
- **Primary buttons:** `bg-clara-primary`, white text, hover `bg-clara-accent`
- **Progress bars:** track `bg-clara-highlight`, fill `bg-clara-accent`
- **Sidebar:** `bg-clara-surface`, `border-r border-clara-highlight`; active item `bg-clara-highlight` + `text-clara-accent`
- Generous whitespace; calm layouts
- No dark mode (Phase 1)

### 6.4 Voice
- Direct and precise — no filler language
- Honest about uncertainty — the tool models the same intellectual rigor expected in the exam
- Encouraging without being hollow — feedback acknowledges effort without softening accuracy gaps

---

## 7. Phase Boundaries

### Phase 1 — Build Now
- Google Drive ingestion pipeline + RAG layer
- Curriculum Agent (written Q&A over uploaded materials)
- Examiner Agent (written quiz mode)
- Cueing Feedback Agent (written cue submission + evaluation)
- Learn Agent (tutorial mode — exercise-by-exercise from RAG)
- Hour Tracker (log, view, gap analysis by category)
- Readiness Score dashboard
- Weak Spot analysis
- Supabase auth (single user, multi-user ready)
- Vercel deployment

### Phase 2 — Document Now, Build Later
- Microphone cueing via OpenAI Whisper (mic → transcription → same Cueing Feedback Agent) — **additive** to the existing written Practice Cues flow
- Learn screen audio narration via Whisper
- Exam date countdown layer on Readiness Score
- Hour requirement targets (once Balanced Body breakdown is confirmed)
- Multi-user access with individual progress tracking

---

## 8. Constraints & Non-Negotiables

- Agents never reason beyond uploaded source material
- No external Pilates databases, third-party content APIs, or general web knowledge used as curriculum source
- Explicit error messages always — no silent failures
- Auth required from day one — no anonymous access
- All uploaded content remains private to the authenticated user
- No ads, no analytics, no third-party tracking

---

*Clara — Constitution version 1.0 — ready for Specification phase*
