# Task 3.1 — Schema Verification Steps

## 1. Run SQL in Supabase SQL Editor

Execute the contents of `migrations/20240314000000_task_3_1_schema.sql`:

- Adds `google_access_token` and `google_refresh_token` to `profiles`
- Creates `check_curriculum_schema()` function for verification

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
