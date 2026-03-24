# Specification: Clara
*Balanced Body Comprehensive Certification Study System — Version 1.0 — Phase 1*

---

## 1. Overview

A personal web application that serves as the complete study and certification tracking system for the Balanced Body Comprehensive Pilates exam. The system ingests uploaded curriculum materials from Google Drive, provides AI-powered study, quiz, and cueing feedback experiences, tracks hours against certification requirements, and synthesizes a readiness score across all dimensions.

### 1.1 Visual identity

The product UI follows **Constitution §6 — Visual Identity**: warm plaster page (`#F5F1E8`), light surfaces, **grove green** primary (`#5F6F52`), **terracotta** accent (`#C2782E`) for headings and top bar title, **sea** teal for prose links, warm charcoal text (`#2C2824`) for body. Typography: Inter for UI, Fraunces for headings and wordmark “Clara”. Implementation uses Tailwind `clara-*` tokens in **Planning §10** and `tailwind.config.ts`.

---

## 2. User Roles

| Role | Access | Notes |
|---|---|---|
| Admin (SRuss) | Full access — all features, ingestion control, settings | Single user Phase 1 |
| Trainee | Study, quiz, cueing, hour tracking, readiness | Multi-user ready Phase 2 |

Auth is required from first load. No anonymous access.

---

## 3. Hour Tracking Specification

### 3.1 Total Requirement
**536 hours** across all categories.

### 3.2 Category Breakdown

| Category | Type | Practical Target |
|---|---|---|
| Anatomy | Theory | — |
| Movement Principles | Theory | — |
| Mat 1 | Theory + Practical | — |
| Mat 2 | Theory + Practical | — |
| Mat 3 | Theory + Practical | — |
| Reformer 1 | Theory + Practical | — |
| Reformer 2 | Theory + Practical | — |
| Reformer 3 | Theory + Practical | — |
| Trapeze / Cadillac | Theory + Practical | — |
| Chair | Theory + Practical | — |
| Barrels | Theory + Practical | — |

### 3.3 Practical Hour Targets
| Practical Category | Required Hours |
|---|---|
| Mat (practical) | 70 hours |
| Reformer (practical) | 150 hours |
| Apparatus (practical) | 150 hours |
| **Total Practical** | **370 hours** |

### 3.4 Hour Log Entry Fields
- Category (dropdown — all categories above)
- Sub-type: Theory / Practical / Observation / Teaching
- Date — calendar picker supporting:
  - **Past dates** — retroactive entry for hours already completed (scrollable calendar, no restriction on how far back)
  - **Future dates** — schedule planned sessions in advance, marked as "Scheduled"
  - **Mark Complete** — scheduled sessions can be marked complete on or after the scheduled date
- Duration (hours + minutes)
- Notes (optional, free text)

### 3.5 Hour Log Status
- **Logged** — completed session entered for past date
- **Scheduled** — future session entered, not yet complete
- **Complete** — scheduled session marked complete on/after the date

### 3.5 Hour Tracking Display
- Total hours logged vs. 536 requirement — progress bar
- Practical breakdown: Mat / Reformer / Apparatus vs. targets — three individual progress bars
- Category-level breakdown — expandable table showing hours per category
- Gap summary — plain language: "You need 42 more Reformer practical hours"
- All visible on the Hour Tracking dashboard

---

## 4. Curriculum & RAG Layer Specification

### 4.1 Google Drive Folder Structure (User Maintains)
```
/Balanced Body Exam/
  /Anatomy/
  /Movement Principles/
  /Mat 1/
  /Mat 2/
  /Mat 3/
  /Reformer 1/
  /Reformer 2/
  /Reformer 3/
  /Trapeze Cadillac/
  /Chair/
  /Barrels/
  /Homework/
```

### 4.2 Ingestion Flow
1. User connects Google Drive account (OAuth, one-time setup)
2. User selects folder(s) to ingest from the app
3. App pulls files from selected folders via Google Drive API (images and PDFs)
4. **Images** — Claude vision extraction:
   - Printed text and diagrams (standard extraction)
   - **Orientation:** transcribe as if the page were upright when the photo/scan is rotated (including upside down)
   - Anatomical illustrations (described and indexed)
   - Handwritten notes (extracted as supplementary annotations, flagged as handwritten)
