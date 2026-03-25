import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTokensFromCode } from "@/lib/google/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const redirectError = () =>
    NextResponse.redirect(
      new URL("/curriculum?error=drive_auth_failed", request.url)
    );
  const redirectSuccess = () =>
    NextResponse.redirect(new URL("/curriculum", request.url));

  if (!code || typeof code !== "string") {
    return redirectError();
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectError();
    }

    const { access_token, refresh_token, expires_at } =
      await getTokensFromCode(code);

    const { error } = await supabase
      .from("profiles")
      .update({
        google_access_token: access_token,
        google_refresh_token: refresh_token,
        google_token_expiry: expires_at.toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return redirectError();
    }

    return redirectSuccess();
  } catch {
    return redirectError();
  }
}
