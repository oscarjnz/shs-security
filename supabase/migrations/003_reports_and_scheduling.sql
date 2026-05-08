-- 003: Reports, email_config, scheduled_reports, user_preferences
-- Down: DROP TABLE user_preferences, scheduled_reports, email_config, reports;

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type report_type NOT NULL DEFAULT 'custom',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  generated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  summary TEXT,
  sections JSONB DEFAULT '[]'::jsonb,
  threat_count INTEGER NOT NULL DEFAULT 0,
  device_count INTEGER NOT NULL DEFAULT 0,
  open_port_count INTEGER NOT NULL DEFAULT 0,
  security_score INTEGER NOT NULL DEFAULT 0,
  previous_security_score INTEGER,
  status report_status NOT NULL DEFAULT 'draft',
  recipients TEXT[],
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_generated_by ON reports(generated_by);
CREATE INDEX idx_reports_generated_at ON reports(generated_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own reports" ON reports FOR SELECT USING (auth.uid() = generated_by);
CREATE POLICY "Admins see all reports" ON reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY "Service role manages reports" ON reports FOR ALL WITH CHECK (TRUE);

CREATE TABLE email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  notify_threats BOOLEAN NOT NULL DEFAULT TRUE,
  notify_vulns BOOLEAN NOT NULL DEFAULT TRUE,
  notify_reports BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own email config" ON email_config FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER email_config_updated_at
  BEFORE UPDATE ON email_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  day_of_week INTEGER NOT NULL DEFAULT 1,
  hour_utc INTEGER,
  send_email BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own schedule" ON scheduled_reports FOR ALL USING (auth.uid() = user_id);

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  theme TEXT NOT NULL DEFAULT 'dark',
  notifications BOOLEAN NOT NULL DEFAULT TRUE,
  compact_mode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON user_preferences FOR ALL USING (auth.uid() = user_id);

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
