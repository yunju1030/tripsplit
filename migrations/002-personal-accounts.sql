-- Preserve every existing trip. NULL owners are never exposed to new accounts.
BEGIN;
CREATE TABLE IF NOT EXISTS public.app_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.app_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON public.app_sessions(user_id);
CREATE TABLE IF NOT EXISTS public.auth_limits (
  key TEXT NOT NULL,
  bucket BIGINT NOT NULL,
  attempts INTEGER NOT NULL,
  PRIMARY KEY(key,bucket)
);
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES public.app_users(id);
CREATE INDEX IF NOT EXISTS trips_owner_idx ON public.trips(owner_id);
COMMIT;
