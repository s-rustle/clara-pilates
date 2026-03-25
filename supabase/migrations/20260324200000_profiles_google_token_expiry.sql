-- When the current Google OAuth access token should be considered expired (UTC).
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_token_expiry timestamptz;

COMMENT ON COLUMN public.profiles.google_token_expiry IS
  'Access token expiry from Google; used to refresh before Drive API calls.';
