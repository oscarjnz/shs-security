# CLAUDE.md — Cerebro del proyecto S.S.S / S.H.S

Este archivo es **mi memoria de trabajo** sobre este proyecto. Vivo aqui, leo de aqui, y cuando aprenda algo nuevo o cometa un error, lo escribo aqui para no repetirlo. Si alguien lee este archivo deberia entender (a) que es el proyecto, (b) quien es Oscar y como le gusta trabajar, y (c) los errores y decisiones que ya pasamos.

---

## 1. Identidad del proyecto

- **Nombre publico**: S.S.S - Security Smart Services. En el codigo y el repo aparece tambien como **S.H.S - Security Home Services** (mismo proyecto, nombre legacy del scaffold inicial).
- **Universidad**: Universidad Iberoamericana (UNIBE).
- **Asignatura**: TI3631-01-2026-3 **Proyecto Integrador II**.
- **Cuatrimestre**: 4 de mayo - semana del 10 de agosto de 2026.
- **Dominio en produccion**: `securitysmartservices.site`.
- **Equipo (4 integrantes)**:
  - Elmer Manuel Gonzalez Otaño
  - Luca Sita Rincon
  - **Oscar Osnarci Jimenez Peguero** (el usuario - dueño del repo, responsable de backend, despliegue y owner de las cuentas cloud)
  - Pedribel Pion Rijo

### En una frase

S.S.S es una plataforma tipo SIEM simplificado para auditar la seguridad de redes domesticas y de pequenas empresas. El usuario pregunta en lenguaje natural ("quien esta conectado a mi red", "escanea los puertos del router"), un **agente local** ejecuta `nmap` / `ping` / `traceroute` dentro de su red, los resultados viajan por un relay WebSocket hasta la nube, una IA (Groq/Llama 3.3) los analiza y se emiten alertas/reportes. La nube **nunca** toca directamente la red privada del usuario; eso es por diseño.

---

## 2. Arquitectura - vista alta

Modelo **hibrido nube + local**:

| Pieza | Donde corre | Que hace |
|-------|-------------|----------|
| Frontend (React 18 + Vite + TS strict + Tailwind + shadcn/ui) | Vercel | UI, dashboard en tiempo real |
| Backend agent (Express) | Render (free, hiberna a los 15 min) | API REST + SSE, cron, RBAC, email, IA |
| Relay WebSocket | Fly.io (Miami, 1 vCPU, 256 MB) | Pasarela WSS:443 entre nube y agentes locales |
| Scanner-agent | Maquina del usuario (Win/macOS/Linux) | Ejecuta nmap/ping/traceroute en la LAN |
| Base de datos | Supabase PostgreSQL (free, RLS + Realtime) | Persistencia |
| APIs serverless | `api/` en Vercel | Sync KEV, CVE, OWASP, pwned password check |
| Auth | Clerk | JWT, OAuth, registro |
| IA | Groq SDK - Llama 3.3 70B | Analisis y chat |
| Email | Resend | 6 plantillas HTML en español |

El diagrama oficial vive en [docs/diagrama-arquitectura.mmd](docs/diagrama-arquitectura.mmd) y la descripcion narrada en [docs/plan-despliegue-semana6.md](docs/plan-despliegue-semana6.md).

### Por que el modelo hibrido

Un servicio en la nube no puede alcanzar dispositivos detras del router del usuario. Para auditar una red privada hay que **estar dentro de ella**. El agente local resuelve esto manteniendo **solo conexiones salientes** (WSS:443), sin abrir puertos ni exigir reglas de firewall. Es una decision tecnica y de privacidad, no de comodidad.

---

## 3. Estructura del repo (lo esencial)

```
proyecto s.h.s/
├── src/                    Frontend React
│   ├── pages/              14 paginas (Dashboard, Threats, Vulns, Scan, Pulse, Reports, Users, Settings, etc.)
│   ├── components/ui/      shadcn/ui (~45 primitivos)
│   ├── contexts/AuthContext.tsx
│   ├── hooks/              realtime, KPIs, scan
│   └── lib/                supabase client, database.types.ts, auth utils
├── agent/                  Backend Express (submodulo en algunos commits)
│   └── src/
│       ├── index.ts        Servidor, rutas, cron
│       └── lib/            scanner, email, RBAC, schemas zod
├── relay/                  Relay WebSocket (Fly.io)
├── scanner-agent/          Binario local del usuario (Node, empaquetado por plataforma)
├── api/                    Funciones serverless de Vercel
├── supabase/migrations/    001..006 SQL (enums, tablas, reports, notifications, scan_results, realtime+RLS)
├── docs/                   Documentos academicos y diagrama
├── PROMPT_CLAUDECODE.md    Prompt de inicio que Oscar usa con Claude Code
└── README.md               Manual operativo
```

---

## 4. Funcionalidades ya construidas

Dashboard en tiempo real, ActivityLogs con filtros, ThreatDetection (severidad/estados), VulnerabilityScanner con CVSS/CVE, ScanPage (nmap por NLP), PulsePage (ping periodico + historial), ConnectedDevices (MAC/OS enrichment), AIAnalysis (chat), Reports (generar/enviar/descargar PDF/eliminar), Notifications (config email + broadcast de nuevos CVE KEV), Users (RBAC granular admin/normal/guest sobre 9 secciones x 3 niveles), Auth completo (login/registro/reset/OAuth con Clerk), Scanner-agents (instalacion, pairing por codigo, doctor, anti-doble-instancia).

**Onboarding (2026-07-03)**: `OnboardingWizard` (montado en `MainLayout`) guia al usuario nuevo sin escaner a instalar su agente (genera codigo solo, comando por SO, espera conexion en vivo). Reaparece hasta que tenga un escaner. La logica de pairing esta en `src/components/scanner/scannerPairing.tsx`, reusada por el wizard y `ConnectScannerDialog`.

**Guia de agente Offline (2026-07-03)**: `AgentStartHelp` (`src/components/scanner/AgentStartHelp.tsx`) le dice al usuario como ENCENDER su agente cuando aparece Offline, por SO (Windows: PowerShell COMO ADMINISTRADOR + `Start-ScheduledTask -TaskName SHSScanner`; mac/Linux: terminal + `shs-scanner start` / `systemctl start shs-scanner`). Se muestra en la lista de Escaneres si hay alguno Offline, y en la pagina de Scanner si no hay ninguno online o el escaneo fallo por tema de agente. El hook `useAgentStatus` decide cuando mostrarla. Prioridad: que el usuario nunca se quede confundido con un agente apagado.

