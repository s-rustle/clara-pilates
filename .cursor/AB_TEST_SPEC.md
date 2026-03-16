# AB Test Suite — Paste Into Cursor

---

Paste the block below into Cursor as a separate task (not combined with Learn feature):

---

@CONSTITUTION.md @SPECIFICATION.md @PLANNING.md @TASK_SETTING.md

Add an AB test suite to Clara. Write tests for the following:

1. **Hour log POST** — creates a record correctly
2. **Hour log GET** — returns only the authenticated user's records
3. **Hour log PATCH** — correctly updates status
4. **Progress calculations** in `/lib/utils/hours.ts` — return correct values for known inputs
5. **Readiness score calculation** — returns correct weighted average (`(curriculum * 0.33) + (quiz * 0.34) + (hours * 0.33)`)
6. **Curriculum Agent** — returns "not found" message when no RAG chunks match
7. **Examiner Agent** — generates a question and evaluates a correct answer correctly
8. **Session Planner Agent** — returns structured five-dimension feedback

Use whatever test framework is already configured in the project (Jest or Vitest). If neither is configured, add **Vitest** as it is the standard for Next.js 14+ projects.

Write the tests in a `/tests` folder. Each test file should mirror the file it tests:
- `tests/api/hours.test.ts` — tests for `/app/api/hours/route.ts`
- `tests/lib/utils/hours.test.ts` — tests for `/lib/utils/hours.ts`
- `tests/lib/utils/readiness.test.ts` — tests for `/lib/utils/readiness.ts`
- `tests/lib/anthropic/agents/curriculum.test.ts` — Curriculum Agent
- `tests/lib/anthropic/agents/examiner.test.ts` — Examiner Agent
- `tests/lib/anthropic/agents/sessions.test.ts` — Session Planner Agent

For API route tests, use `fetch` or a test HTTP client to call the route handlers. For Supabase-dependent tests, use a mocked Supabase client or integration test approach as appropriate. For agent tests that call Claude, use mocked Anthropic client or fixture responses to avoid API costs and flakiness.

---
