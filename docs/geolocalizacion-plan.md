# Plan: modulo de geolocalizacion de IP (tipo Geo-Recon)

**Estado:** IMPLEMENTADO el 2026-07-03. Ver "Lo que se construyo" al final.
**Fecha:** 2026-07-03. Pedido por Oscar. Research completo en `CLAUDE.md` seccion 5.1.

## Respuestas de la Fase 0 (Oscar, 2026-07-03)
1. **Ubicacion:** pagina/tool dedicada en el nav lateral (`/geo`, "Geolocalizacion").
2. **Que IPs:** cualquier IP publica que el usuario escriba + boton "Mi IP".
3. **Mapa:** interactivo con Leaflet (tiles oscuros CARTO), carga diferida.
4. **Proveedores:** sumar ipgeolocation.io Y AbuseIPDB (reputacion), ambos por env.

## Lo que se construyo
- `api/geo/[ip].ts`: endpoint normalizado. Cascada geo ipgeolocation.io (si key) ->
  ipwho.is -> ip-api -> freeipapi (acepta el primero con coords). Reputacion via
  AbuseIPDB en paralelo (si key). Rechaza IPs privadas/reservadas (422) e invalidas (400).
- `src/lib/geoApi.ts`: cliente + tipos + `reputationVerdict()`.
- `src/pages/GeoLocationPage.tsx`: buscador, tarjeta de datos, veredicto de
  reputacion, export JSON, disclaimer de "aproximado".
- `src/components/geo/GeoMap.tsx`: mapa Leaflet (lazy). Pin verde cyber via divIcon
  (evita el bug de iconos PNG). Tema oscuro de controles/popup en `src/index.css`.
- Ruta en `App.tsx` + item en `MainLayout` (seccion "dashboard" = visible a todos con view).

## Env vars nuevas (Oscar las pega en Vercel; sin ellas el modulo igual funciona)
- `IPGEOLOCATION_API_KEY` (opcional): mejora ASN/ISP. Sin ella se usa ipwho.is/ip-api.
- `ABUSEIPDB_API_KEY` (opcional): activa la reputacion. Sin ella la UI dice "no disponible".

## Objetivo

Mostrar la ubicacion fisica aproximada de una IP: coordenadas (lat/lon) en un
mapa, ISP, ASN/organizacion, pais/ciudad, timezone. Como referencia visual Oscar
menciono Geo-Recon (CLI Python que ademas hace reputacion via AbuseIPDB).

**Expectativa honesta (decirla en la UI):** la geolocalizacion por IP da
ciudad + coordenadas APROXIMADAS + ISP/ASN. NO es una direccion de calle: ubica
el datacenter/ISP, no una casa. Es lo maximo que da cualquier servicio serio.

## Lo que YA existe en S.S.S (reutilizar, no reinventar)

- `api/security-checks/network.ts` ya hace enriquecimiento geo multi-proveedor
  con fallback: **ip-api.com**, **ipwho.is**, **freeipapi.com** (User-Agent de
  navegador para evitar el 403 de ipwho). Esa cadena de fallback es la base.
- Existe un "Reputation Checker" en la lista de ideas OSINT-UI (CLAUDE.md 5.1).
- El proyecto ya consume APIs de terceros server-side (patron establecido).

## Decision tecnica (de la matriz ponderada, CLAUDE.md 5.1)

**Quedarse API-based. NO meter una DB de 60MB (MaxMind/DB-IP) en el portal.**
- Primario: **ipwho.is** (free, HTTPS, sin key; da coords+ISP+ASN).
- Fallback: **ip-api.com** (server-side, HTTP-only en free) + **ipgeolocation.io**
  (free 1k/dia con key) para huecos y flags de seguridad.
- Si algun dia hace falta offline / alto volumen: mover el geo al backend
  persistente de Render con **MaxMind GeoLite2 / DB-IP Lite** via el npm `maxmind`.
  NO en Vercel serverless (limite de tamano) ni en el bundle del frontend.

## Pasos de implementacion propuestos

1. **Endpoint normalizado** (serverless Vercel, ej. `api/geo/[ip].ts`, o reusar
   la logica de `network.ts`): recibe una IP y devuelve JSON normalizado:
   `{ ip, city, region, country, countryCode, lat, lon, isp, org, asn, timezone, source }`.
   Reutilizar la cadena de fallback de `api/security-checks/network.ts`.
   Validar que sea una IP publica valida (no RFC1918, que no tiene geo util).
2. **Componente de UI** que dado ese JSON muestre:
   - Tarjeta: ISP, ASN/org, pais/ciudad, timezone.
   - Mapa con las coords. Opciones (de mas ligera a mas rica):
     a) Link "Ver en el mapa" a `https://www.openstreetmap.org/?mlat=LAT&mlon=LON`
        o Google Maps (0 dependencias, lo mas ligero).
     b) Imagen estatica de mapa (1 request).
     c) Mapa interactivo con `react-leaflet` + tiles de OpenStreetMap (mas peso;
        solo si Oscar quiere interactividad).
   - Boton "Exportar JSON" (consistente con el estilo OSINT-UI).
3. **Donde vive** (decidir con Oscar, ver Fase 0): tool dedicado "Geolocalizacion"
   / integrado en el "Reputation Checker" / en el detalle de dispositivos con IP
   publica. NO mezclarlo con el scanner de LAN (ese es solo redes privadas).

## Fase 0 (preguntas para Oscar ANTES de escribir codigo)

Por convencion del proyecto (CLAUDE.md seccion 5), no escribir codigo del modulo
sin responder primero:
1. **Ubicacion:** modulo/pagina dedicada, dentro del Reputation Checker, o en el
   detalle de dispositivos? (recomiendo una tool dedicada tipo OSINT-UI).
2. **Que IPs:** solo IPs publicas que el usuario escriba, IPs encontradas en
   escaneos, o ambas? (la geo de IP privada no sirve).
3. **Mapa:** link/estatico (ligero, recomendado para el portal) vs interactivo
   Leaflet (mas peso)?
4. **Proveedores:** OK con registrarse para una key gratis de ipgeolocation.io
   (mejor ASN + flags), o quedarnos solo con ipwho.is/ip-api sin key?
5. **Reputacion:** sumar tambien el veredicto de reputacion (como Geo-Recon con
   AbuseIPDB), o solo geo por ahora? (S.S.S ya tiene reputacion via KEV/checks;
   AbuseIPDB necesitaria key).

## Legal / seguridad

Geolocalizar IPs publicas es dato publico, sin problema legal. NO confundir con
el scanner de LAN (que es solo redes privadas propias, seccion 7). No expone PII
mas alla de ISP/ciudad. Mantener el disclaimer de "ubicacion aproximada".

## Archivos que probablemente se tocan

- `api/security-checks/network.ts` (reusar la cadena de fallback) o nuevo `api/geo/[ip].ts`.
- Nuevo componente/pagina en `src/` (+ ruta en `App.tsx` + item en `MainLayout` nav si es pagina).
- `CLAUDE.md` (registrar la feature al terminar).
