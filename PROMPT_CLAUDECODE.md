# Prompt para Claude Code — Security Smart Services (S.S.S)

## Contexto del proyecto

Eres un ingeniero de software trabajando sobre **S.S.S (Security Smart Services)**, una plataforma web de ciberseguridad tipo SIEM simplificado orientada a pequeñas empresas. Es un proyecto universitario real con código funcional.

**Stack:**
- Frontend: React 18 + TypeScript + Tailwind CSS + shadcn/ui, desplegado en Vercel
- Backend: Express.js + Node.js (carpeta `agent/`), con IA via Groq y email via Resend
- Base de datos: Supabase (PostgreSQL) con Row Level Security
- Scanner de red: Nmap real vía backend con streaming SSE

**Estado actual del proyecto — lo que YA existe y funciona:**
- Dashboard con métricas en tiempo real (KPIs, gráficas de tráfico, estado de red)
- Logs de actividad (`ActivityLogsPage`) con filtros por nivel/fuente/IP
- Detección de amenazas (`ThreatDetectionPage`) con severidad y estados
- Escáner de vulnerabilidades (`VulnerabilityScannerPage`) con CVSS y CVEs
- Scanner Nmap en vivo (`ScanPage`) con perfiles predefinidos y asistente IA
- Monitor Pulse (`PulsePage`) — ping periódico a dispositivos, historial de disponibilidad
- Dispositivos conectados (`ConnectedDevicesPage`) con enriquecimiento de MAC/OS
- Análisis con IA (`AIAnalysisPage`) — chat conversacional sobre el estado de seguridad
- Reportes (`ReportsPage`) — generación configurable + envío por email
- Notificaciones (`NotificationsPage`) — configuración de email
- Gestión de usuarios (`UsersPage`) con RBAC (admin / viewer)
- Autenticación completa: login, registro, reset, OAuth, rutas protegidas

**Lo que FALTA según la propuesta original del proyecto:**
1. Exportación de reportes en PDF descargable (hay generación por email pero no PDF local)
2. Lógica de correlación automática de eventos en el backend (ej: 5 intentos fallidos = alerta automática)
3. UI de configuración de reglas de alerta (hoy las reglas están hardcodeadas)

---

## Tu tarea

Quiero que trabajes estas tres brechas **por fases**, en orden de complejidad e impacto. Antes de escribir una sola línea de código, necesito que hagas lo siguiente:

---

## FASE 0 — Preguntas antes de comenzar (OBLIGATORIO)

Antes de proponer cualquier implementación, necesito que respondas y me preguntes lo siguiente:

### Sobre el PDF (Fase 1)
1. ¿Prefieres generar el PDF en el **frontend** (ej: jsPDF o html2pdf) o en el **backend** con Puppeteer/Playwright? Cada opción tiene implicaciones distintas de tamaño, calidad y dependencias.
2. ¿El PDF debe tener diseño visual (logo, colores corporativos de S.S.S) o puede ser un layout funcional simple?
3. ¿El usuario debe poder **previsualizar** el reporte antes de descargarlo, o descarga directo?

### Sobre correlación de eventos (Fase 2)
4. ¿Las reglas de correlación van a ser estáticas (definidas en código) o dinámicas (configurables por el usuario desde la UI)?
5. ¿Qué eventos concretos deben disparar alertas automáticas? ¿Solo intentos fallidos de login, o también puertos abiertos, IPs nuevas, latencia alta?
6. ¿Las alertas deben guardarse en la tabla `threats` existente, o necesitan su propia tabla?

### Sobre la UI de reglas (Fase 3)
7. ¿Cuánta granularidad necesita el usuario? ¿Solo umbrales numéricos (ej: "más de X intentos"), o también condiciones complejas (AND/OR entre eventos)?
8. ¿Dónde vive esta UI — en Settings, o una página propia `/alert-rules`?

### Sobre el orden y alcance
9. ¿Quieres las tres fases implementadas o solo una o dos por ahora?
10. ¿Hay alguna restricción de despliegue? (¿El backend puede instalar Puppeteer? ¿O el VPS tiene limitaciones de memoria/espacio?)
11. ¿Hay tests existentes que deba respetar o el proyecto no tiene suite de tests automatizados?

---

## FASE 1 — Exportación de PDF

**Objetivo:** Que el usuario pueda descargar el reporte como PDF con un botón en `ReportsPage`.

**Pendiente hasta responder las preguntas de Fase 0.**

Cuando respondas, implementaré:
- Si es frontend: librería `jsPDF` + `html2canvas` o `@react-pdf/renderer`
- Si es backend: endpoint `POST /api/reports/:id/pdf` que genera el PDF con Puppeteer y lo devuelve como stream

---

## FASE 2 — Correlación automática de eventos

**Objetivo:** El backend detecta patrones de riesgo y genera amenazas automáticamente, sin que el usuario tenga que revisar los logs manualmente.

**Pendiente hasta responder las preguntas de Fase 0.**

Cuando respondas, implementaré:
- Función de correlación en `agent/src/lib/correlator.ts`
- Cron job o trigger por inserción en `activity_logs`
- Inserción automática en tabla `threats` cuando se dispara una regla

---

## FASE 3 — UI de configuración de reglas de alerta

**Objetivo:** El usuario puede definir sus propias reglas desde la interfaz, sin tocar código.

**Pendiente hasta responder las preguntas de Fase 0.**

Cuando respondas, implementaré:
- Tabla `alert_rules` en Supabase con migración
- CRUD de reglas en el backend
- Página/sección en el frontend con formulario de reglas

---

## Instrucciones de trabajo

- Lee `src/App.tsx` para entender el routing antes de crear páginas nuevas
- Lee `agent/src/index.ts` antes de añadir endpoints — sigue los patrones de `requireAuth`, `requirePermission`, `validateBody` que ya existen
- Usa los tipos de `src/lib/database.types.ts` para todo lo que toque Supabase
- No rompas el build existente — corre `tsc -b` después de cada cambio significativo
- Si creas una migración de Supabase, síguela con el número `013_` o superior
- Mantén el español en los textos de UI (el proyecto está en español)

---

## Cómo empezar

Dime si el plan por fases es viable o si ves algún problema estructural antes de que responda las preguntas. Luego responde las preguntas de Fase 0 confirmando o dándome las tuyas, y arrancamos.
