# Task 3.1 — Schema Verification Steps

## 1. Run SQL in Supabase SQL Editor

Apply migrations in order under `supabase/migrations/`, including at minimum:

- `20240314000000_task_3_1_schema.sql` — `profiles.google_access_token`, `google_refresh_token`; `check_curriculum_schema()` helper
- `20260324200000_profiles_google_token_expiry.sql` — `profiles.google_token_expiry` (timestamptz) for OAuth refresh
- `20260325120000_rls_core_tables.sql` — RLS on `profiles`, `hour_logs`, `session_plans`, `curriculum_*`, `quiz_*`, `readiness_snapshots`
- `20260325121000_curriculum_chunks_embedding_ivfflat.sql` — `ivfflat` index on `curriculum_chunks.embedding` (optional but recommended for scale)

## 2. Verify via API (while logged in)

```bash
curl -b "your-session-cookies" http://localhost:3000/api/admin/schema-check
```

Expected response:

```json
{
  "success": true,
  "embedding_column": { "column_name": "embedding", "udt_name": "vector" },
  "indexes": ["curriculum_chunks_embedding_idx", ...],
  "checks": { "pgvector_enabled": true, "ivfflat_exists": true }
}
```

## 3. Remove Temporary Route

After verification, delete:

- `app/api/admin/schema-check/route.ts`

Optionally drop the DB function in Supabase:

```sql
DROP FUNCTION IF EXISTS public.check_curriculum_schema();
```
