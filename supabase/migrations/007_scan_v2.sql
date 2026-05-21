-- 007: Scanner v2 — profile metadata, public scan audit, threat dedup index
-- Down:
--   DROP INDEX IF EXISTS idx_threats_dedup;
--   DROP TABLE IF EXISTS public_scan_audit;
--   ALTER TABLE scan_results
--     DROP COLUMN IF EXISTS profile_id,
--     DROP COLUMN IF EXISTS public_consent,
--     DROP COLUMN IF EXISTS auto_devices_count,
--     DROP COLUMN IF EXISTS auto_threats_count;

ALTER TABLE scan_results
  ADD COLUMN IF NOT EXISTS profile_id TEXT,
  ADD COLUMN IF NOT EXISTS public_consent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_devices_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_threats_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_threats_dedup
  ON threats(user_id, type, target, status);

CREATE TABLE IF NOT EXISTS public_scan_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  target TEXT NOT NULL,
  args JSONB NOT NULL DEFAULT '[]'::JSONB,
  consent_text TEXT NOT NULL,
  request_ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_scan_audit_user ON public_scan_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_public_scan_audit_created ON public_scan_audit(created_at DESC);

ALTER TABLE public_scan_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read public scan audit" ON public_scan_audit FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "Service role writes public scan audit" ON public_scan_audit FOR INSERT
  WITH CHECK (TRUE);
