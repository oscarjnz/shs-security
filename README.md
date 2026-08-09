# Security Smart Services (S.S.S.)

Dashboard de seguridad de red en tiempo real con escaneo de red por lenguaje natural, análisis de IA y notificaciones automatizadas.

## Sobre el proyecto

**Problema:** las pequeñas y medianas empresas no cuentan con personal de TI dedicado, por lo que no tienen visibilidad de lo que ocurre en su propia red: qué dispositivos están conectados, qué puertos quedan expuestos y qué vulnerabilidades (CVEs) están activas.

**Cliente:** pequeñas empresas sin equipo de TI/seguridad especializado que necesitan monitoreo de seguridad accesible, sin curva técnica alta.

**Modelo de negocio:** SaaS por suscripción, con planes según el nivel de análisis y canales de alerta requeridos.

**Cómo lo resuelve:** un agente local ejecuta el escaneo (Nmap, ping, traceroute, etc.) dentro de la propia red del cliente, sin exponerla a internet, y sincroniza los resultados con un dashboard centralizado que detecta dispositivos, identifica vulnerabilidades, genera alertas automáticas y permite consultar los eventos en lenguaje natural mediante IA.

---

## Sistema en producción

- **URL:** https://www.securitysmartservices.site
- **Acceso:** vía OAuth (Google, GitHub o Microsoft) o registro propio gratuito desde la página de login. No se requiere una credencial fija
- **Documento técnico:** ver sección [Documentación Técnica](#documentación-técnica).

---

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18.3 + Vite 5.4 + TypeScript 5.8 (strict) |
| Estilos | Tailwind CSS + shadcn/ui |
| Estado | TanStack React Query v5 + React Context |
| Base de datos | Supabase PostgreSQL (free tier) + RLS |
| Realtime | Supabase Realtime (threats, metrics, logs, notifications, scans) |
| Auth | Clerk (JWT, OAuth) integrado con Supabase como third-party auth |
| Backend | Express.js (agent server, puerto 3001) |
| Relay | Servidor WebSocket (WSS:443) entre la nube y los agentes locales |
| Agente local | Binario Node empaquetado por plataforma (`shs-scanner`) |
| IA | Groq SDK - Llama 3.3 70B |
| Email | Resend (6 plantillas HTML en español) |
| Cron | node-cron (reportes, digest semanal, limpieza, keep-alive) |
| Scanner | nmap, ping, traceroute, etc. vía child_process |

### Dónde corre cada pieza

| Pieza | Plataforma |
|-------|------------|
| Frontend + funciones serverless (`api/`) | Vercel |
| Backend Express (`agent/`) | Render |
| Relay WebSocket (`relay/`) | Fly.io |
| Base de datos | Supabase |
| Agente de escaneo (`scanner-agent/`) | Equipo del propio cliente |

El modelo es híbrido a propósito: un servicio en la nube no puede alcanzar dispositivos detrás del router del cliente, así que el escaneo lo ejecuta un agente instalado dentro de esa red, que mantiene únicamente conexiones salientes (WSS:443) hacia el relay. La nube nunca inicia una conexión hacia la red privada.

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
├── api/                          # Funciones serverless en Vercel (CVE, KEV, OWASP, geo)
├── relay/                        # Relay WebSocket (submódulo, se despliega en Fly.io)
├── scanner-agent/                # Agente local del cliente (submódulo)
├── supabase/migrations/          # 18 archivos SQL (001 → 018)
└── package.json
```

> `relay/` y `scanner-agent/` son submódulos de Git. Para clonarlos junto al proyecto:
> ```bash
> git clone --recursive https://github.com/oscarjnz/shs-security.git
> # o, si ya clonaste sin --recursive:
> git submodule update --init --recursive
> ```

---

## Requisitos Previos

- **Node.js** >= 18
- **npm** >= 9
- **nmap** instalado en el equipo donde corra el agente de escaneo
- Cuenta **Supabase** (free tier)
- Cuenta **Clerk** (free tier, autenticación)
- API Key de **Groq** (gratis en console.groq.com)
- API Key de **Resend** (opcional, para emails)

---

## Variables de Entorno

### Frontend (`.env`)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key de Supabase | `eyJ...` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key de Clerk (obligatoria) | `pk_test_...` |
| `VITE_AGENT_URL` | URL del agent backend | `http://localhost:3001` |

### Agent (`agent/.env`)

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `SUPABASE_URL` | URL de tu proyecto Supabase | Si |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) | Si |
| `CLERK_SECRET_KEY` | Secret key de Clerk (verifica el token) | Si |
| `CLERK_PUBLISHABLE_KEY` | Publishable key de Clerk | Si |
| `GROQ_API_KEY` | API key de Groq | Si |
| `RELAY_URL` / `RELAY_WS_URL` | URL del relay WebSocket | Si |
| `RELAY_INTERNAL_SECRET` | Secreto compartido con el relay | Si |
| `SITE_URL` | Dominio publico (links de correos e instaladores) | No |
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
# Ejecutar en orden: 001 → 018
```

---

## Ejecución

```bash
# Terminal 1 - Frontend (puerto 8080)
npm run dev