**Scanner-agent v0.1.5 (2026-07-03)**: release publicado en GitHub (`oscarjnz/shs-scanner-agent`). Cambios: validacion de flags por lista negra (no mas "Argumento de nmap no permitido"), cap de salida 1MB, timeout local 20min, jitter en reconexion. El instalador (`install.ps1`, arreglado para parar la Tarea Programada antes de reemplazar el .exe) baja de `releases/latest`.

**Geolocalizacion de IP (2026-07-03)**: pagina `/geo` ("Geolocalizacion" en el nav). El usuario escribe una IP publica (o boton "Mi IP") y la ubica en un mapa Leaflet oscuro (CARTO) + ISP/ASN/ciudad/timezone + veredicto de reputacion + export JSON. Backend `api/geo/[ip].ts`: cascada geo `ipgeolocation.io` (si key) -> `ipwho.is` -> `ip-api` -> `freeipapi` (acepta el primero con coords), reputacion `AbuseIPDB` en paralelo (si key). Rechaza IPs privadas/reservadas (es geo de IPs PUBLICAS, NO el scanner de LAN). El mapa (`src/components/geo/GeoMap.tsx`) es `React.lazy` (~155KB en su propio chunk, no infla el bundle). Fase 0 respondida + detalle en `docs/geolocalizacion-plan.md`. Es la primera pieza de la iniciativa de subir el nivel visual de TODO el proyecto (ver seccion 5.2).

**Sidebar colapsable (2026-07-03)**: en `MainLayout.tsx`, boton "Contraer menu" (solo desktop) que reduce el panel de `w-64` a un riel de solo iconos (`w-16`) con tooltips a la derecha. La preferencia se guarda en `localStorage` (`sss-sidebar-collapsed`). En movil no aplica (ahi el sidebar es un drawer).

---

## 4.1 Estado al 2026-07-03 (resumen para retomar tras un /clear)

Lo hecho y desplegado en la sesion del 2-3 de julio 2026 (todo commiteado y pusheado, `tsc`/build limpios):
- **SEGURIDAD - RLS bajo Clerk: RESUELTO Y EN PRODUCCION.** Habia una fuga: el RLS estaba OFF en todas las tablas de datos y el frontend usa anon key -> cualquiera leia datos de todos. Se aplico opcion A (Clerk<->Supabase third-party auth + migracion `018_clerk_rls.sql` con policies por `auth.jwt()->>'sub'`). Verificado RLS=ON en 16 tablas. Proyecto Supabase: `shs-app` = `cpyxzcjuexxwauzcstrn`. Detalle completo en seccion 11.2 + `docs/rls-clerk-runbook.md`.
- **Bugs/performance:** ronda completa de fixes (relay no se cae por mensaje malo, maxPayload, IDOR, reaper; scanner-agent cap+timeout+jitter; backend N+1 del pulse, sweep de rate-limit; frontend `.limit()` + `useMemo`). Detalle en 11.1.
- **Scanner-agent v0.1.5 RELEASED** en GitHub (`oscarjnz/shs-scanner-agent`): valida flags por lista negra (mato el error rojo "Argumento de nmap no permitido: -PE"), +cap/timeout/jitter. Instalador `install.ps1` arreglado (paraba solo un Service; ahora para la Tarea Programada antes de reemplazar el .exe).
- **De-hardcode:** demo sin IP fija (detecta subred real), `SITE_URL` via env, version del agente unificada. Auditoria de secretos: limpia.
- **Onboarding:** `OnboardingWizard` guia a usuarios nuevos a instalar su escaner.
- **Agente Offline:** `AgentStartHelp` explica como encenderlo por SO (Windows PowerShell admin, etc.).
- **Geolocalizacion:** research hecho (seccion 5.1) + plan accionable en `docs/geolocalizacion-plan.md`. Es el proximo tema a construir (empezar por la Fase 0).

Owner de todo el cloud: Oscar. Repos: parent `oscarjnz/shs-security` (Vercel auto-deploy del frontend desde `main`), anidados `oscarjnz/sss-relay` (Fly, deploy manual `flyctl deploy`) y `oscarjnz/shs-scanner-agent` (releases con `npm run package:all` + `gh release`). Render puede auto-desplegar el `agent/` desde el parent. **relay y scanner-agent NO se auto-despliegan** (recordar avisar a Oscar).

---

## 5. Lo que aun falta (segun PROMPT_CLAUDECODE.md)

1. PDF descargable **local** del reporte (ya hay envio por email; el commit `6d7c4ed` añadio descarga, revisar si cubre todo).
2. **Correlacion automatica de eventos** en backend (ej: 5 logins fallidos -> threat). Hoy las reglas estan hardcodeadas.
3. **UI de configuracion de reglas de alerta** (tabla `alert_rules` + CRUD + pagina).

---

## 5.1 Ideas a futuro: modulos estilo OSINT-UI (propuesto 2026-07-02)

Oscar vio un proyecto tipo OSINT-UI (escritorio virtual con herramientas OSINT) y quiere evaluar llevar funcionalidades similares a S.S.S mas adelante. **No implementar todavia** sin que el lo pida explicitamente; esto es solo la lista de referencia para cuando llegue el momento.

- **Username Analyzer**: buscar un username en cientos de plataformas, marcar found/not-found/error, boton de verificacion de falsos positivos, export JSON.
- **Email Analyzer**: validez de sintaxis, MX/SPF/DMARC, riesgo de phishing (posible integracion con API de reputacion), generador de Google Dorks, export JSON.
- **Phone Analyzer**: formato internacional, pais, tipo de linea, enlaces a WhatsApp/Telegram, Google Dorks, export JSON.
- **Domain Analyzer**: WHOIS, registros DNS, subdominios validados, Google Dorks, export JSON.
- **Port Scanner "estilo OSINT"**: fast scan (100 puertos) vs complete scan (1000 puertos) sobre IP/dominio arbitrario de terceros. **Ojo**: esto choca de frente con la restriccion de S.S.S de solo escanear redes privadas propias (seccion 7). Si se implementa algun dia tendria que ser un modulo aparte, con su propio consentimiento legal explicito, separado del scanner de LAN.
- **Reputation Checker**: IP/dominio contra fuentes de threat intel (CTI), veredicto benign/malicious, Google Dorks, export JSON.
- **Metadata Extractor**: EXIF de imagenes (GPS con mapa, camara, fechas), por URL o upload, export JSON.
- **Hash Analyzer**: identificar tipo de hash (MD5/SHA-256/bcrypt/etc.) con probabilidad, link a un servicio de cracking online.

