-- 016: Scanner agents, pairing codes and scan jobs
--
-- Tres piezas:
--   1) agents          → cada agente físico que el cliente instala en una máquina suya
--   2) pairing_codes   → códigos cortos de un solo uso (10 min de vida) que el cliente teclea
--                        en su máquina para canjearlos por un token permanente
--   3) scan_jobs       → cada vez que el dashboard pide un escaneo, encolamos un job
--                        que el agente correspondiente recoge y devuelve resultado
--
-- Down: DROP TABLE scan_jobs, pairing_codes, agents CASCADE;

/* ─── AGENTS ───────────────────────────────────────────────────────────────── */

CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,

  -- Nombre legible mostrado en el dashboard. Por defecto el hostname del cliente.
  name TEXT NOT NULL DEFAULT 'Agente sin nombre',

  -- Hash SHA-256 del token. NUNCA guardamos el token en claro.
  token_hash TEXT NOT NULL UNIQUE,

  -- Info del sistema reportada por el agente (OS, versión, arch, RAM, IPs locales).
  -- JSON libre para poder evolucionar sin migraciones.
  system_info JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Versión del binario del agente, ej "0.1.0"
  agent_version TEXT,

  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline', 'revoked')),

  last_seen TIMESTAMPTZ,
  last_ip INET,  -- IP pública desde la que se conecta el agente (para auditoría)

  paired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_token_hash ON agents(token_hash);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own agents" ON agents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages agents" ON agents
  FOR ALL WITH CHECK (TRUE);

/* ─── PAIRING CODES ────────────────────────────────────────────────────────── */

CREATE TABLE pairing_codes (
  -- Código corto que el cliente teclea, ej "K7P-9XQ". 6-16 chars, mayúsculas + dígitos + guión.
  code TEXT PRIMARY KEY,

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,

  -- Nombre opcional pre-asignado al agente desde el dashboard ("Servidor casa")
  preassigned_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Cuando se canjea, guardamos a qué agente quedó ligado y cuándo
  used_at TIMESTAMPTZ,
  used_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,

  -- IP desde la que se canjeó (para auditoría de intentos sospechosos)
  redeemed_from_ip INET
);

CREATE INDEX idx_pairing_codes_user ON pairing_codes(user_id);
CREATE INDEX idx_pairing_codes_expires ON pairing_codes(expires_at);

ALTER TABLE pairing_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own pairing codes" ON pairing_codes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages pairing codes" ON pairing_codes
  FOR ALL WITH CHECK (TRUE);

/* ─── SCAN JOBS ────────────────────────────────────────────────────────────── */

CREATE TABLE scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE ON UPDATE CASCADE,

  target TEXT NOT NULL,
  nmap_args TEXT[] NOT NULL DEFAULT '{}',
  profile_id TEXT,  -- opcional: id del perfil predefinido si vino de la UI

  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'dispatched', 'running', 'done', 'failed', 'canceled', 'expired')),

  -- Output crudo de nmap (truncado a 10k chars antes de guardar)
  raw_output TEXT,
  duration_ms INTEGER,
  error_message TEXT,

  -- Resultado parseado (lo llena el backend cuando el agente devuelve raw_output)
  parsed_devices JSONB,

  -- Link al scan_results "oficial" cuando ya quedó procesado y registrado
  scan_result_id UUID REFERENCES scan_results(id) ON DELETE SET NULL,

  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

CREATE INDEX idx_scan_jobs_agent ON scan_jobs(agent_id);
CREATE INDEX idx_scan_jobs_user ON scan_jobs(user_id);
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_requested ON scan_jobs(requested_at DESC);

ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own scan jobs" ON scan_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages scan jobs" ON scan_jobs
  FOR ALL WITH CHECK (TRUE);

/* ─── HOUSEKEEPING ─────────────────────────────────────────────────────────── */

-- Función de limpieza: borra códigos expirados (sin usar) cada vez que se llama.
-- Se invoca desde el cron del backend cada hora.
CREATE OR REPLACE FUNCTION purge_expired_pairing_codes()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted INTEGER;
BEGIN
  DELETE FROM pairing_codes
   WHERE used_at IS NULL
     AND expires_at < now();
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;
