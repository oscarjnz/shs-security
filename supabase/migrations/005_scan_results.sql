-- 005: Scan results table (NEW — stores network security scan history)
-- Down: DROP TABLE scan_results;

CREATE TABLE scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  query TEXT NOT NULL,
  intent TEXT NOT NULL,
  command TEXT NOT NULL,
  raw_output TEXT,
  parsed_result JSONB DEFAULT '{}'::jsonb,
  device_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scans_user ON scan_results(user_id);
CREATE INDEX idx_scans_created ON scan_results(created_at DESC);
CREATE INDEX idx_scans_intent ON scan_results(intent);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own scans" ON scan_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages scans" ON scan_results FOR ALL WITH CHECK (TRUE);