**Por que esperar**: la prioridad inmediata (pedida 2026-07-02) es estabilizar lo que ya existe (performance, usabilidad, cero bugs/crashes) antes de sumar 8 modulos nuevos que multiplicarian la superficie de bugs. Cuando Oscar de luz verde, tratar cada modulo como su propia feature con Fase 0 de preguntas (ver seccion 5), y decidir si el Port Scanner de terceros queda fuera del alcance academico/legal del proyecto.

### Research: geolocalizacion de IP tipo Geo-Recon (2026-07-03, pedido por Oscar)

Oscar quiere mostrar ubicacion fisica (coordenadas, ISP, ASN) de las IP, estilo Geo-Recon (repo Python: geo/reputacion via APIs + AbuseIPDB + nmap). Ojo de expectativas: la geolocalizacion por IP da ciudad + coordenadas aproximadas + ISP/ASN, NO una direccion de calle real. S.S.S YA tiene geo basico en `api/security-checks/network.ts` (usa ip-api.com, ipwho.is, freeipapi.com con fallback). El upgrade es la capa de presentacion (mapa con las coords + ISP + ASN) y quiza una fuente mejor de ASN.

Matriz de prioridad ponderada (factores: portal-ligero 25%, robustez/precision 20%, ISP+ASN 20%, costo/free-tier 15%, integracion JS/serverless 10%, mantenimiento 10%). Top:
- **ipwho.is** (API free HTTPS sin key) y **ip-api.com** (free sin key, pero HTTP-only en free -> proxear server-side): empatan ~4.2/5. Los dos ya estan en uso. Mejor punto de partida.
- **ipgeolocation.io** (key, 1k/dia) e **IPinfo Lite** (mmdb self-host free, fuerte en ASN pero solo pais, sin ciudad/coords): ~4.0/5. Buenos como enriquecimiento/fallback de ASN.
- **MaxMind GeoLite2** (mmdb, ciudad+coords, via npm `maxmind`) 3.35 y **DB-IP Lite** (mmdb CC-BY) 3.05: robustos y offline, pero ~60MB, no aptos para el bundle del frontend ni para Vercel serverless; solo tendrian sentido en el backend persistente de Render.

**Recomendacion para S.S.S (portal ligero + free tier):** quedarse API-based (no meter una DB de 60MB en el bundle). Primario ipwho.is para coords+ISP+ASN, fallback ip-api (server-side) + ipgeolocation.io para huecos, y renderizar un mapa (Leaflet/estatico) con las coords. Si algun dia se necesita offline/alto volumen, mover el geo al backend de Render con MaxMind/DB-IP via `maxmind`. NO es un modulo Python como Geo-Recon (no embebible en un portal JS); Geo-Recon sirve de blueprint de features, no de dependencia.

**PLAN LISTO PARA RETOMAR:** el plan accionable completo (pasos de implementacion, Fase 0 de preguntas, archivos a tocar) esta en [docs/geolocalizacion-plan.md](docs/geolocalizacion-plan.md). Al retomar tras un /clear, empezar por ahi + responder la Fase 0 con Oscar antes de codear. Ya existe geo basico reutilizable en `api/security-checks/network.ts` (ip-api/ipwho/freeipapi con fallback).

Si Oscar pide trabajar en estas brechas, **no escribir codigo sin antes responder las preguntas de Fase 0** del PROMPT_CLAUDECODE.md.

---

## 5.2 Iniciativa: subir el nivel visual de TODO el proyecto (2026-07-03)

Oscar quiere que S.S.S "no se vea tan plano ni tan basico". La referencia que dio es un prompt de landing "CodeNest" (hero dark high-end: video HLS de fondo, overlays de gradiente, grid vertical fino, glow central SVG, tarjeta "liquid glass" con borde via mask-composite, tipografia Inter extrabold + serif italica de acento, CTA pill, eyebrow). Lo clave, textual: quiere ese mismo **ESTILO** en todo el proyecto, "conservando sus colores y escencia" (verde cyber `142 71% 45%`, dark, ver `src/index.css` que YA tiene `.surface-glass`, `.brand-glow`, `.gradient-text-brand`, `.bg-grid-fade`, easings custom), pero mas pulido y menos plano. NO copiar CodeNest tal cual: adaptarlo.

**PILOTO HECHA Y DESPLEGADA (2026-07-03, commit `1af0bb8` en main).** Piloto elegida: **Dashboard completo**, migrado entero al estilo high-end como vara de medir. Decisiones de arranque de Oscar: piloto interna, "sistema actual + animaciones ricas" (nada de video/assets pesados), app logueada primero, acento serif con moderacion.

Cimientos nuevos y **reusables** (usarlos al propagar, no reinventar):
- Fuente **Instrument Serif** italica en `index.html` + utilidad `.font-accent` en `index.css` para el acento editorial.
- Componente `<Reveal>` (`src/components/ui/Reveal.tsx`): entrada por scroll con stagger (prop `delay`), IntersectionObserver puro (cero deps), `immediate` para above-the-fold, respeta `prefers-reduced-motion`.
- Ya existian: `.surface-glass`, `.surface-elevated`, `.hoverable-card` (glow del hover ya moderado), `.brand-glow`, `.gradient-text-brand`, `.bg-grid-fade`, `.pressable`.
- Patron de migracion: contenedores -> `surface-glass`; sub-tiles anidados -> `surface-elevated`; secciones envueltas en `<Reveal>` a nivel de pagina.

**Reglas de gusto de Oscar (INNEGOCIABLES al propagar, salieron de calibrar la piloto):**
- Serif de acento SOLO como firma puntual (ej. nombre del saludo), NO en cada titulo. Serif + `text-cyber-green`, **sin** `gradient-text-brand` encima (serif+gradiente juntos le parecio recargado).
- Glow presente pero que **no sobresalga mas que la propia tarjeta**. Nada de exageraciones.
- Nada de bloques decorativos de icono-con-halo al lado de titulos/nombres: los ve mal y molestan. Titulo/nombre solo.

