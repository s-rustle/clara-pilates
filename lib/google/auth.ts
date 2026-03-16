import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

function getOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth config: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI must be set"
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

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
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

  return credentials.access_token;
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
