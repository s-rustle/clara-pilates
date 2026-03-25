import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessTokenWithExpiry } from "@/lib/google/auth";
import { REAUTH_REQUIRED } from "@/lib/api/messages";

/** Treat access token as unusable this many seconds before Google's expiry. */
const TOKEN_REFRESH_BUFFER_MS = 120_000;

function accessExpiredOrUnknown(expiryIso: string | null): boolean {
  if (!expiryIso) return true;
  const exp = new Date(expiryIso).getTime();
  if (Number.isNaN(exp)) return true;
  return exp <= Date.now() + TOKEN_REFRESH_BUFFER_MS;
}

export type EnsureGoogleAccessTokenResult =
  | { ok: true; accessToken: string }
  | { ok: false; error: typeof REAUTH_REQUIRED }
  | { ok: false; error: "not_connected" };

export type EnsureGoogleAccessOptions = {
  /** After a 401 from Drive, pass true to obtain a new access token even if expiry has not passed. */
  forceRefresh?: boolean;
};

/**
 * Returns a usable Google access token, refreshing and persisting to `profiles` when needed.
 */
export async function ensureGoogleAccessToken(
  supabase: SupabaseClient,
  userId: string,
  options?: EnsureGoogleAccessOptions
): Promise<EnsureGoogleAccessTokenResult> {
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("google_access_token, google_refresh_token, google_token_expiry")
    .eq("id", userId)
    .single();

  if (fetchError || !profile) {
    return { ok: false, error: "not_connected" };
  }

  const access = profile.google_access_token ?? null;
  const refresh = profile.google_refresh_token ?? null;
  const expiry = profile.google_token_expiry ?? null;

  const needsRefresh =
    options?.forceRefresh ||
    accessExpiredOrUnknown(expiry) ||
    !access;

  if (!needsRefresh && access) {
    return { ok: true, accessToken: access };
  }

  if (!refresh) {
    if (!access) {
      return { ok: false, error: "not_connected" };
    }
    return { ok: false, error: REAUTH_REQUIRED };
  }

  try {
    const { access_token, expires_at } =
      await refreshAccessTokenWithExpiry(refresh);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        google_access_token: access_token,
        google_token_expiry: expires_at.toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[ensureGoogleAccessToken] profile update failed", updateError);
      return { ok: false, error: REAUTH_REQUIRED };
    }

    return { ok: true, accessToken: access_token };
  } catch (e) {
    console.error(
      "[ensureGoogleAccessToken] refresh failed",
      e instanceof Error ? e.message : e
    );
    return { ok: false, error: REAUTH_REQUIRED };
  }
}