**ROADMAP acordado (2026-07-03):**
1. **PROXIMO:** propagar este lenguaje al RESTO de las paginas de la app logueada (Dispositivos, Amenazas, Vulnerabilidades, Scan, Pulse, Reports, Users, Settings, etc.) y subir TODO a GitHub de una vez.
2. **DESPUES:** recien ahi, el rediseno de la landing.

- **Landing (`src/pages/LandingPage.tsx`): rediseno DIFERIDO** hasta terminar de propagar el estilo a la app (paso 2 del roadmap). Cuando se retome: menos comercial, mas descriptivo del producto, visual y que "venda" desde el producto. Hoy la landing esta plana (clases `bg-cyber-*` legacy, cero glass/glow/reveal). El video HLS del prompt (stream de Mux ajeno) NO se usa tal cual; decidir con Oscar si va video propio, animacion, o solo el sistema de glows/grid existente.
- **Primera pieza ya hecha (antes de la piloto):** el modulo de geolocalizacion (`/geo`) se construyo con este espiritu (mapa oscuro, tarjetas elevadas, glows).
- **Como aplicar:** iniciativa transversal. Cimientos ya estan; ahora es propagar. Preguntar antes de meter video/assets pesados (bundle Vercel). Mantener espanol, sin em-dash, `tsc -b` limpio. Oscar dijo que viene con mas ideas de esto.

---

## 6. Convenciones del proyecto (no romper)

- **TypeScript strict**: correr `tsc -b` despues de cambios significativos.
- **Idioma**: toda la UI en **español**. Mantener acentos en titulos visibles (commit `a494205` lo corrigio).
- **Sin em-dash** en el codigo (commit `272526f` los elimino a proposito).
- **Migraciones SQL**: numerar correlativo. Nuevas van como `007_`, `008_`...
- **Rutas nuevas en el agent**: seguir patron `requireAuth` + `requirePermission(seccion, nivel)` + `validateBody(zodSchema)` que ya existe en `agent/src/index.ts`.
- **Tipos de Supabase**: usar `src/lib/database.types.ts` para cualquier acceso a tablas.
- **RBAC**: roles `admin` / `normal` / `guest`. Secciones: dashboard, network, devices, threats, vulnerabilities, logs, ai_analysis, reports, settings. Niveles: none(0) / view(1) / full(2).
- **Auth**: el proyecto **migro de Supabase Auth a Clerk**. Los `user_id` en `agents`, `pairing_codes`, `scan_jobs` son **TEXT** (no UUID) porque Clerk usa IDs propios (commit `41dbf0a`).
- **Token de Clerk**: pedir fresco por peticion, no cachear (commit `a711903`).

---

## 7. Restricciones de seguridad del scanner

Estas reglas son **innegociables**, son la razon por la que el agente es seguro:

