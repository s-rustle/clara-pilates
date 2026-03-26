/**
 * One-off RAG smoke test. Requires OPENAI_API_KEY and Supabase service env vars
 * (same as the app). Set TEST_RAG_USER_ID to the UUID that owns curriculum_chunks.
 *
 * Run: npx ts-node scripts/test-rag.ts
 *
 * ts-node cannot resolve `@/` in lib/anthropic/rag.ts; unless you already run under tsx,
 * this script re-runs via `node --import tsx` when tsx is installed, else `npx -y tsx`
 * (nested npx can be slow on first run).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

function resolveLocalTsxImport(): string | null {
  try {
    return require.resolve("tsx");
  } catch {
    return null;
  }
}

const QUERIES = [
  "What are the key cues for footwork on the reformer?",
  "Describe the purpose of the short spine stretch",
  "What muscles are targeted in the hundred?",
] as const;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return v.trim();
}

async function runQueries() {
  const { queryRAG } = await import("../lib/anthropic/rag.ts");
  const userId = requireEnv("TEST_RAG_USER_ID");

  for (const query of QUERIES) {
    console.log("\n========== QUERY ==========");
    console.log(query);
    console.log("===========================\n");

    const { chunks, notFound } = await queryRAG(query, userId, null, {
      matchCount: 3,
      minSimilarity: 0,
    });

    if (notFound || chunks.length === 0) {
      console.log("(no chunks returned)\n");
      continue;
    }

    const top = chunks.slice(0, 3);
    top.forEach((c, i) => {
      console.log(`--- chunk ${i + 1} ---`);
      console.log("file_name:", c.file_name);
      console.log("similarity:", c.similarity);
      console.log("content:\n", c.content);
      console.log();
    });
  }
}

function canRunQueriesInThisProcess(): boolean {
  if (process.env.TEST_RAG_INNER === "1") return true;
  const runner = process.argv[1] ?? "";
  if (runner.includes("tsx")) return true;
  if (process.execArgv.join("\0").includes("tsx")) return true;
  return false;
}

async function main() {
  if (!canRunQueriesInThisProcess()) {
    const selfPath = fileURLToPath(import.meta.url);
    const tsxEsm = resolveLocalTsxImport();
    const result = tsxEsm
      ? spawnSync(process.execPath, ["--import", tsxEsm, selfPath], {
          stdio: "inherit",
          env: { ...process.env, TEST_RAG_INNER: "1" },
        })
      : spawnSync("npx", ["-y", "tsx", selfPath], {
          stdio: "inherit",
          env: { ...process.env, TEST_RAG_INNER: "1" },
        });
    process.exit(result.status ?? 1);
  }

  await runQueries();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
