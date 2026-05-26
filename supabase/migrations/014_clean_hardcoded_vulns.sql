-- 014: Remove the 3 seeded demo vulnerabilities and improve the schema for
--      real scan-derived vulnerabilities.
-- Down:
--   No down. The deleted rows were demo seeds, recreating them is not desired.

-- 1) Delete the three known hardcoded demo rows (matched by name + optional CVE
--    so we never touch real user data).
DELETE FROM vulnerability_scans
WHERE
  (name = 'Echo Dot UPnP Exposed' AND affected ILIKE '%Echo Dot%')
  OR (name = 'Router Firmware Outdated' AND cve = 'CVE-2024-3080')
  OR (name = 'WPA2 KRACK Vulnerability' AND cve = 'CVE-2017-13077');

-- 2) Add a "source" column so we can distinguish seed / manual / scan-derived
--    entries. Default 'manual' keeps backward compat for anything else.
ALTER TABLE vulnerability_scans
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- 3) Add a "detected_port" column so scan-derived vulns can record which open
--    port surfaced the warning (nullable for non-port vulns).
ALTER TABLE vulnerability_scans
  ADD COLUMN IF NOT EXISTS detected_port INTEGER;

-- 4) Prevent the same (user_id, cve, detected_port) being inserted twice from
--    repeated scans of the same router. NULL detected_port still allows
--    multiple manual entries of the same CVE (NULLs are distinct in unique).
CREATE UNIQUE INDEX IF NOT EXISTS uq_vuln_scan_signature
  ON vulnerability_scans (user_id, cve, detected_port)
  WHERE cve IS NOT NULL AND detected_port IS NOT NULL;

-- 5) Index for "find my open vulns fast"
CREATE INDEX IF NOT EXISTS idx_vulns_user_status
  ON vulnerability_scans (user_id, status);
