-- 009: Better handle_new_user — extracts full_name + avatar_url from OAuth metadata.
-- Supports Google, GitHub, Microsoft (Azure), and email/password signups.
-- Also adds profiles.email (mirrored from auth.users for convenient joins).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_avatar    TEXT;
  v_role      user_role;
BEGIN
  -- full_name: try common OAuth metadata keys, fall back to email local-part.
  v_full_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'name'),       ''),  -- Google, GitHub, Microsoft
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'user_name'),  ''),  -- GitHub fallback
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'preferred_username'), ''),  -- Microsoft
    SPLIT_PART(NEW.email, '@', 1),
    ''
  );

  -- avatar_url: same idea
  v_avatar := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'avatar_url'), ''),  -- GitHub
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'picture'),    ''),  -- Google
    ''
  );

  v_role := COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'normal');

  INSERT INTO profiles (id, full_name, role, avatar_url, email)
  VALUES (
    NEW.id,
    v_full_name,
    v_role,
    NULLIF(v_avatar, ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email      = COALESCE(EXCLUDED.email, profiles.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
