-- 018: RLS real bajo Clerk (opcion A)
--
-- CONTEXTO / POR QUE
-- ------------------------------------------------------------------------
-- Al migrar de Supabase Auth a Clerk, las policies viejas (migraciones 002-005)
-- quedaron muertas: usaban auth.uid() (Supabase Auth), que con Clerk siempre es
-- NULL. En la base VIVA el RLS de esas tablas quedo DESACTIVADO (verificado el
-- 2026-07-02), asi que cualquiera con la anon key (que es publica, va en el
-- bundle del frontend) podia leer los datos de TODOS los usuarios. Esta
-- migracion cierra esa fuga: activa RLS y crea policies basadas en el id de
-- Clerk, que viaja en el JWT como el claim 'sub' (auth.jwt()->>'sub').
--
-- El id de Clerk es TEXT (ej. "user_2abc..."). Todas las columnas user_id /
-- generated_by / profiles.id son TEXT, asi que comparan directo con el sub.
--
-- El backend (agent/) y el relay usan la SERVICE ROLE KEY, que tiene BYPASSRLS:
-- sus inserts/updates siguen funcionando sin importar estas policies. Por eso
-- aqui solo definimos lo que el FRONTEND (anon key + token de Clerk) necesita:
--   - leer las filas propias (SELECT)
--   - el admin lee todo (override por profiles.role)
--   - profiles: upsert/update del propio perfil (lo hace AuthContext en login)
--   - notifications: marcar leido/descartar las propias
--
-- ORDEN DE DESPLIEGUE (IMPORTANTE, ver docs/rls-clerk-runbook.md):
--   1) Configurar Clerk como Third-Party Auth en el panel de Supabase.
--   2) Desplegar el frontend con el token de Clerk pasado a supabase-js.
--   3) RECIEN AHI aplicar esta migracion (activa RLS).
-- Si se aplica antes del paso 2, el frontend (anon, sin sub) deja de ver datos.
-- Rollback instantaneo si algo sale mal: ver el bloque comentado al final.
--
-- Idempotente: se puede correr varias veces sin romper.

-- ────────────────────────────────────────────────────────────────────────
-- Helpers
-- ────────────────────────────────────────────────────────────────────────

-- id de Clerk del usuario actual (claim 'sub' del JWT). NULL para anon.
-- Usa auth.jwt() (helper oficial de Supabase) que ya hace el nullif ANTES de
-- castear a jsonb, asi que no revienta cuando request.jwt.claims viene vacio.
create or replace function public.clerk_uid()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')
$$;

-- ¿el usuario actual es admin? SECURITY DEFINER para leer profiles SIN quedar
-- atrapado por el propio RLS de profiles (evita recursion infinita en policies).
create or replace function public.is_clerk_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = public.clerk_uid() and p.role = 'admin'
  )
$$;

revoke all on function public.clerk_uid() from public;
revoke all on function public.is_clerk_admin() from public;
grant execute on function public.clerk_uid() to anon, authenticated;
grant execute on function public.is_clerk_admin() to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────
-- Tablas de datos por-usuario: SELECT solo lo propio (+ admin donde aplica)
-- ────────────────────────────────────────────────────────────────────────

-- devices
alter table public.devices enable row level security;
drop policy if exists "clerk_select_own" on public.devices;
create policy "clerk_select_own" on public.devices
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- threats
alter table public.threats enable row level security;
drop policy if exists "clerk_select_own" on public.threats;
create policy "clerk_select_own" on public.threats
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- vulnerability_scans
alter table public.vulnerability_scans enable row level security;
drop policy if exists "clerk_select_own" on public.vulnerability_scans;
create policy "clerk_select_own" on public.vulnerability_scans
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- scan_results
alter table public.scan_results enable row level security;
drop policy if exists "clerk_select_own" on public.scan_results;
create policy "clerk_select_own" on public.scan_results
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- network_metrics
alter table public.network_metrics enable row level security;
drop policy if exists "clerk_select_own" on public.network_metrics;
create policy "clerk_select_own" on public.network_metrics
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- activity_logs (los admin ven todos)
alter table public.activity_logs enable row level security;
drop policy if exists "clerk_select_own" on public.activity_logs;
create policy "clerk_select_own" on public.activity_logs
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- device_pings
alter table public.device_pings enable row level security;
drop policy if exists "clerk_select_own" on public.device_pings;
create policy "clerk_select_own" on public.device_pings
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- reports (la columna es generated_by; los admin ven todos)
alter table public.reports enable row level security;
drop policy if exists "clerk_select_own" on public.reports;
create policy "clerk_select_own" on public.reports
  for select using (generated_by = public.clerk_uid() or public.is_clerk_admin());

