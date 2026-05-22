-- 011: Bulletproof auth trigger + backfill of orphaned auth.users
--
-- Symptoms this fixes:
--   * "Database error saving new user" during signup (trigger crashed).
--   * Non-admin accounts that can log in to Supabase Auth but get bounced
--     back to /login because their profile row never got created or has
--     invalid data.
--
-- This migration is idempotent — safe to run multiple times.

-- ────────────────────────────────────────────────────────────────────────
-- 1) Make sure profiles has every column the trigger expects.
-- ────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ────────────────────────────────────────────────────────────────────────
-- 2) Replace handle_new_user with a defensive version that NEVER fails
--    auth.users insert, even on unexpected metadata.
-- ────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_avatar    TEXT;
  v_role_raw  TEXT;
  v_role      user_role := 'normal';
BEGIN
  -- Resolve full_name from the metadata keys each provider uses.
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'),       ''),  -- Google, GitHub, MS
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'user_name'),  ''),  -- GitHub fallback
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'preferred_username'), ''),  -- Microsoft
    SPLIT_PART(COALESCE(NEW.email, ''), '@', 1),
    'Usuario'
  );

  -- Avatar URL from common providers (null if none).
  v_avatar := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'avatar_url'), ''),  -- GitHub
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'picture'),    '')   -- Google
  );

  -- Safe role cast: only accept known enum values. Any other input → 'normal'.
  v_role_raw := NEW.raw_user_meta_data ->> 'role';
  IF v_role_raw IN ('admin', 'normal', 'guest') THEN
    v_role := v_role_raw::user_role;
  END IF;

  -- The actual insert. If anything goes wrong, we LOG and continue — we
  -- never let the trigger abort the auth.users insert (otherwise users
  -- can never sign up).
  BEGIN
    INSERT INTO profiles (id, full_name, role, avatar_url, email, is_active)
    VALUES (NEW.id, v_full_name, v_role, v_avatar, NEW.email, TRUE)
    ON CONFLICT (id) DO UPDATE SET
      full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      email      = COALESCE(EXCLUDED.email,      profiles.email);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user could not create profile for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────────────
-- 3) Re-attach the trigger (in case it was orphaned by a previous migration).
-- ────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────────────────
-- 4) Backfill: any auth.users without a corresponding profile gets one now.
--    This rescues accounts that signed up while the trigger was broken.
-- ────────────────────────────────────────────────────────────────────────
INSERT INTO profiles (id, full_name, role, email, is_active)
SELECT
  u.id,
  COALESCE(
    NULLIF(TRIM(u.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(u.raw_user_meta_data ->> 'name'),       ''),
    SPLIT_PART(COALESCE(u.email, ''), '@', 1),
    'Usuario'
  ),
  'normal'::user_role,
  u.email,
  TRUE
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────
-- 5) Defensive: any existing profiles with is_active = NULL get TRUE.
-- ────────────────────────────────────────────────────────────────────────
UPDATE profiles SET is_active = TRUE WHERE is_active IS NULL;
