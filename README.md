# S.H.S — Security Home Services

Dashboard de seguridad de red doméstica en tiempo real con escaneo de red por lenguaje natural, análisis de IA y notificaciones automatizadas.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18.3 + Vite 5.4 + TypeScript 5.8 (strict) |
| Estilos | Tailwind CSS + shadcn/ui |
| Estado | TanStack React Query v5 + React Context |
| Base de datos | Supabase PostgreSQL (free tier) + RLS |
| Realtime | Supabase Realtime (threats, metrics, logs, notifications, scans) |
| Auth | Supabase Auth con JWT |
| Backend | Express.js (agent server, puerto 3001) |
| IA | Groq SDK — Llama 3.3 70B |
| Email | Resend (6 plantillas HTML en español) |
| Cron | node-cron (reportes, digest semanal, limpieza) |
| Scanner | nmap, ping, traceroute, etc. vía child_process |

---

## Estructura del Proyecto

```
proyecto s.h.s/
├── src/                          # Frontend React
│   ├── components/
│   │   ├── ui/                   # shadcn/ui (~45 componentes)
│   │   ├── dashboard/            # Componentes del dashboard
│   │   └── scan/                 # Chat de escaneo de red
│   ├── contexts/AuthContext.tsx   # Autenticación y permisos
│   ├── hooks/                    # Hooks custom (realtime, KPIs, scan)
│   ├── lib/                      # Supabase client, types, auth utils
│   └── pages/                    # 14 páginas + settings
├── agent/                        # Backend Express
│   └── src/
│       ├── index.ts              # Servidor principal + rutas + cron
│       └── lib/                  # Módulos: scanner, email, RBAC, schemas
├── supabase/migrations/          # 6 archivos SQL
└── package.json
```

---

## Requisitos Previos

- **Node.js** >= 18
- **npm** >= 9
- **nmap** instalado en el servidor del agent (para escaneo de red)
- Cuenta **Supabase** (free tier)
- API Key de **Groq** (gratis en console.groq.com)
- API Key de **Resend** (opcional, para emails)

---

## Variables de Entorno

### Frontend (`.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key de Supabase | `eyJ...` |
| `VITE_AGENT_URL` | URL del agent backend | `http://localhost:3001` |

### Agent (`agent/.env`)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `SUPABASE_URL` | URL de tu proyecto Supabase | Si |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) | Si |
| `GROQ_API_KEY` | API key de Groq | Si |
| `RESEND_API_KEY` | API key de Resend | No |
| `RESEND_FROM_EMAIL` | Email remitente verificado | No |
| `PORT` | Puerto del agent (default: 3001) | No |
| `AGENT_ALLOWED_ORIGIN` | CORS origin (default: localhost:8080) | No |
| `AGENT_INTERNAL_SECRET` | Secreto para endpoints internos | No |
| `VITE_APP_URL` | URL del frontend (para links en emails) | No |

---

## Instalación

```bash
# 1. Clonar e instalar frontend
cd "proyecto s.h.s"
npm install

# 2. Instalar agent
cd agent
npm install
cd ..

# 3. Configurar variables de entorno
cp .env.example .env
cp agent/.env.example agent/.env
# Editar ambos .env con tus valores

# 4. Ejecutar migraciones en Supabase
# Ir a SQL Editor en dashboard.supabase.com
# Ejecutar en orden: 001 → 006
```

---

## Ejecución

```bash
# Terminal 1 — Frontend (puerto 8080)
npm run dev

# Terminal 2 — Agent backend (puerto 3001)
cd agent
npm run dev
```

---

## Base de Datos (Supabase)

### Tablas (12)

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Usuarios (FK auth.users, cascade) |
| `permissions` | Permisos por sección (9 secciones × 3 niveles) |
| `network_metrics` | Métricas de red (download, upload, latency) |
| `devices` | Dispositivos detectados en la red |
| `threats` | Amenazas de seguridad detectadas |
| `vulnerability_scans` | Vulnerabilidades (CVE, CVSS) |
| `activity_logs` | Log de auditoría |
| `reports` | Reportes generados (JSONB sections) |
| `email_config` | Preferencias de email por usuario |
| `scheduled_reports` | Reportes programados |
| `user_preferences` | Preferencias de UI |
| `scan_results` | Resultados de escaneo de red |

### Migraciones

Ejecutar en Supabase SQL Editor en este orden:

1. `001_enums_and_profiles.sql` — Enums, profiles, permissions, triggers
2. `002_core_tables.sql` — network_metrics, devices, threats, vulns, logs
3. `003_reports_and_scheduling.sql` — reports, email_config, scheduled_reports, prefs
4. `004_notifications.sql` — notifications con soporte broadcast
5. `005_scan_results.sql` — Tabla de resultados de escaneo
6. `006_realtime_and_rls.sql` — Publicación Realtime + RLS

### Realtime

Tablas con suscripción en tiempo real: `threats`, `network_metrics`, `activity_logs`, `notifications`, `scan_results`.

---

## RBAC (Control de Acceso)

### Roles

| Rol | Descripción |
|-----|-------------|
| `admin` | Acceso completo a todo + gestión de usuarios |
| `normal` | Acceso a la mayoría de secciones |
| `guest` | Solo lectura de dashboard y red |

### Secciones (9)