5. **PDFs** — text is extracted with **orientation-aware per-page layout** (compares reading-order candidates and prefers the layout that best matches readable manual Latin text, mitigating upside-down pages and odd stream order). A Claude pass then inserts structured exercise tags into the stored text.
6. **Balanced Body exercise header model** (manual layout to preserve in tags and chunks):
   - **Title line:** large ALL CAPS exercise name (e.g. SWAN DIVE, SHORT BOX ABDOMINAL SERIES).
   - **Metadata line:** immediately below — program level, middle dot (•), rep range, matching `(BEGINNER|INTERMEDIATE|ADVANCED) • N-N REPS` (e.g. `INTERMEDIATE • 4-6 REPS`). Section headers (e.g. STARTING POSITION) are ALL CAPS but are **not** followed by this line — they are not exercise titles.
   - **App behavior:** Exercise lists (Learn, Practice Cues, Session Planner suggestions) infer names from that two-line pattern plus `**EXERCISE:**` / bold / numbered list fallbacks; names are shown in **Title Case**. The level/reps line is stripped from text sent to agents and from tutorial body fields where redundant; **Learn** shows program level + reps as a **badge** under the title (not raw ALL CAPS).
   - Ingestion prompts map headers into inline tags: `**EXERCISE: [name]**`, `**LEVEL: [...]**`, `**REPS: [...]**` (plus PURPOSE, STARTING POSITION, MOVEMENT, etc. when present). This metadata supports **Learn** tutorials and **Examiner** questions about level and reps.
7. Extracted content is chunked by topic/exercise
8. Chunks are embedded and stored in Supabase pgvector with metadata:
   - Source folder (maps to curriculum category)
   - File name
   - Ingestion date
   - Chunk index
9. Ingestion status displayed per folder — pending / processing / complete / failed
10. User can re-ingest a folder when new material is added
11. Explicit error message if any file fails processing

### 4.3 Source Integrity Rule
All study-facing agents query the pgvector store first. If relevant content is not found, the agent responds: *"I couldn't find this in your uploaded materials. Consider adding relevant pages from your [Category] manual."* No external knowledge used as substitute.

### 4.4 Quiz Weighting
- **Mat and Reformer:** 60% of generated quiz questions
- **Cadillac, Chair, Barrels, Anatomy, Movement Principles:** 40% distributed evenly
- Weighting adjusts dynamically based on Weak Spot Agent findings

---

## 5. Agent Interaction Specifications

### 5.1 Coordinator Agent
- Entry point for all study interactions
- Receives user query + session context
- Routes to appropriate specialist agent
- Never answers directly
- Returns coordinator decision to UI before specialist agent responds (visible routing — user sees "Routing to Examiner Agent...")

### 5.2 Curriculum Agent
**Trigger:** User asks a study question in free text  
**Input:** User question + relevant chunks from pgvector  
**Output:**
- Direct answer grounded in source material
- Source reference: "Based on your Mat 2 materials..."
- Confidence indicator: Confident / Partial / Not Found
- If Not Found: explicit message + folder suggestion

**Example interactions:**
- "What are the contraindications for the Hundred?"
- "What spring setting does Balanced Body recommend for Footwork on the Reformer?"
- "Explain the movement principles behind spinal articulation"

### 5.3 Examiner Agent
**Trigger:** User enters Quiz Mode  
**Input:** Selected apparatus/topic + difficulty level (Foundational / Intermediate / Exam-Ready)  
**Output per question:**
- Question (written, exam-style)
- After user submits answer: scored evaluation with explanation
- Correct / Partially Correct / Incorrect
- Explanation grounded in source material
- Follow-up question if answer is vague or imprecise

**Question types covered:**
- Anatomy identification
- Starting position description
- Cueing language
- Contraindications and precautions
- Spring settings
- Exercise sequencing

**Quiz length:** User selects 10, 15, or 20 questions before session starts.

**Behavior:** Does not accept vague answers. User gets one retry per question. If second answer is still insufficient, correct response is revealed with full explanation grounded in source material.

**Quiz session summary:** Score by topic, time taken, questions missed — saved to Supabase on session end.

