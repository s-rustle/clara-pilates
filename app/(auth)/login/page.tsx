"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/layout/Wordmark";
import Button from "@/components/ui/Button";
import ErrorMessage from "@/components/ui/ErrorMessage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("Incorrect email or password. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Incorrect email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-clara-bg">
      <div className="h-[5px] shrink-0 bg-clara-primary" aria-hidden />
      <div className="flex flex-1 items-center justify-center px-5 py-10">
        {/* Reference: ~320px inner; wide clamps let “Clara” breathe on larger screens */}
        <div className="w-full max-w-[min(100%,380px)]">
          <div className="mb-9">
            <Wordmark variant="login" />
          </div>

          <div className="border border-clara-border bg-clara-surface">
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full border-0 bg-transparent px-4 py-[13px] text-[13px] text-clara-deep placeholder:text-clara-muted focus:outline-none disabled:opacity-50"
            />
            <div className="h-px bg-clara-border" />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full border-0 bg-transparent px-4 py-[13px] text-[13px] text-clara-deep placeholder:text-clara-muted focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="mt-6 space-y-4">
            <Button
              variant="primary"
              onClick={() => void handleSignIn()}
              disabled={loading}
              className="w-full py-3.5 text-[12px] font-medium tracking-[0.08em]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 normal-case">
                  <LoadingSpinner size="sm" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>

            <ErrorMessage message={error} />

            <div className="mt-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-clara-border" />
              <span className="text-[10px] text-clara-muted">or</span>
              <div className="h-px flex-1 bg-clara-border" />
            </div>

            <p className="text-center text-[11px] text-clara-muted">
              <Link
                href="/signup"
                className="font-medium text-clara-primary no-underline hover:underline"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="h-[5px] shrink-0 bg-clara-primary" aria-hidden />
    </div>
  );
}