`dashboard`, `network`, `devices`, `threats`, `vulnerabilities`, `logs`, `ai_analysis`, `reports`, `settings`

### Niveles

| Nivel | Valor | Descripción |
|-------|-------|-------------|
| `none` | 0 | Sin acceso |
| `view` | 1 | Solo lectura |
| `full` | 2 | Lectura y escritura |

---

## API del Agent

### Públicos

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor |

### Autenticados (Bearer token)

| Método | Ruta | Permiso | Descripción |
|--------|------|---------|-------------|
| POST | `/api/auth/login` | — | Registra login en activity_logs |
| POST | `/api/reports/generate` | reports/full | Genera reporte (SSE) |
| POST | `/api/reports/send` | reports/full | Envía reporte por email |
| POST | `/api/ai/analyze` | ai_analysis/view | Chat con IA (SSE) |
| POST | `/api/scan/chat` | network/full | Escaneo de red por NLP |
| POST | `/api/notifications/test-email` | — | Enviar email de prueba |
| GET | `/api/notifications/email-config` | — | Obtener config de email |
| PUT | `/api/notifications/email-config` | — | Guardar config de email |

### Admin (rol admin requerido)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/users` | Listar usuarios + permisos |
| POST | `/api/admin/users/create` | Crear usuario |
| PUT | `/api/admin/users/update` | Actualizar usuario |
| PUT | `/api/admin/users/status` | Activar/desactivar usuario |
| DELETE | `/api/admin/user` | Eliminar usuario |

### Internos (x-internal-secret header)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/notifications/threat` | Crear notificación de amenaza |
| POST | `/api/notifications/vulnerability` | Crear notificación de vulnerabilidad |

---

## Scanner de Red

El scanner permite ejecutar comandos de red mediante lenguaje natural:

**Flujo:** Pregunta del usuario → Groq AI parsea intención → Validación de seguridad → Ejecución → Resultados parseados

### Comandos Soportados

`nmap`, `ping`, `traceroute`, `tracert`, `arp`, `dig`, `nslookup`, `whois`

### Restricciones de Seguridad

- Solo redes privadas (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Whitelist de comandos
- Sanitización de argumentos (sin `;`, `|`, `` ` ``, `$`, etc.)
- Rate limit: 5 escaneos/minuto por usuario
- Timeout: 60 segundos por escaneo
- Buffer máximo: 1MB

### Ejemplos de Uso

- "¿Quién está conectado a mi red?"
- "Escanea los puertos del dispositivo 192.168.1.100"
- "Haz ping a 192.168.1.1"
- "¿Qué servicios tiene el router?"

---

## Keep-Alive (Supabase Free Tier)

Supabase pausa proyectos en el free tier después de ~7 días de inactividad. El agent implementa una estrategia de doble capa para prevenirlo:

1. **Cron interno** (cada 3 horas): El agent ejecuta un ping automático a la base de datos. Si el ping falla, reintenta a los 30 segundos y registra advertencias en consola.
2. **Endpoint `/api/health`**: Cada llamada a este endpoint también ejecuta un ping real a la DB y reporta latencia y estado. Esto permite configurar un **cron externo** (UptimeRobot, cron-job.org, Render cron) que haga GET cada 3-4 horas como respaldo.

El endpoint retorna:
```json
{
  "status": "ok",
  "database": {
    "reachable": true,
    "latencyMs": 142,
    "lastScheduledPing": "2026-05-06T12:00:00.000Z"
  }
}
```

---

## Cron Jobs

| Frecuencia | Hora (UTC) | Tarea |
|------------|------------|-------|
| Cada 3 horas | :00 | **Keep-Alive**: Ping a Supabase (previene pausa del free tier) |
| Cada hora | :00 | Verificar reportes programados |
| Lunes | 08:00 | Enviar digest semanal por email |
| Diario | 03:00 | Limpiar notificaciones descartadas (>30 días) |

---

## Despliegue

### Frontend → Vercel

```bash
# Build
npm run build

# El directorio dist/ se despliega en Vercel
# Variables de entorno: configurar en Vercel dashboard
```

### Agent → VPS

```bash
cd agent
npm run build
# Configurar .env en el servidor
# Usar PM2 o systemd para mantener el proceso
pm2 start dist/index.js --name shs-agent
```

### Notas de Producción

- Cambiar `AGENT_ALLOWED_ORIGIN` al dominio de Vercel
- Cambiar `VITE_AGENT_URL` a la URL del VPS
- Cambiar `VITE_APP_URL` al dominio de Vercel (para links en emails)
- Instalar `nmap` en el VPS: `sudo apt install nmap`
- Verificar que el VPS permite ejecutar nmap (permisos)

---

## Características Principales

- Dashboard en tiempo real con métricas de red, amenazas y dispositivos
- Escaneo de red por lenguaje natural (nmap, ping, traceroute, etc.)
- Análisis de seguridad con IA (Groq/Llama 3.3)
- Generación de reportes con score de seguridad
- Notificaciones en tiempo real (amenazas, vulnerabilidades)
- Alertas por email (6 plantillas HTML en español)
- Gestión de usuarios con RBAC granular
- Interfaz amigable para todas las edades
- Tema oscuro (cybersecurity)
- Keep-alive automático para Supabase free tier