### 5.4 Cueing Feedback Agent
**Trigger:** User submits a written cue on the **Practice Cues** screen (`/cues`)  
**Input:** Written cue + exercise context (apparatus, exercise name, client level)  
**Output — structured feedback:**
- **Anatomical Accuracy:** correct / needs refinement + note
- **Starting Position Clarity:** clear / missing elements + note
- **Breath Cue:** present / absent / incorrect
- **Precaution Language:** appropriate / missing / incorrect
- **Client Accessibility:** appropriate for stated level / needs adjustment
- **Overall:** 1-2 sentence synthesis
- **Suggested refinement:** "Here is a better version" — rewritten cue grounded in source material, presented authoritatively

### 5.5 Session Planner Agent
**Trigger:** User submits a planned or completed session routine  
**Modes:**
- **Plan Mode** — user builds a routine before teaching or practicing; receives feedback before the session
- **Log Mode** — user records what was actually done; session can be linked to an hour log entry

**Input:**
- Mode (plan / log)
- Session type: Teaching / Personal Practice
- Apparatus
- Client level (if teaching): Beginner / Intermediate / Advanced
- Warm-up section: pre-Pilates moves selected from Balanced Body warm-up repertoire (pelvic floor engagement, breathing, stretching, imprint, pelvic clock, etc.) — each with sets and reps
- Exercise sequence: ordered list of exercises, each with sets and reps (standard reference: 8-12 reps)
- Optional notes

**Output — structured feedback across five dimensions:**
- **Progression Logic:** Is the warm-up → main sequence → closing arc sound? Flags abrupt transitions or missing preparation
- **Contraindication Flags:** Any exercises that warrant precaution for the stated client level — grounded in source material
- **Volume Assessment:** Are sets and reps appropriate for the apparatus and client level? Flags deviation from 8-12 rep standard with explanation
- **Muscle Group Balance:** Are anterior/posterior, flexion/extension, and lateral patterns represented? Surfaces notable gaps
- **Balanced Body Sequence Alignment:** Does the sequence follow Balanced Body methodology and progression principles from uploaded curriculum?
- **Overall:** 2-3 sentence synthesis
- **Suggested adjustments:** Specific recommended changes with rationale

**Log Mode additions:**
- Option to mark session as complete and link to an hour log entry (auto-populates category, date, duration)
- Completed sessions saved to Supabase and visible in session history

### 5.6 Learn Agent
**Trigger:** User opens Learn screen and selects apparatus + exercise or body part/muscle group  
**Input:**
- Apparatus (Mat, Reformer, Cadillac, Chair, Barrels)
- Either: specific exercise name (e.g., "The Hundred") OR body part/muscle group (e.g., "hip flexors", "core")

**Output — structured tutorial, one exercise at a time:**
- Exercise **title in Title Case**; program level and rep range as a compact **badge** (not duplicated inside body sections)
- Starting position description
- Movement description
- Breath cues
- Spring settings (if applicable)
- Precautions and contraindications
- Manual page image from Google Drive displayed alongside text

**Behavior:**
- Searches pgvector for relevant curriculum chunks and manual page images
- Structures content exclusively from source material — never invents
- Presents exercises in sequence — "Next" advances, "Previous" goes back
- Progress indicator: "Exercise 2 of 6"
- Phase 2: audio narration via Whisper

### 5.7 Hour Tracking Agent
**Trigger:** User logs hours or requests hour summary  
**Input:** Log entry fields or summary request  
**Output:**
- Confirmation of logged entry
- Updated progress toward targets
- Plain-language gap summary when requested
- Flag if a category is significantly behind overall pace

### 5.8 Weak Spot Agent
**Trigger:** Automatic — runs analysis after every 5 completed quiz sessions  
**Input:** Full quiz history from Supabase  
**Output:**
- Top 3 recurring weak areas (by topic, apparatus, or knowledge domain)
- Pattern narrative: "You consistently miss questions about contraindications on the Cadillac"
- Recommended study action routed to Curriculum Agent
- Weak spot summary card visible on dashboard — updates after each analysis run

### 5.9 Readiness Synthesizer Agent
**Trigger:** User opens Readiness dashboard or requests a readiness check  
**Input:** Quiz performance history + hour log totals + curriculum coverage metrics  
**Output — three-dimension score:**

