-- 010: User-recognized networks (auto-detect when the user moves between Wi-Fi networks)
-- Down: DROP TABLE user_networks;

CREATE TABLE IF NOT EXISTS user_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  subnet TEXT NOT NULL,
  label TEXT,
  interface_name TEXT,
  last_local_ip TEXT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, subnet)
);

CREATE INDEX IF NOT EXISTS idx_user_networks_user ON user_networks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_networks_last_seen ON user_networks(last_seen DESC);

ALTER TABLE user_networks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own networks" ON user_networks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own network labels" ON user_networks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role manages user_networks" ON user_networks FOR ALL WITH CHECK (TRUE);