# Terminal 2 - Agent backend (puerto 3001)
cd agent
npm run dev
```

---

## Agente Local (Cliente)

Para que el escaneo de la red del cliente no dependa de un servidor externo ni la exponga a internet, S.S.S. distribuye un agente ligero (`shs-scanner`) que el cliente instala en su propia red y empareja con su cuenta del dashboard:

```bash
# macOS: requiere nmap
brew install nmap

# Instalación y pairing del agente
curl -fsSL https://www.securitysmartservices.site/install.sh | sudo sh
shs-scanner pair <CÓDIGO-DE-PAIRING>
```

En Windows la instalación se hace desde PowerShell como administrador:

```powershell
irm https://www.securitysmartservices.site/install.ps1 | iex
shs-scanner pair <CÓDIGO-DE-PAIRING>
```

El instalador deja el agente corriendo en segundo plano y lo registra para que arranque solo al encender el equipo, usando el mecanismo nativo de cada sistema: **launchd** en macOS, **systemd** en Linux y una **Tarea Programada** en Windows. Los resultados del escaneo local viajan al dashboard a través del relay WebSocket.

Comandos disponibles del agente:

| Comando | Descripción |
|---------|-------------|
| `shs-scanner pair <código>` | Empareja el agente con la cuenta del dashboard |
| `shs-scanner unpair` | Desvincula el agente de la cuenta |
| `shs-scanner start` | Inicia el agente |
| `shs-scanner stop` | Detiene el agente |
| `shs-scanner status` | Muestra si está emparejado y si está corriendo |
| `shs-scanner doctor` | Diagnostica la instalación (nmap, permisos, conectividad) |

---

## Base de Datos (Supabase)

### Tablas (22)

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil y rol del usuario (identificado por el ID de Clerk) |
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
| `notifications` | Notificaciones del usuario y broadcast de nuevos CVE |
| `agents` | Agentes de escaneo registrados por usuario |
| `pairing_codes` | Códigos temporales de emparejamiento del agente |
| `scan_jobs` | Trabajos de escaneo despachados al agente local |
| `device_pings` | Historial de ping por dispositivo (Pulse) |
| `user_networks` | Redes detectadas y etiquetadas por el usuario |
| `cve_cache` | Caché de CVEs consultados a la NVD (referencia pública) |
| `kev_catalog` | Catálogo KEV de CISA (referencia pública) |
| `groq_response_variants` | Variantes de respuesta del asistente de IA |
| `public_scan_audit` | Auditoría de escaneos sobre objetivos públicos consentidos |

### Migraciones

Ejecutar en Supabase SQL Editor en este orden:

1. `001_enums_and_profiles.sql` - Enums, profiles, permissions, triggers
2. `002_core_tables.sql` - network_metrics, devices, threats, vulns, logs
3. `003_reports_and_scheduling.sql` - reports, email_config, scheduled_reports, prefs
4. `004_notifications.sql` - notifications con soporte broadcast
5. `005_scan_results.sql` - Tabla de resultados de escaneo
6. `006_realtime_and_rls.sql` - Publicación Realtime + RLS
7. `007_scan_v2.sql` - Segunda versión del motor de escaneo
8. `008_devices_enrichment.sql` - Enriquecimiento de dispositivos (MAC, SO)
9. `009_oauth_profile_trigger.sql` - Creación de perfil al registrarse por OAuth
10. `010_user_networks.sql` - Redes del usuario
11. `011_auth_robust.sql` - Endurecimiento del flujo de autenticación
12. `012_device_pings.sql` - Historial de ping por dispositivo
13. `013_cve_owasp_kev.sql` - Caché de CVE, OWASP y catálogo KEV
14. `014_clean_hardcoded_vulns.sql` - Limpieza de vulnerabilidades de ejemplo
15. `015_clean_seeded_notifications.sql` - Limpieza de notificaciones sembradas
16. `016_agents_and_pairing.sql` - Agentes de escaneo y códigos de emparejamiento
17. `017_fix_agents_user_id_text.sql` - `user_id` a TEXT (los IDs de Clerk no son UUID)
18. `018_clerk_rls.sql` - Políticas RLS basadas en la identidad de Clerk

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
| POST | `/api/auth/login` | - | Registra login en activity_logs |
| POST | `/api/reports/generate` | reports/full | Genera reporte (SSE) |
| POST | `/api/reports/send` | reports/full | Envía reporte por email |
| POST | `/api/ai/analyze` | ai_analysis/view | Chat con IA (SSE) |
| GET | `/api/scan/profiles` | network/view | Perfiles de escaneo disponibles |
| POST | `/api/scan/validate` | network/view | Valida un objetivo antes de escanear |
| POST | `/api/scan/run` | network/full | Ejecuta un escaneo en el agente local |
| GET | `/api/agents` | network/view | Lista los agentes del usuario |
| POST | `/api/agents/pairing-code` | network/full | Genera un código de emparejamiento |
| POST | `/api/agents/pair` | network/full | Empareja un agente con la cuenta |
| DELETE | `/api/agents/:id` | network/full | Elimina un agente |
| GET | `/api/pulse/status` | network/view | Estado del monitoreo periódico |
| GET | `/api/pulse/devices` | network/view | Dispositivos con su último ping |
| GET | `/api/pulse/history` | network/view | Historial de latencia |
| GET | `/api/network/local-subnets` | network/view | Subredes privadas detectadas |
| POST | `/api/assistant/chat` | ai_analysis/view | Asistente conversacional (ACi) |
| POST | `/api/assistant/explain-scan` | ai_analysis/view | Explica un escaneo en lenguaje natural |
| POST | `/api/notifications/test-email` | - | Enviar email de prueba |
| GET | `/api/notifications/email-config` | - | Obtener config de email |
| PUT | `/api/notifications/email-config` | - | Guardar config de email |

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
- Rate limit: 5 escaneos/minuto por usuario en red privada; 1/hora sobre un objetivo público consentido
- Timeout en el backend: 60 minutos (red privada) y 2 horas (objetivo público consentido). Son holgados a propósito: perfiles como `full_tcp` o `aggressive` tardan minutos
- Timeout en el agente local: 20 minutos, con tope de 1 MB de salida acumulada
- Buffer máximo en el backend: 16 MB
- Todos esos límites son configurables por variable de entorno (`SCAN_PRIVATE_TIMEOUT_MS`, `SCAN_PUBLIC_TIMEOUT_MS`, `SCAN_MAX_OUTPUT_BYTES`, `SHS_SCAN_TIMEOUT_MS`, `SHS_SCAN_MAX_OUTPUT_BYTES`)
- Los comandos se ejecutan con `spawn()` y argumentos separados, nunca a través de un shell

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

### Agent → Render

El backend de `agent/` se despliega en Render y se construye con `npm run build`. Las variables de entorno se configuran en el panel de Render.

Render suspende los servicios del plan free tras 15 minutos sin tráfico. Se mitiga con el keep-alive interno más un cron externo (UptimeRobot o cron-job.org) que golpea `/api/health` cada 3-4 horas.

### Relay → Fly.io

```bash
cd relay
flyctl deploy
```

### Notas de Producción

- El frontend se despliega solo desde `main`; el relay y el agente de escaneo **no** se auto-despliegan, hay que publicarlos a mano
- Cambiar `AGENT_ALLOWED_ORIGIN` al dominio de producción
- Cambiar `VITE_AGENT_URL` a la URL del backend en Render
- Cambiar `SITE_URL` y `VITE_APP_URL` al dominio de producción (links de correos e instaladores)
- El plan Hobby de Vercel admite un máximo de **12 funciones serverless**. Cada archivo dentro de `api/` que no esté bajo `api/_lib/` cuenta como una. Al superarlo, el build compila pero el despliegue se rechaza
- `AGENT_INTERNAL_SECRET`, `RELAY_INTERNAL_SECRET` y la service role key de Supabase viven únicamente en el backend y el relay, nunca en el frontend

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

---

## Documentación Técnica

El documento técnico del proyecto (arquitectura, decisiones de diseño y los patrones de diseño de Refactoring Guru aplicados) se mantiene actualizado dentro de este repositorio: [`Documento-Tecnico-SSS.pdf`](./Documento-Tecnico-SSS.pdf).

---

## Equipo

| Nombre | Rol |
|--------|-----|
| Luca Sita Rincón | Security Analyst & AI Integration Specialist |
| Pedribel Pión Rijo | Project Manager, Scrum Master & QA Tester |
| Elmer Gonzalez Otaño | Frontend Developer & UI/UX Designer |
| Oscar Jiménez Peguero | Backend Developer & Database Administrator (DBA) |
