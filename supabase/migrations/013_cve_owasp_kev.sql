-- 013: CVE intel cache, CISA KEV catalog, Groq response variants
-- Down:
--   DROP TABLE IF EXISTS groq_response_variants;
--   DROP TABLE IF EXISTS kev_catalog;
--   DROP TABLE IF EXISTS cve_cache;

-- ─────────────────────────────────────────────────────────────────────────────
-- cve_cache: cached NVD responses + Groq-generated Spanish explanation.
-- Public read (educational data); writes via service role only.
-- TTL handled in app code (7 days); we keep `fetched_at` to know freshness.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cve_cache (
  cve_id TEXT PRIMARY KEY,
  nvd_data JSONB NOT NULL,
  cvss_score NUMERIC(4,1),
  cvss_version TEXT,
  severity TEXT,
  description_en TEXT,
  description_es TEXT,
  mitigations_es TEXT,
  vendor TEXT,
  product TEXT,
  published_at TIMESTAMPTZ,
  modified_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cve_cache_severity ON cve_cache(severity);
CREATE INDEX IF NOT EXISTS idx_cve_cache_fetched ON cve_cache(fetched_at DESC);

ALTER TABLE cve_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read cve_cache" ON cve_cache;
CREATE POLICY "Anyone can read cve_cache" ON cve_cache FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Service role manages cve_cache" ON cve_cache;
CREATE POLICY "Service role manages cve_cache" ON cve_cache FOR ALL WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- kev_catalog: CISA Known Exploited Vulnerabilities, synced daily via cron.
-- Source: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kev_catalog (
  cve_id TEXT PRIMARY KEY,
  vendor TEXT,
  product TEXT,
  vulnerability_name TEXT,
  date_added DATE,
  short_description TEXT,
  required_action TEXT,
  due_date DATE,
  known_ransomware_use TEXT,
  notes TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kev_vendor ON kev_catalog(vendor);
CREATE INDEX IF NOT EXISTS idx_kev_product ON kev_catalog(product);
CREATE INDEX IF NOT EXISTS idx_kev_date_added ON kev_catalog(date_added DESC);
CREATE INDEX IF NOT EXISTS idx_kev_ransomware ON kev_catalog(known_ransomware_use);

ALTER TABLE kev_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read kev_catalog" ON kev_catalog;
CREATE POLICY "Anyone can read kev_catalog" ON kev_catalog FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Service role manages kev_catalog" ON kev_catalog;
CREATE POLICY "Service role manages kev_catalog" ON kev_catalog FOR ALL WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- groq_response_variants: pre-generated answers for the OWASP chat.
-- Stores 3–5 variations per normalized question so we can rotate randomly
-- and never give the same answer twice in a row, without burning tokens
-- on every request.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groq_response_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT NOT NULL,
  question TEXT NOT NULL,
  response TEXT NOT NULL,
  variant_num INTEGER NOT NULL,
  context_kind TEXT NOT NULL DEFAULT 'owasp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_hash, variant_num, context_kind)
);
CREATE INDEX IF NOT EXISTS idx_groq_variants_hash ON groq_response_variants(question_hash, context_kind);

ALTER TABLE groq_response_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read groq variants" ON groq_response_variants;
CREATE POLICY "Anyone can read groq variants" ON groq_response_variants FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS "Service role manages groq variants" ON groq_response_variants;
CREATE POLICY "Service role manages groq variants" ON groq_response_variants FOR ALL WITH CHECK (TRUE);