- Solo redes privadas: `192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`. Nada de internet.
- **Whitelist** de comandos: nmap, ping, traceroute/tracert, arp, dig, nslookup, whois.
- Sanitizacion: prohibir `;`, `|`, `` ` ``, `$`, redirects, subshells.
- Rate limit: 5 escaneos/minuto por usuario (privado); 1/hora (target publico consentido).
- Timeout y buffer (valores REALES en codigo, confirmados con Oscar el 2026-07-02):
  - Backend `agent/src/lib/scanner.ts`: 60 min privado / 2 h publico, buffer 16 MB. Configurables por env (`SCAN_PRIVATE_TIMEOUT_MS`, `SCAN_PUBLIC_TIMEOUT_MS`, `SCAN_MAX_OUTPUT_BYTES`). Son holgados a proposito: perfiles como `full_tcp` (~15 min) o `aggressive` necesitan minutos, un limite de 60s los romperia.
  - Scanner-agent `scanner-agent/src/scanner.ts`: cap de salida 1 MB (`SHS_SCAN_MAX_OUTPUT_BYTES`) + timeout local 20 min (`SHS_SCAN_TIMEOUT_MS`).
  - (El "60s / 1MB" que decia antes esta doc era una meta idealizada, nunca fue el valor real. No re-forzar 60s sin quitar los perfiles largos.)
- Contenedor del agente: usuario **no-root**.

Si propongo bajar cualquiera de estas, estoy haciendolo mal.

---

## 8. Despliegue y operacion - puntos sensibles

- **Render free hiberna** a los 15 min. Mitigacion: keep-alive interno + cron externo (UptimeRobot / cron-job.org) cada 3-4 h.
- **Supabase free pausa** el proyecto a los ~7 dias sin actividad. Mitigacion: cron interno cada 3 h ejecuta ping real a DB; y el endpoint `/api/health` tambien hace ping (sirve de respaldo externo).
- **Free tier no incluye PITR**: backups manuales por `pg_dump` periodico, almacenados fuera de la plataforma.
- **Vercel**: rewrites `/api/agents/*` y `/api/health` apuntando al backend de Render (commit `287349a`).
- **Owner unico** de paneles cloud (Vercel/Render/Fly.io/Supabase): **Oscar**. Los demas son colaboradores.
- **Cache de install/uninstall scripts**: no cachear (commit `70b1ef0`); si no, los usuarios reciben versiones viejas con 404.
- **Instaladores Windows**: usar `New-Service` (commit `b95a8eb`). Tarea Programada para arranque permanente (commit `fdee818`). Salida solo ASCII.
- **macOS**: firma ad-hoc, mejor diagnostico, recheck de VPN (commit `8b69bbb`).
- **`AGENT_INTERNAL_SECRET`** y **`RELAY_INTERNAL_SECRET`** solo en backend y relay. **Nunca** en el frontend ni en el repo.
- **`service_role_key` de Supabase**: solo backend y relay. El frontend usa anon key.
- **Env keys OPCIONALES de geo (Vercel)**: `IPGEOLOCATION_API_KEY` (mejor ASN/ISP) y `ABUSEIPDB_API_KEY` (activa la reputacion en `/geo`). Sin ellas el modulo de geolocalizacion funciona igual con ipwho.is/ip-api; solo pierde la reputacion. Pendiente que Oscar las pegue.

---

## 9. Comandos utiles

```bash
# Frontend dev (puerto 8080)
npm run dev

# Agent dev (puerto 3001)
cd agent && npm run dev

# Build completo
npm run build              # tsc -b && vite build

# Git submodulo del agente
git submodule update --init --recursive
git submodule update --remote agent   # bump al ultimo tag

# Deploy relay
cd relay && flyctl deploy

# Empaquetar scanner-agent
cd scanner-agent && npm run package:all
```

---

## 10. Como es Oscar y como prefiere trabajar

> Esto es lo mas importante de este archivo. Si Oscar me pide algo, debo responder y trabajar como el lo haria.

### Estilo de comunicacion

- Escribe en **español dominicano natural**, conversacional, sin formalismos academicos.
- Usa frases largas, con comas, encadenadas. No bullets cuando explica una idea.
- Le gusta repetir para enfatizar ("tooooodo lo que sabes", "casi como si fueses yo").
- A veces hay **typos**: "nececito" por "necesito", "haya error alguno". **No corregirlos en lo que el escribe**, solo respetar.
- No usa em-dash (`—`). Si yo los uso al escribir para el, los reemplazo por guion normal, dos puntos o parentesis.
- Da contexto antes de pedir. Define el rol que quiere que yo cumpla ("seras mi cerebro").
- Cuando quiere humanizar un texto, lo dice. Cuando quiere algo academico/formal, tambien.
- Cuando me pide que le pregunte algo, **le pregunto**. No asumo.

### Como decide

- **Practico**, no academico de adorno. Si una decision sirve para que el proyecto funcione en free tier y entregue a tiempo, se queda.
- Le importa que las cosas **funcionen en produccion real** con un dominio real, no solo en localhost.
- Prefiere arreglar el **root cause**, no parches. Cuando hay bugs (commits `fix(...)`) suelen ir al fondo del problema.
- Asume **ownership**: cuando algo se rompe en cloud, es problema suyo porque el es el owner.
- Le gusta dejar **rastro escrito**: el `PROMPT_CLAUDECODE.md` y los docs del proyecto son evidencia de eso.

### Como me pide que trabaje yo

- Que **lea antes de escribir**. Que entienda el contexto del repo antes de proponer.
- Que **pregunte cuando haya dudas**, especialmente en decisiones de arquitectura.
- Que **no rompa el build** (`tsc -b` despues de cambios).
- Que **respete el español** en la UI.
- Que **no invente** cosas que no sabe. Mejor preguntar.
- Que cuando me dice "humaniza", lo haga sonar como **el escribiendo**, no como un modelo escribiendo bonito.
- **COMMITEAR SIN PREGUNTAR** (norma dada el 2026-07-02). Oscar NO quiere que le pida permiso para cada commit. Hago el commit y ya, incluido push a `main` cuando aplique (Vercel despliega el frontend desde `main`). Solo pregunto antes si es algo **muy muy peligroso** (ej. borrar datos de produccion irreversible, rotar secrets, algo que tumbe el servicio sin rollback). Un commit normal, aunque toque produccion via deploy, NO se pregunta: se hace con confianza. Al commitear, stagear SOLO los archivos que yo toque; NUNCA `git add -A`/`git add .` porque el repo tiene basura sin trackear en `.agents/skills/**` que no es del proyecto.
- **No esperar que me de tantas ordenes.** Oscar quiere que yo maneje y avance, no que me detenga en cada paso a pedir confirmacion. Actuar como el lead tecnico que soy aqui: leer, decidir, ejecutar, dejar rastro. Preguntar solo cuando de verdad hay una bifurcacion que cambia el resultado y no puedo resolverla yo.

### Su rol en el equipo

Backend, despliegue, infraestructura cloud, autenticacion, scanner-agent, relay e instaladores multiplataforma. En la practica es el **lead tecnico** del proyecto.

---

## 11. Lecciones aprendidas (y errores que NO repetir)

Aqui voy añadiendo cosas que aprendi por experiencia en este repo. Cada vez que me equivoque o que Oscar me corrija, escribo aqui.

- **No cachear scripts de install/uninstall** en CDN. Si lo haces, los usuarios reciben binarios viejos con 404 (commit `70b1ef0`).
- **Clerk IDs no son UUID**. Si meto columnas `user_id` como UUID con autenticacion Clerk, rompe todo (commit `41dbf0a`). Usar `TEXT`.
- **No cachear el token de Clerk** entre peticiones del frontend. Pedirlo fresco (commit `a711903`).
- **Acentos en español** se rompen si no se cuida el encoding de los archivos fuente (commit `a494205`). UTF-8 sin BOM.
- **nmap con `-Pn`** genera "hosts fantasma". Hay que deduplicar y descartar (commit `634237d`).
- **Anti-doble-instancia** en el scanner-agent: si el usuario arranca dos veces, los WS pelean. v0.1.4 lo arregla; si añado features al agente, no romper esa proteccion.
- **Em-dash (`—`) prohibido** en el codigo. El commit `272526f` los elimino a proposito; no reintroducirlos.
- **Vulnerabilidades hardcoded**: borradas en `e5b4f2a`. Las vulnerabilidades reales vienen de scan; no volver a sembrar demos.
- **Notificaciones**: solo eventos reales + broadcast en nuevos CVE de KEV (commit `e5b4f2a`). No notificar por notificar.
- **RLS con Clerk NO funciona con `auth.uid()`**. Las policies escritas como `USING (auth.uid() = user_id)` (migraciones 002/005) quedaron muertas al migrar a Clerk: el frontend usa la anon key sin token de Clerk, asi que `auth.uid()` siempre es NULL. No asumir que RLS protege los datos por-usuario solo porque las policies existen; hay que verificar que la identidad realmente llega a la base. Detalle completo y opciones en seccion 11.2 (2026-07-02).
- **Un filtro `user_id` en el cliente NO es seguridad**. Con anon key el `user.id` lo pone el navegador y es falsificable. La frontera de seguridad va en la base (RLS con el sub de Clerk) o en el backend autenticado, nunca en un `.eq()` del frontend.
- **Validacion de flags de nmap: lista NEGRA, no lista blanca de flags exactos** (2026-07-02). El scanner-agent rechazaba flags legitimos de los perfiles (`-PE`/`-PP`/`-PM`/`-PS`/`-PA`/`-PU` del descubrimiento, `-F`, `-p-`) con "Argumento de nmap no permitido" en rojo, porque tenia una lista blanca de flags EXACTOS que se rompia con cada perfil nuevo. Ahora usa el mismo criterio que el backend: formato valido + lista negra de peligrosos + `--script` a categorias seguras. Si agrego perfiles con flags nuevos, NO hay que tocar la validacion.
- **nmap distingue mayus/minus: la lista negra de flags DEBE ser case-sensitive.** Con `/i` la regex `/^-o[NXGAS]?$/` bloqueaba `-O` (deteccion de SO) confundiendola con `-oN` (salida a archivo); igual `-D` (decoys) vs `-d` (debug). Nunca usar `/i` en la blacklist de flags. Corregido en scanner-agent y backend.

---

## 11.1 Auditoria de bugs/performance (2026-07-02)

Oscar pidio una pasada completa buscando fallos, lentitud y crashes antes de sumar features nuevas (ver 5.1). Se audito con 3 agentes en paralelo (backend, frontend, relay+scanner-agent). Punch list para ir resolviendo, mas severo primero. Ninguno de estos fue corregido todavia, solo detectado.

**Backend (`agent/`)**
- `agent/src/lib/scanner.ts:62-64`: los limites reales son 60 MIN / 2 HORAS de timeout y 16 MB de buffer por defecto (via env vars), no los 60s/1MB que dice la seccion 7 de este archivo. Contradice una regla "innegociable". Revisar si es un bug o si la seccion 7 quedo desactualizada, y alinear una de las dos.
- Mapas de rate-limit en memoria que nunca borran llaves vacias: `demoRateMap` (`index.ts:206`, endpoint publico `/api/demo/scan` sin auth) y `privateRateMap`/`publicRateMap` (`scanner.ts:68-69`). Leak lento pero real en Render free tier.
- N+1: `pulse.ts:154-171` actualiza cada dispositivo con `await` secuencial dentro de un loop que corre cada 60s (cron de pulse). `index.ts:978-1007` hace 2 queries por dispositivo en `/api/pulse/devices` (100 queries para 50 dispositivos en un solo load).
- Errores crudos de Supabase/Resend se mandan tal cual al cliente en varios handlers (`index.ts:668,1042,1185,1863,2036,2067`) via `fail(res,500,err.message)`.
- `/api/notifications/email-config` PUT (`index.ts:2048-2070`) es la unica ruta mutante sin `validateBody(zodSchema)`, rompe la convencion del proyecto (seccion 6).
- `requireAdmin` (`index.ts:154-178`) usa `.then(onFulfilled, onRejected)` en vez de async/await; un throw dentro de `onFulfilled` no lo atrapa `onRejected`.
- CORS (`index.ts:100-115`) confia con `credentials:true` en cualquier origen que matchee IP privada, no solo la del usuario dueño; revisar si es a proposito.
- Confirmado OK: token de Clerk se pide fresco en `requireAuth` (no se reintrodujo el bug de `a711903`), scanner usa `spawn()` con argv (no shell), whitelist/CIDR intactos, redencion de `pairing_codes` bien protegida contra carrera.

**Relay + scanner-agent**
- **Critico**: `relay/src/index.ts:254-324`, el handler `ws.on("message", async...)` solo envuelve el `JSON.parse` en try/catch. Cualquier `await` posterior (updates a Supabase) que rechace se vuelve una unhandled promise rejection, y Node mata **todo el proceso del relay** por un solo mensaje malo de un solo agente, tumbando a todos los agentes conectados a la vez.
- `WebSocketServer` (`relay/src/index.ts:218`) no define `maxPayload`; por defecto la libreria `ws` permite 100MB por mensaje, y el relay corre en una instancia de 256MB de Fly.io. Riesgo real de OOM.
- `scanner-agent/src/scanner.ts:88-103`: acumula stdout/stderr sin limite de tamaño (contradice el "1MB max" de la seccion 7) y no tiene timeout local propio; depende de que el relay mande un `cancel`, cosa que el `JOB_TIMEOUT_MS` (30 min) de `relay/src/index.ts:33,140-156` nunca hace, solo marca el job como `expired` en la DB mientras el scan sigue corriendo en la maquina del usuario.
- No hay reaping de peers muertos: se manda `ws.ping()` cada 30s y se actualiza `lastSeenAt` en el pong, pero nada lee ese valor para cerrar sockets zombis (`registry.ts` + `index.ts:248-252`). Una conexion half-open (laptop se duerme, wifi cae sin FIN limpio) queda "online" indefinidamente.
- `scan_progress`/`scan_result`/`scan_error` (`index.ts:278-319`) actualizan por `jobId` sin verificar que el agente que manda el mensaje sea el dueño del job (`agent_id === auth.agentId`). IDOR menor.
- Reconexion del scanner-agent (`relay-client.ts:190`) usa backoff exponencial sin jitter; si el relay se reinicia, todos los agentes conectados reintentan casi en el mismo instante (thundering herd).
- Anti-doble-instancia (`scanner-agent/src/index.ts:46-67`, probe de puerto 127.0.0.1:47878) esta bien para el caso de crash-y-reinicio, pero el timeout del probe es de 800ms; bajo carga pesada podria dar falso negativo y permitir doble arranque. No esta roto, pero es fragil.

**Frontend (`src/`)**
- Queries sin `.limit()` sobre tablas que van a crecer todo el cuatrimestre: `ThreatDetectionPage.tsx:85-95` (tabla `threats` completa), `VulnerabilityScannerPage.tsx:39-50` (`vulnerability_scans`), `ConnectedDevicesPage.tsx:67-77` (`devices`). Con mas uso real esto se va a poner lento o a colgarse. `useRealtimeQuery.ts` si limita `threats`/`activity_logs`/`network_metrics`, pero estas paginas no reusan ese hook.
- El `queryFn` de `useRealtimeQuery.ts` (lineas 17-22, 54-58, 90-95) y de `ThreatDetectionPage.tsx:88-92` no filtran por `user_id` en el fetch inicial, aunque el canal realtime de al lado si filtra `user_id=eq.${user.id}`. Si el RLS de Supabase no esta perfecto en esas tablas, el fetch inicial podria traer filas de otros usuarios. Hay que verificar las policies de RLS directamente, no asumir que el codigo cliente es la unica proteccion.
- `ActivityLogsPage.tsx:130-138` re-arma un Map de hasta 600 filas y las ordena en cada render (sin `useMemo`), incluso al solo abrir un dialog de detalle.
- `useDemoScan.ts:240` hardcodea `192.168.1.0/24` para el scan de la pagina `/demo` publica. Cualquier visitante con router en otro rango (`192.168.0.x`, `10.x.x.x`, etc., muy comun) ve la demo sin dispositivos y sin explicacion. Esto es la primera impresion para evaluadores, prioridad alta.
- `useNotifications.ts:30-37` suscribe el canal realtime a toda la tabla `notifications` sin filtro de `user_id` (aunque las mutaciones si filtran). Confirmar si es a proposito (broadcast de KEV) o descuido.
- `ScannerAgentsPage.tsx:114-117` hace polling cada 15s sin pausar cuando la pestaña esta en segundo plano.
- Confirmado OK: ningun canal realtime se quedo sin `removeChannel` en el cleanup, `getToken()` se pide fresco en todos lados, no se reintrodujeron vulnerabilidades hardcoded.

### Estado tras la sesion del 2026-07-02 (que se arreglo)

Se corrigieron todos los bugs que no arriesgaban sacar el proyecto de produccion. Los 4 paquetes compilan limpio (`tsc --noEmit` en relay/scanner-agent/agent y `tsc -b` en frontend).

**Resuelto:**
- Relay ya no se cae por un mensaje malo: todo el handler `ws.on("message")` va dentro de try/catch (`relay/src/index.ts`). Un rechazo de Supabase o un msg raro ya solo afecta a ese agente, no tumba el proceso.
- `maxPayload` de 4MB en el `WebSocketServer` del relay (env `RELAY_MAX_WS_PAYLOAD`). Corta el vector de OOM por frame gigante.
- IDOR cerrado: los updates de `scan_progress`/`scan_result`/`scan_error` ahora filtran `.eq("agent_id", auth.agentId)`.
- Reaper de sockets muertos en el relay: `registry.reapStale()` + interval de 30s, mata conexiones half-open sin señal >90s (env `RELAY_REAP_IDLE_MS`).
- Scanner-agent: cap de 1MB de salida acumulada (env `SHS_SCAN_MAX_OUTPUT_BYTES`) + timeout local de 20 min (env `SHS_SCAN_TIMEOUT_MS`) en `scanner.ts`. Antes podia correr indefinido y acumular sin limite.
- Jitter ±30% en el backoff de reconexion del scanner-agent (`relay-client.ts`), mata el thundering herd cuando el relay reinicia.
- Backend: sweep periodico de los mapas de rate-limit (`startRateLimitSweep` en `scanner.ts`, cada 5 min) y del `demoRateMap` (`index.ts`, cada 10 min). Mata el leak lento.
- N+1 del pulse: `pulse.ts` ahora hace 3 updates por lotes (`.in("id", [...])`) en vez de 1 update por dispositivo cada 60s.
- Mensaje de truncado honesto en `agent/src/lib/scanner.ts` (usaba "1MB" hardcodeado; ahora refleja el valor real de `MAX_OUTPUT_BYTES`).
- Frontend: `.limit(500)` en las queries de Threats/Vulns/Devices; `useMemo` en el merge+sort de `ActivityLogsPage`.

**Decisiones de Oscar del 2026-07-02 (ya aplicadas):**
- Timeout/buffer del scanner: se MANTIENEN los valores actuales (60min/2h/16MB backend, 1MB/20min agente). Solo se actualizo la seccion 7 para que refleje la realidad y deje de mentir con "60s/1MB".
- Subnet del demo: RESUELTO Y ENDURECIDO (2a pasada). Ya no queda NINGUNA IP hardcodeada ni fallback. `detectMode()` en `useDemoScan.ts` solo entra en modo "lan" si el backend local detecta una subred privada real (via `GET /api/demo/local-subnets`), y guarda esa subred en el estado; si no hay, usa modo cloud (que siempre funciona). El usuario nunca ve un error. Ademas `/api/demo/scan` en el backend autoresuelve la subred desde `listLocalPrivateSubnets()` si no le mandan target (la maquina que conoce la red decide). No se toco el binario scanner-agent v0.1.4.

### Auditoria de hardcode (2026-07-02, pedida por Oscar)

Oscar: "S.S.S no puede tener nada harcodeado". Se barrio todo el codigo. Secretos: LIMPIO (no hay claves en el repo, todo lee de env; los `pk_/sk_/eyJ` que aparecen son de `.agents/skills/**`, ajeno al proyecto). Lo accionable se arreglo:
- **IP de subred del demo**: eliminado por completo (ver arriba). Cero IP fija.
- **Dominio del sitio hardcodeado**: `agent/src/lib/email-templates.ts` y los comandos de instalacion en `agent/src/index.ts` usaban `https://securitysmartservices.site` fijo. Ahora salen de `SITE_URL` (env con default = valor actual). Un cambio de dominio se propaga con un solo env.
- **Deriva de version del agente**: `scanner-agent/src/relay-client.ts` reportaba `0.1.0` mientras `index.ts` decia `0.1.4`. Se unifico en `scanner-agent/src/version.ts` (fuente unica), importado por ambos.
- **Legitimo, se deja (no es "config hardcodeada"):** las regex de rangos privados en `scanner.ts`/`local-net.ts` (son reglas de seguridad, DEBEN vivir en codigo), las URLs de APIs de terceros (Groq, NVD, CISA KEV, HIBP, geo-IP), el puerto loopback fijo 47878 del agente, los rangos de Cloudflare en `relay/deploy/nginx.conf`, y los defaults de env-var. El `placeholder="192.168.1.0/24"` de `ScanForm.tsx` es solo texto de ejemplo del input (no un valor funcional); se puede mejorar a futuro mostrando la subred detectada.

**HALLAZGO GRAVE pendiente de decision (RLS ↔ Clerk) — ver seccion 11.2.**
Al verificar las RLS (opcion que eligio Oscar) apareció algo mas grande que un filtro de cliente. NO se toco codigo aqui a proposito: cambiarlo mal puede vaciar el dashboard en produccion o abrir/cerrar acceso a datos. Requiere decision de arquitectura.

**Otros pendientes menores (no tocados, confirmar intencion):**
- CORS con `credentials:true` para cualquier IP privada (`index.ts:100-115`).
- Broadcast de `notifications` realtime sin filtro `user_id` (`useNotifications.ts:30-37`): probablemente intencional (KEV), confirmar.

---

## 11.2 HALLAZGO GRAVE: el RLS de Supabase no protege a los usuarios bajo Clerk (2026-07-02)

**CONFIRMADO contra la base de produccion (`shs-app`, id `cpyxzcjuexxwauzcstrn`):**
Es el escenario malo (fuga de datos, no paginas vacias). Query directa a
`pg_class.relrowsecurity`: RLS **OFF** y 0 policies en `threats`, `devices`,
`activity_logs`, `vulnerability_scans`, `scan_results`, `network_metrics`,
`notifications`, `email_config`, `reports`, `scheduled_reports`,
`user_preferences`, `user_networks`, `device_pings`, `profiles` y `permissions`.
Solo `agents`/`pairing_codes`/`scan_jobs` (era Clerk) tienen RLS. Con la anon key
(publica) cualquiera lee los datos de todos. Datos era-UUID y era-Clerk conviven
(ej. devices: 259 Clerk + 297 UUID; permissions: 36 filas TODAS UUID viejo).
Hay 2 admins con id Clerk (uno es Oscar), asi que el chequeo admin por
`profiles.role` no lo deja fuera.

**Solucion elegida por Oscar: opcion A (integracion Clerk<->Supabase + RLS con
`auth.jwt()->>'sub'`). APLICADA EN PRODUCCION el 2026-07-02/03.** Estado final:
- Paso 1 (paneles): HECHO. Clerk en Production con integracion Supabase enabled;
  domain `https://clerk.securitysmartservices.site` registrado en Supabase como
  Third-Party Auth (Enabled).
- Paso 2 (frontend): HECHO. `src/lib/supabase.ts` pasa el token de Clerk via
  `accessToken` (con la integracion nativa, sin JWT template). Commit `88d90d5`
  desplegado en Vercel (deploy READY en produccion).
- Paso 3 (RLS): HECHO. Migracion `018_clerk_rls.sql` aplicada. Verificado:
  RLS = ON en las 16 tablas con policies; `authenticated` conserva los GRANT de
  tabla; anon (sin `sub`) queda bloqueado. La fuga esta cerrada.
- Rollback (si el dashboard se viera vacio): el bloque `disable row level
  security` comentado al final de `018_clerk_rls.sql`. Detalle en
  `docs/rls-clerk-runbook.md`.
- Deuda pendiente (no bloquea): datos huerfanos era-UUID quedan invisibles (no
  borrados); `permissions` sigue con filas UUID viejas (el RBAC vivo usa
  `profiles.role`); limpiar profiles viejos algun dia.

**Que pasa (los hechos verificados):**
- El cliente Supabase del frontend (`src/lib/supabase.ts:14`) se crea SOLO con la `anon key`. Nunca se le adjunta un token de Clerk (no hay `accessToken`, ni `global.headers.Authorization`, ni `realtime.setAuth`). Todos los `getToken()` del frontend son para llamar al **backend** (`AGENT_URL`), no a Supabase.
- Por lo tanto, cada `supabase.from(...).select()` directo del frontend corre como rol **anon**, con `auth.uid()` = NULL.
- Las policies RLS de las tablas de datos (`threats`, `activity_logs`, `devices`, `vulnerability_scans`, `scan_results`, `network_metrics`) son `USING (auth.uid() = user_id)` (migracion `002`, `005`). Pero el proyecto migro de Supabase Auth a **Clerk**, y con Clerk `auth.uid()` nunca se llena. `NULL = user_id` da NULL (falso).
- No hay ninguna migracion que desactive RLS ni que de acceso anon a esas tablas (solo `013` abre `cve_cache`/`kev_catalog`/`groq` con `USING (TRUE)`, que son datos publicos de referencia, eso esta bien).

**Las dos posibilidades, las dos malas:**
1. Si el RLS esta realmente activo tal como dicen las migraciones -> el rol anon no ve NINGUNA fila -> paginas como Threats/Vulns/Devices/Logs deberian salir VACIAS en produccion. Si hoy muestran datos, es porque alguien desactivo el RLS a mano en el panel de Supabase (fuera de las migraciones).
2. Si el RLS esta desactivado (o hay una policy permisiva puesta a mano) -> CUALQUIERA con la `anon key` (que va embebida en el bundle del frontend, es publica por diseño) puede leer **los datos de TODOS los usuarios**. Fuga de datos entre cuentas.

**Por que NO se puede arreglar con un `.eq("user_id", user.id)` en el cliente:**
Con la anon key no hay identidad de confianza en la base. El `user.id` de Clerk lo pone el cliente y es falsificable; un atacante simplemente omite el filtro o pone otro id. Un filtro en el frontend es cosmetico, no una frontera de seguridad. Por eso NO se agrego (la opcion "verifico primero" que eligio Oscar era la correcta: al verificar, el arreglo resulto ser de arquitectura, no de una linea).

**Opciones reales (decision de Oscar):**
- **A) Integracion Clerk <-> Supabase (JWT nativo):** configurar Clerk como third-party auth de Supabase, pasarle el token al cliente (`createClient(url, anon, { accessToken: () => getToken() })`) y reescribir las policies para leer el `sub` de Clerk (`auth.jwt()->>'sub' = user_id`) en vez de `auth.uid()`. Es la solucion correcta y estandar. Ojo: al activarla, si alguna tabla dependia de RLS-desactivado, hay que probar en staging porque las paginas pueden vaciarse hasta que las policies nuevas esten bien.
- **B) Enrutar TODAS las lecturas por el backend autenticado:** el frontend deja de tocar Supabase directo; pide los datos al backend (`agent/`), que ya valida el token de Clerk con `requireAuth` y usa el `service_role`. Mas trabajo (crear endpoints GET para cada tabla) pero centraliza la seguridad.
- **C) Aceptar el riesgo temporalmente:** documentar que es un proyecto academico y que la exposicion es conocida. No recomendado si va a haber datos reales de terceros.

**Antes de tocar nada:** confirmar en el panel de Supabase si el RLS de esas tablas esta ON u OFF hoy. Eso decide si el problema es "paginas vacias" (posibilidad 1) o "fuga de datos" (posibilidad 2), y cambia la urgencia.

---

## 12. Lo que NO esta en este archivo

- Secrets, claves, tokens. **Nunca** los escribo aqui.
- Codigo fuente. Para eso esta el repo.
- Estado de tareas del cuatrimestre. Para eso estan los entregables y el plan de despliegue.

---

_Ultima actualizacion: 2 de julio de 2026._
