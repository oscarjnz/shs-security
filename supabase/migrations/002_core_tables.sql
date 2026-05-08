-- 002: Core data tables — network_metrics, devices, threats, vulnerability_scans, activity_logs
-- Down: DROP TABLE activity_logs, vulnerability_scans, threats, devices, network_metrics;

CREATE TABLE network_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  download_speed NUMERIC(10,2) NOT NULL DEFAULT 0,
  upload_speed NUMERIC(10,2) NOT NULL DEFAULT 0,
  latency NUMERIC(8,2) NOT NULL DEFAULT 0,
  packet_loss NUMERIC(5,2) NOT NULL DEFAULT 0,
  connected_devices INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_metrics_user ON network_metrics(user_id);
CREATE INDEX idx_network_metrics_recorded ON network_metrics(recorded_at DESC);

ALTER TABLE network_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own metrics" ON network_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role inserts metrics" ON network_metrics FOR INSERT WITH CHECK (TRUE);

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL DEFAULT 'Unknown',
  type TEXT NOT NULL DEFAULT 'unknown',
  ip TEXT,
  mac TEXT,
  status TEXT NOT NULL DEFAULT 'online',
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  bandwidth NUMERIC(10,2),
  os TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_user ON devices(user_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_mac ON devices(mac);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own devices" ON devices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages devices" ON devices FOR ALL WITH CHECK (TRUE);

CREATE TABLE threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  type TEXT NOT NULL,
  source TEXT,
  target TEXT,
  severity TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_threats_user ON threats(user_id);
CREATE INDEX idx_threats_status ON threats(status);
CREATE INDEX idx_threats_severity ON threats(severity);
CREATE INDEX idx_threats_detected ON threats(detected_at DESC);

ALTER TABLE threats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own threats" ON threats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages threats" ON threats FOR ALL WITH CHECK (TRUE);

CREATE TABLE vulnerability_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  cve TEXT,
  severity TEXT NOT NULL DEFAULT 'low',
  affected TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  cvss NUMERIC(4,1),
  description TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vulns_user ON vulnerability_scans(user_id);
CREATE INDEX idx_vulns_severity ON vulnerability_scans(severity);

ALTER TABLE vulnerability_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own vulns" ON vulnerability_scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages vulns" ON vulnerability_scans FOR ALL WITH CHECK (TRUE);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  event TEXT NOT NULL,
  source TEXT,
  ip TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_logs_level ON activity_logs(level);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own logs" ON activity_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins see all logs" ON activity_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Service role inserts logs" ON activity_logs FOR INSERT WITH CHECK (TRUE);
