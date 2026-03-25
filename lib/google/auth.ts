import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Path segment Google redirects to after consent (must match a URI registered in Google Cloud). */
export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/auth/callback";

/**
 * OAuth redirect URI: `GOOGLE_REDIRECT_URI` if set, otherwise
 * `{NEXT_PUBLIC_APP_URL}/api/auth/callback` (trimmed, no trailing slash on the base).
 * Register every environment’s exact URI in Google Cloud (e.g. localhost + production).
 */
export function resolveGoogleRedirectUri(): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const base = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Google OAuth: set GOOGLE_REDIRECT_URI to your callback URL, or set NEXT_PUBLIC_APP_URL " +
        `(callback will be {NEXT_PUBLIC_APP_URL}${GOOGLE_OAUTH_CALLBACK_PATH}). ` +
        "Register that exact URI in Google Cloud Console for each environment."
    );
  }
  return `${base}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = resolveGoogleRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google OAuth config: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set"
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Returns a Google OAuth 2.0 authorization URL for Drive readonly scope.
 * Use access_type: 'offline' and prompt: 'consent' to obtain a refresh token.
 */
export function generateAuthUrl(): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [DRIVE_READONLY_SCOPE],
  });
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  /** When the access token should be treated as expired (UTC). */
  expires_at: Date;
}

function credentialsToExpiry(credentials: {
  expiry_date?: number | null;
  expires_in?: number | null;
}): Date {
  if (
    typeof credentials.expiry_date === "number" &&
    credentials.expiry_date > 0
  ) {
    return new Date(credentials.expiry_date);
  }
  if (typeof credentials.expires_in === "number" && credentials.expires_in > 0) {
    return new Date(Date.now() + credentials.expires_in * 1000);
  }
  return new Date(Date.now() + 3600 * 1000);
}

/**
 * Exchanges an authorization code for access and refresh tokens.
 * Throws an explicit error if the exchange fails.
 */
export async function getTokensFromCode(
  code: string
): Promise<TokenResponse> {
  const oauth2 = getOAuth2Client();

  const { tokens } = await oauth2.getToken(code).catch((err) => {
    throw new Error(
      `Google OAuth token exchange failed: ${err instanceof Error ? err.message : String(err)}`
    );
  });

  if (!tokens.access_token) {
    throw new Error("Google OAuth token exchange failed: no access_token in response");
  }

  if (!tokens.refresh_token) {
    throw new Error(
      "Google OAuth token exchange failed: no refresh_token. Ensure prompt=consent is used."
    );
  }

  const expires_in =
    "expires_in" in tokens && typeof tokens.expires_in === "number"
      ? tokens.expires_in
      : undefined;
  const expires_at = credentialsToExpiry({
    expiry_date: tokens.expiry_date ?? undefined,
    expires_in,
  });

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at,
  };
}

export interface RefreshedAccessToken {
  access_token: string;
  expires_at: Date;
}

/**
 * Exchanges a refresh token for a new access token and expiry (for DB storage).
 * Throws an explicit error if refresh fails.
 */
export async function refreshAccessTokenWithExpiry(
  refreshToken: string
): Promise<RefreshedAccessToken> {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2.refreshAccessToken().catch((err) => {
    throw new Error(
      `Google OAuth token refresh failed: ${err instanceof Error ? err.message : String(err)}`
    );
  });

  if (!credentials.access_token) {
    throw new Error("Google OAuth token refresh failed: no access_token in response");
  }

  return {
    access_token: credentials.access_token,
    expires_at: credentialsToExpiry(credentials),
  };
}

/**
 * Exchanges a refresh token for a new access token.
 * Returns the new access_token.
 * Throws an explicit error if refresh fails.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<string> {
  const { access_token } = await refreshAccessTokenWithExpiry(refreshToken);
  return access_token;
}

/**
 * Returns a configured Google Auth client for use with the Drive API.
 * Caller can use this with google.drive({ auth: client }).
 */
export function getAuthenticatedClient(
  accessToken: string
): OAuth2Client {
  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({ access_token: accessToken });
  return oauth2;
}
