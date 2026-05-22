-- 012: Per-device latency history (Fase 1 - pulso de la red)
--
-- The agent pings each known LAN device every ~60s. Each ping result
-- (RTT in ms or "unreachable") gets one row here.
--
-- Down:
--   DROP TABLE device_pings;

CREATE TABLE IF NOT EXISTS device_pings (
  id          BIGSERIAL PRIMARY KEY,
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sampled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  rtt_ms      NUMERIC(8,2),
  alive       BOOLEAN NOT NULL DEFAULT FALSE
);

-- Hot queries we expect:
--   * "last N pings of device X": (device_id, sampled_at DESC)
--   * "all pings for user U in time range": (user_id, sampled_at)
--   * "current status of device X": LIMIT 1 ORDER BY sampled_at DESC
CREATE INDEX IF NOT EXISTS idx_device_pings_device   ON device_pings(device_id, sampled_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_pings_user     ON device_pings(user_id, sampled_at DESC);

ALTER TABLE device_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own pings"
  ON device_pings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages pings"
  ON device_pings FOR ALL
  WITH CHECK (TRUE);

-- Retention helper: keep only the last 7 days of high-resolution pings
-- to avoid unbounded growth. The agent calls this periodically.
CREATE OR REPLACE FUNCTION cleanup_old_device_pings()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM device_pings
  WHERE sampled_at < now() - INTERVAL '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
