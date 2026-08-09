-- 019_rls_reference_tables.sql
--
-- Cierra los 3 errores de seguridad que reportaba el linter de Supabase:
-- cve_cache, kev_catalog y groq_response_variants estaban expuestas en la API
-- publica con RLS desactivado.
--
-- Estas tres tablas son de REFERENCIA PUBLICA (catalogo de CVEs de la NVD,
-- catalogo KEV de CISA y variantes de respuesta del asistente). No contienen
-- datos de ningun usuario, asi que la lectura sigue siendo abierta: lo que se
-- corrige es que la escritura quede cerrada al cliente y que RLS este activo,
-- que es lo que el linter exige.
--
-- La migracion 013 ya creaba policies "USING (TRUE)" sobre estas tablas, pero
-- sin `enable row level security` esas policies nunca llegaron a aplicarse.

alter table public.cve_cache enable row level security;
alter table public.kev_catalog enable row level security;
alter table public.groq_response_variants enable row level security;

-- Lectura publica (son catalogos de referencia, no datos de usuario).
drop policy if exists "cve_cache_public_read" on public.cve_cache;
create policy "cve_cache_public_read"
  on public.cve_cache for select
  to anon, authenticated
  using (true);

drop policy if exists "kev_catalog_public_read" on public.kev_catalog;
create policy "kev_catalog_public_read"
  on public.kev_catalog for select
  to anon, authenticated
  using (true);

drop policy if exists "groq_response_variants_public_read" on public.groq_response_variants;
create policy "groq_response_variants_public_read"
  on public.groq_response_variants for select
  to anon, authenticated
  using (true);

-- No se crean policies de insert/update/delete a proposito: con RLS activo y
-- sin policy de escritura, anon y authenticated no pueden modificar estas
-- tablas. El backend y los cron jobs siguen escribiendo con la service role
-- key, que ignora RLS por diseno.

-- Rollback (solo si algo dejara de leerse en produccion):
-- alter table public.cve_cache disable row level security;
-- alter table public.kev_catalog disable row level security;
-- alter table public.groq_response_variants disable row level security;
