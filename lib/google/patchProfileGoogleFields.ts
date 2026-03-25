import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileGoogleTokenPatch = {
  google_access_token?: string | null;
  google_refresh_token?: string | null;
  google_token_expiry?: string | null;
};

/**
 * Updates Google OAuth fields on `profiles`. If the patch includes `google_token_expiry` and
 * the DB has no such column (migration not applied), retries once without it so Drive still works.
 */
export async function patchProfileGoogleFields(
  supabase: SupabaseClient,
  userId: string,
  patch: ProfileGoogleTokenPatch
): Promise<{ error: null } | { error: { message: string } }> {
  const payload: Record<string, string | null> = {};
  if (patch.google_access_token !== undefined) {
    payload.google_access_token = patch.google_access_token;
  }
  if (patch.google_refresh_token !== undefined) {
    payload.google_refresh_token = patch.google_refresh_token;
  }
  if (patch.google_token_expiry !== undefined) {
    payload.google_token_expiry = patch.google_token_expiry;
  }

  if (Object.keys(payload).length === 0) {
    return { error: null };
  }

  let { error } = await supabase.from("profiles").update(payload).eq("id", userId);

  const msg = (error?.message ?? "").toLowerCase();
  const missingExpiryColumn =
    error &&
    "google_token_expiry" in payload &&
    (msg.includes("google_token_expiry") ||
      msg.includes("schema cache") ||
      (msg.includes("column") && msg.includes("does not exist")));

  if (missingExpiryColumn) {
    const { google_token_expiry: _omit, ...rest } = payload;
    if (Object.keys(rest).length > 0) {
      const retry = await supabase.from("profiles").update(rest).eq("id", userId);
      error = retry.error;
    }
  }

  if (error) {
    return { error: { message: error.message } };
  }
  return { error: null };
}
