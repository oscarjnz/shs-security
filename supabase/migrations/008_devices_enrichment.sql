-- 008: enrich devices with latency, vendor, last_scan_id
-- Down:
--   ALTER TABLE devices
--     DROP COLUMN IF EXISTS latency_ms,
--     DROP COLUMN IF EXISTS vendor,
--     DROP COLUMN IF EXISTS last_scan_id;

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS latency_ms NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS vendor TEXT,
  ADD COLUMN IF NOT EXISTS last_scan_id UUID REFERENCES scan_results(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_vendor ON devices(vendor);