-- scheduled_reports
alter table public.scheduled_reports enable row level security;
drop policy if exists "clerk_select_own" on public.scheduled_reports;
create policy "clerk_select_own" on public.scheduled_reports
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- email_config (el usuario ve/gestiona la suya; lecturas desde el front)
alter table public.email_config enable row level security;
drop policy if exists "clerk_select_own" on public.email_config;
create policy "clerk_select_own" on public.email_config
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- user_networks (el usuario puede leer y renombrar sus redes desde el front)
alter table public.user_networks enable row level security;
drop policy if exists "clerk_select_own" on public.user_networks;
create policy "clerk_select_own" on public.user_networks
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());
drop policy if exists "clerk_update_own" on public.user_networks;
create policy "clerk_update_own" on public.user_networks
  for update using (user_id = public.clerk_uid())
  with check (user_id = public.clerk_uid());

-- user_preferences (settings del usuario)
alter table public.user_preferences enable row level security;
drop policy if exists "clerk_rw_own" on public.user_preferences;
create policy "clerk_rw_own" on public.user_preferences
  for all using (user_id = public.clerk_uid())
  with check (user_id = public.clerk_uid());

-- ────────────────────────────────────────────────────────────────────────
-- notifications: filas propias + broadcasts globales (user_id IS NULL, ej. KEV);
-- el usuario marca leido / descarta las propias.
-- ────────────────────────────────────────────────────────────────────────
alter table public.notifications enable row level security;
drop policy if exists "clerk_select_own_or_global" on public.notifications;
create policy "clerk_select_own_or_global" on public.notifications
  for select using (
    user_id is null
    or user_id = public.clerk_uid()
    or public.is_clerk_admin()
  );
drop policy if exists "clerk_update_own" on public.notifications;
create policy "clerk_update_own" on public.notifications
  for update using (user_id = public.clerk_uid())
  with check (user_id = public.clerk_uid());

-- ────────────────────────────────────────────────────────────────────────
-- profiles: el usuario lee/crea/actualiza SU perfil (AuthContext hace upsert
-- en cada login con la anon key). El admin lee/edita todos.
-- ────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "clerk_select_self_or_admin" on public.profiles;
create policy "clerk_select_self_or_admin" on public.profiles
  for select using (id = public.clerk_uid() or public.is_clerk_admin());

drop policy if exists "clerk_insert_self" on public.profiles;
create policy "clerk_insert_self" on public.profiles
  for insert with check (id = public.clerk_uid());

drop policy if exists "clerk_update_self_or_admin" on public.profiles;
create policy "clerk_update_self_or_admin" on public.profiles
  for update using (id = public.clerk_uid() or public.is_clerk_admin())
  with check (id = public.clerk_uid() or public.is_clerk_admin());

-- ────────────────────────────────────────────────────────────────────────
-- permissions (RBAC granular). Hoy sus filas son de la era vieja (UUID) y el
-- app se apoya en profiles.role, pero cerramos la tabla igual: cada quien ve
-- lo suyo, el admin ve todo.
-- ────────────────────────────────────────────────────────────────────────
alter table public.permissions enable row level security;
drop policy if exists "clerk_select_own_or_admin" on public.permissions;
create policy "clerk_select_own_or_admin" on public.permissions
  for select using (user_id = public.clerk_uid() or public.is_clerk_admin());

-- ────────────────────────────────────────────────────────────────────────
-- public_scan_audit: solo admins leen (auditoria de scans a IP publica).
-- ────────────────────────────────────────────────────────────────────────
alter table public.public_scan_audit enable row level security;
drop policy if exists "clerk_admin_select" on public.public_scan_audit;
create policy "clerk_admin_select" on public.public_scan_audit
  for select using (public.is_clerk_admin());

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK DE EMERGENCIA (si tras aplicar esto el dashboard sale vacio en
-- produccion, corre esto para volver al estado anterior al instante):
--
--   alter table public.devices             disable row level security;
--   alter table public.threats             disable row level security;
--   alter table public.vulnerability_scans disable row level security;
--   alter table public.scan_results        disable row level security;
--   alter table public.network_metrics     disable row level security;
--   alter table public.activity_logs       disable row level security;
--   alter table public.device_pings        disable row level security;
--   alter table public.reports             disable row level security;
--   alter table public.scheduled_reports   disable row level security;
--   alter table public.email_config        disable row level security;
--   alter table public.user_networks       disable row level security;
--   alter table public.user_preferences    disable row level security;
--   alter table public.notifications       disable row level security;
--   alter table public.profiles            disable row level security;
--   alter table public.permissions         disable row level security;
--   alter table public.public_scan_audit   disable row level security;
--
-- (Ojo: el rollback reabre la fuga. Es solo para no dejar el dashboard caido
--  mientras se corrige lo que haya fallado.)
-- ════════════════════════════════════════════════════════════════════════