| Dimension | Metric | Weight |
|---|---|---|
| Curriculum Coverage | % of uploaded material queried and demonstrated | 33% |
| Quiz Performance | Rolling accuracy score across all domains | 34% |
| Hour Completion | % of 536 total hours + practical targets logged | 33% |

- Overall readiness score: 0–100%
- Dimension breakdown with individual scores
- Plain-language brief: what's strong, what needs attention
- Top 3 recommended next actions
- Score snapshot saved to Supabase with timestamp (tracks improvement over time)

---

## 6. Screen Specifications

### 6.1 Authentication
- Login screen — email + password via Supabase Auth
- No public registration (admin creates accounts)
- Persistent session

### 6.2 Dashboard (Home)
- Readiness Score — prominent, center — overall % with three dimension indicators
- Hours Summary — total logged vs. 536, three practical progress bars
- Weak Spot Card — #1 priority weak area only + recommended action
- Quick Actions — Study, Quiz, Practice Cues, Plan Session, Log Hours
- Recent Activity — last 5 sessions (quiz, planned, or logged)

### 6.3 Study Screen
- Free-text input field
- Apparatus/topic filter (optional — narrows RAG search)
- Response card — answer + source reference + confidence indicator
- Conversation thread — maintains context within session
- Session history accessible (not persistent across sessions Phase 1)

### 6.4 Quiz Screen
- Topic selector — apparatus + category + difficulty
- Question card — one question at a time
- Answer input — free text, multiple choice, matching, or **anatomy diagram** (pin-the-muscle on an SVG front/back figure with fixed muscle regions)
- Submit → evaluation response appears below
- Next question button
- Session progress indicator (Question 3 of 10)
- Exit saves session to Supabase

### 6.5 Cueing Practice Screen (Practice Cues — shipped)
- **Navigation:** Same prominence as Study, Quiz, Sessions — no “Phase 2” badge, no deferred/greyed styling
- Optional collapsible panel: what verbal cues are, why they matter, how Clara’s feedback dimensions map to exam-ready teaching; link to Learn for manual-deep tutorials
- Exercise selector — apparatus + **exercise name (dropdown)** populated from ingested materials (same source as Learn exercise list)
- Client level selector — Beginner / Intermediate / Advanced
- Cue input — free text area
- Submit → structured feedback card appears
- History of submitted cues + feedback in this session
- **Phase 2 (out of scope until built):** optional audio capture via Whisper before evaluation

### 6.6 Learn Screen
- Route: `/learn`
- Nav position: between Sessions and Hours
- Apparatus selector — Mat, Reformer, Cadillac, Chair, Barrels
- Search mode: specific exercise name (free text) OR body part/muscle group (free text)
- Tutorial format — one exercise at a time:
  - Starting position
  - Movement description
  - Breath cues
  - Spring settings
  - Precautions
- Manual page image from Google Drive displayed alongside text
- "Next" button — advances to next exercise in sequence
- "Previous" button — goes back
- Progress indicator: "Exercise 2 of 6"
- Phase 2: audio narration via Whisper

### 6.7 Hour Tracking Screen
- Log entry form — category, sub-type, date, duration, notes
- Total progress bar — hours logged vs. 536
- Practical targets section — Mat / Reformer / Apparatus progress bars
- Category breakdown table — expandable rows
- Gap summary — plain language

### 6.8 Session Planner Screen
- Mode toggle at top: Plan / Log
- Session type selector: Teaching / Personal Practice
- Apparatus selector
- Client level selector (visible when Teaching mode): Beginner / Intermediate / Advanced

**Warm-Up section:**
- Labeled "Pre-Pilates Warm-Up"
- Add warm-up move button — searchable list populated from Balanced Body warm-up repertoire (ingested from uploaded materials)
- Each move row: move name, sets input, reps input, remove button
- Reorderable rows (drag or up/down arrows)

**Exercise Sequence section:**
- Labeled "Main Sequence"
- Add exercise button — searchable by apparatus and exercise name (from ingested materials)
- Each exercise row: exercise name, sets input, reps input, notes (optional), remove button
- Reorderable rows
- Rep range reference visible: "(Standard: 8–12 reps)"

