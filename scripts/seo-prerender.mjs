/**
 * Escribe un HTML estatico por cada ruta publica, a partir del index.html que
 * dejo Vite en dist/.
 *
 * Se ejecuta al final de `npm run build` (ver package.json). Antes de correr
 * esto, Vite empaqueta src/prerender/routes.ts en modo SSR hacia .prerender/,
 * porque ese modulo importa TypeScript y alias "@/" que Node no resuelve solo.
 *
 * El resultado por ruta es el mismo index.html con dos cambios:
 *   1. el <head> apunta a ESA pagina (title, description, canonical, og, JSON-LD)
 *   2. #root trae ya el texto de la pagina, para los rastreadores que no ejecutan
 *      JavaScript
 * El bundle de la SPA sigue siendo el mismo, asi que React monta encima con
 * normalidad y el visitante ve la version con estilos.
 *
 * Vercel resuelve el sistema de archivos antes que los rewrites de vercel.json,
 * asi que dist/guias/que-es-un-cve/index.html gana sobre la regla comodin del
 * SPA sin necesidad de tocarla.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const SITE = "https://securitysmartservices.site";
const OG_IMAGE = `${SITE}/og-image.png`;
const IMAGE_ALT = "S.S.S - Security Smart Services: auditoría de seguridad de red";

const { PRERENDER_ROUTES } = await import(
  new URL("../.prerender/routes.js", import.meta.url).href
);

const template = await readFile(join(DIST, "index.html"), "utf8");

/**
 * Reemplaza el contenido de una etiqueta meta existente, o la agrega antes de
 * </head> si el index.html todavia no la traia.
 */
function setMeta(html, attr, key, value) {
  const pattern = new RegExp(
    `(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`,
    "i",
  );
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escapeAttr(value)}$2`);
  }
  return html.replace(
    "</head>",
    `    <meta ${attr}="${key}" content="${escapeAttr(value)}" />\n  </head>`,
  );
}

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Evita que un "</script>" dentro del JSON corte el bloque antes de tiempo. */
function safeJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function buildPage(route) {
  const url = route.path === "/" ? `${SITE}/` : `${SITE}${route.path}`;
  let html = template;

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${route.title.replace(/</g, "&lt;")}</title>`,
  );
  html = html.replace(
    /(<link rel="canonical" href=")[^"]*(")/i,
    `$1${escapeAttr(url)}$2`,
  );

  html = setMeta(html, "name", "description", route.description);
  html = setMeta(
    html,
    "name",
    "robots",
    route.noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
  );

  html = setMeta(html, "property", "og:title", route.title);
  html = setMeta(html, "property", "og:description", route.description);
  html = setMeta(html, "property", "og:url", url);
  html = setMeta(html, "property", "og:type", route.ogType);
  html = setMeta(html, "property", "og:image", OG_IMAGE);
  html = setMeta(html, "property", "og:image:alt", IMAGE_ALT);

  html = setMeta(html, "name", "twitter:title", route.title);
  html = setMeta(html, "name", "twitter:description", route.description);
  html = setMeta(html, "name", "twitter:image", OG_IMAGE);

  if (route.jsonLd?.length) {
    const blocks = route.jsonLd
      .map(
        (schema) =>
          `    <script type="application/ld+json">${safeJson(schema)}</script>`,
      )
      .join("\n");
    html = html.replace("</head>", `${blocks}\n  </head>`);
  }

  // El texto va dentro de #root: React lo reemplaza al montar, pero un
  // rastreador sin JavaScript ya encuentra el contenido servido en el HTML.
  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${route.body}</div>`,
  );

  return html;
}

let written = 0;

for (const route of PRERENDER_ROUTES) {
  const html = buildPage(route);
  const target =
    route.path === "/"
      ? join(DIST, "index.html")
      : join(DIST, route.path.replace(/^\//, ""), "index.html");

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, "utf8");
  written += 1;
  console.log(`  prerender  ${route.path.padEnd(38)} -> ${target.replace(DIST, "dist")}`);
}

// Un fallo silencioso aqui significaria desplegar sin SEO y no enterarse, asi
// que se trata como error de build.
if (written === 0) {
  console.error("prerender: no se genero ninguna ruta");
  process.exit(1);
}

console.log(`\nprerender: ${written} rutas generadas`);
