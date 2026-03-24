"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Wordmark from "@/components/layout/Wordmark";
import Input from "@/components/ui/Input";
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
    <div className="relative z-10 flex min-h-screen items-center justify-center overflow-x-hidden bg-clara-bg px-4">
      <div className="relative z-10 w-full max-w-md rounded-clara border border-clara-border/90 bg-clara-surface p-8 shadow-clara-lift">
        <div className="mb-6 flex justify-center">
          <Wordmark size="md" />
        </div>

        <div className="space-y-4">
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            disabled={loading}
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            disabled={loading}
          />
        </div>

        <div className="mt-6 space-y-4">
          <Button
            variant="primary"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="sm" />
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </Button>

          <ErrorMessage message={error} />
        </div>
      </div>
    </div>
  );
}