**Actions:**
- "Get Feedback" button — submits routine to Session Planner Agent, returns structured feedback
- In Log Mode: "Save & Link to Hours" button — marks session complete and auto-populates hour log entry form with category, date, duration

**Feedback Panel (appears after submission):**
- Five dimension rows — each with label, status Badge (positive / caution / critical variants using the warm palette), and note
- Overall synthesis (2-3 sentences)
- Suggested adjustments section — specific, numbered recommendations
- "Revise Routine" button — returns to edit mode with current routine intact

**Session History (below main form):**
- List of saved sessions (Log Mode only)
- Each entry: date, apparatus, session type, overall feedback summary
- Click to view full session and feedback

### 6.9 Curriculum Manager Screen (Admin only)
- Google Drive connection status
- Folder list — each folder with ingestion status + last ingested date
- Ingest / Re-ingest button per folder
- Processing log — file-level status
- Error display — explicit message per failed file

### 6.10 Settings Screen
- **Profile:** editable display name (`profiles.full_name`); email read-only from Supabase Auth; Save with success/error feedback
- **Exam target date:** optional date (`profiles.exam_target_date`); helper copy that countdown is a future update; Save with feedback
- **Hour targets:** Mat / Reformer / Apparatus / Total practical targets (defaults 70 / 150 / 150 / 536) saved to `profiles.hour_targets` (jsonb); Save with feedback; Hours dashboard uses these values when set
- **Sign out** at bottom of page
- No `<form>` wrappers — buttons use `onClick` + `fetch` to `GET`/`PATCH` `/api/profile`

---

## 7. Data Persistence

| Data | Storage | Notes |
|---|---|---|
| User auth | Supabase Auth | |
| Hour logs | Supabase PostgreSQL | Append-only |
| Quiz sessions | Supabase PostgreSQL | Full Q&A + scores |
| Session plans | Supabase PostgreSQL | Routine, feedback, mode, linked hour log |
| Readiness snapshots | Supabase PostgreSQL | Timestamped |
| Curriculum embeddings | Supabase pgvector | Re-indexed on re-ingest |
| Upload metadata | Supabase PostgreSQL | Folder, file, status, date |

---

## 8. Error Handling

All errors surface as explicit, specific messages. No silent failures.

| Scenario | Message |
|---|---|
| Google Drive connection fails | "Unable to connect to Google Drive. Check your connection and try again." |
| File ingestion fails | "Failed to process [filename]. Check the file is a clear image and retry." |
| Agent returns no source match | "I couldn't find this in your uploaded materials. Consider adding pages from your [Category] folder." |
| Supabase write fails | "Your [hour log / quiz session] could not be saved. Please try again." |
| Claude API error | "Study assistant is temporarily unavailable. Please try again in a moment." |

---

## 9. Out of Scope — Phase 1

The following are documented for Phase 2 and must not be built until explicitly scheduled:

- **Microphone / Whisper cueing** — optional spoken cue → transcription → Cueing Feedback Agent (**written** Practice Cues at `/cues` is implemented and not deferred)
- Exam date countdown on readiness score
- Multi-user access and individual progress tracking
- Dark mode
- Mobile-native layout (mobile browser access via Vercel is acceptable)
- Sharing or exporting study sessions

---

## 10. Success Criteria — Phase 1

The build is complete when:

- [ ] User can log in and access all screens
- [ ] Google Drive folders can be connected and ingested
- [ ] Curriculum Agent answers study questions grounded in uploaded materials
- [ ] Examiner Agent generates and evaluates quiz sessions
- [ ] Cueing Feedback Agent evaluates written cues with structured output
- [ ] Session Planner accepts warm-up + sequence with sets/reps and returns structured feedback
- [ ] Log Mode sessions link to hour log entries correctly
- [ ] Learn screen presents exercise tutorials from RAG (apparatus + exercise or body part)
- [ ] Hours can be logged and tracked against all targets
- [ ] Weak Spot Agent surfaces patterns after 5+ quiz sessions
- [ ] Readiness Score updates after each quiz session and hour log
- [ ] All errors display explicit messages
- [ ] App is deployed and accessible on Vercel

---

*Clara — Specification version 1.0 — ready for Clarification phase*
