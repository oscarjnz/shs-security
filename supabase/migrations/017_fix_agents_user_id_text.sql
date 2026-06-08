-- 017: Arregla el tipo de user_id en las tablas de agentes.
--
-- La migración 016 creó user_id como UUID con FK a auth.users, pero el sistema usa
-- Clerk, donde los IDs de usuario son TEXT (ej. "user_3Epv..."). Insertar un ID de
-- Clerk en una columna UUID falla con "invalid input syntax for type uuid".
--
-- Las tablas están vacías, así que el cambio de tipo no tiene filas que convertir.
--
-- Down: (no trivial — requeriría re-castear a uuid; no soportado)

-- 1) Quitar los FK a auth.users (Clerk no vive en esa tabla)
ALTER TABLE agents        DROP CONSTRAINT IF EXISTS agents_user_id_fkey;
ALTER TABLE pairing_codes DROP CONSTRAINT IF EXISTS pairing_codes_user_id_fkey;
ALTER TABLE scan_jobs     DROP CONSTRAINT IF EXISTS scan_jobs_user_id_fkey;

-- 2) Quitar políticas RLS que comparan uuid = text (se recrean abajo con cast)
DROP POLICY IF EXISTS "Users see own agents"        ON agents;
DROP POLICY IF EXISTS "Users see own pairing codes" ON pairing_codes;
DROP POLICY IF EXISTS "Users see own scan jobs"     ON scan_jobs;

-- 3) Cambiar el tipo de columna UUID -> TEXT
ALTER TABLE agents        ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE pairing_codes ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE scan_jobs     ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 4) Recrear las políticas de lectura con comparación segura para text
CREATE POLICY "Users see own agents" ON agents
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users see own pairing codes" ON pairing_codes
  FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users see own scan jobs" ON scan_jobs
  FOR SELECT USING (auth.uid()::text = user_id);
