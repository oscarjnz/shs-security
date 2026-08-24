/**
 * Tabla de rutas publicas para el prerender de HTML estatico.
 *
 * EL PROBLEMA QUE RESUELVE
 * El sitio es una SPA: Vercel sirve el mismo index.html en toda ruta y es el
 * navegador quien, ya con React montado, corrige el title, la descripcion y el
 * canonical mediante useSeo. Googlebot ejecuta JavaScript y acaba viendolo, pero
 * con retraso; y Bing, DuckDuckGo, WhatsApp, LinkedIn, X y Slack NO ejecutan
 * JavaScript. Para todos ellos /demo, /guias y cada guia eran indistinguibles de
 * la portada, con el canonical apuntando a "/". En la practica, todo lo que no
 * fuera la portada quedaba fuera de juego.
 *
 * COMO LO RESUELVE
 * Tras el build, scripts/seo-prerender.mjs toma el index.html generado por Vite
 * y escribe una copia por ruta con su propio <head> y con el texto de la pagina
 * ya dentro de #root. Vercel resuelve el sistema de archivos ANTES que los
 * rewrites, asi que esos archivos ganan sin tocar la regla comodin del SPA.
 *
 * POR QUE EL TEXTO SALE DE src/content
 * Servirle a un buscador un contenido distinto del que ve la persona es
 * cloaking, y se penaliza. Al construir este HTML desde los mismos modulos que
 * alimentan los componentes React, ambos no pueden separarse: editar el copy en
 * un solo sitio actualiza los dos. React reemplaza este marcado al montar, de
 * modo que el visitante ve la version con estilos y el rastreador el texto.
 */

import { FAQS } from "@/content/faq";
import { PLANS } from "@/content/plans";
import { GUIDES } from "@/content/guides";
import { HERO, FEATURES, STEPS, SECURITY } from "@/content/landing";

const SITE = "https://securitysmartservices.site";
const OG_IMAGE = `${SITE}/og-image.png`;

export interface PrerenderRoute {
  /** Ruta sin barra final, por ejemplo "/guias/que-es-un-cve". "/" es la portada. */
  path: string;
  title: string;
  description: string;
  ogType: "website" | "article";
  noindex?: boolean;
  jsonLd?: unknown[];
  /** Marcado semantico que se inyecta dentro de #root. */
  body: string;
}

/** Escapa texto para poder incrustarlo en HTML sin romper el marcado. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const p = (text: string) => `<p>${esc(text)}</p>`;
const h2 = (text: string) => `<h2>${esc(text)}</h2>`;
const h3 = (text: string) => `<h3>${esc(text)}</h3>`;
const ul = (items: string[]) =>
  `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

const cards = (items: { title: string; desc: string }[]) =>
  items.map((item) => `${h3(item.title)}${p(item.desc)}`).join("");

const NAV = `<nav><a href="${SITE}/">Inicio</a> <a href="${SITE}/guias">Guías</a> <a href="${SITE}/demo">Chequeo rápido</a> <a href="${SITE}/login">Iniciar sesión</a> <a href="${SITE}/signup">Crear cuenta</a></nav>`;

const ORG_REF = { "@id": `${SITE}/#organizacion` };

/* ------------------------------- Portada -------------------------------- */

const landingBody = [
  NAV,
  `<main>`,
  `<p>${esc(HERO.eyebrow)}</p>`,
  `<h1>${esc(HERO.h1)}</h1>`,
  p(HERO.lead),
  p(HERO.note),
  h2("Qué hace"),
  cards(FEATURES),
  h2("Cómo funciona"),
  cards(STEPS),
  h2("Seguridad y privacidad"),
  cards(SECURITY),
  h2("Planes"),
  PLANS.map(
    (plan) =>
      `${h3(`${plan.name} (${plan.tag}) - $${plan.price} al mes`)}${p(plan.desc)}${ul(plan.features)}`,
  ).join(""),
  h2("Preguntas frecuentes"),
  FAQS.map((item) => `${h3(item.q)}${p(item.a)}`).join(""),
  h2("Guías"),
  `<ul>${GUIDES.map(
    (g) =>
      `<li><a href="${SITE}/guias/${g.slug}">${esc(g.h1)}</a>: ${esc(g.summary)}</li>`,
  ).join("")}</ul>`,
  `</main>`,
].join("");

const landingJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "S.S.S - Security Smart Services",
    alternateName: "S.H.S - Security Home Services",
    url: `${SITE}/`,
    description:
      "Plataforma de auditoría de seguridad de red doméstica y de pequeña empresa: inventario de dispositivos, escaneo de puertos y detección de vulnerabilidades mediante un agente local.",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Windows, macOS, Linux",
    inLanguage: "es",
    publisher: ORG_REF,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...PLANS.map((plan) => plan.price)),
      highPrice: Math.max(...PLANS.map((plan) => plan.price)),
      offerCount: PLANS.length,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  },
];

/* -------------------------------- Guias --------------------------------- */

function guideBody(guide: (typeof GUIDES)[number]): string {
  const sections = guide.sections
    .map((section) => {
      const body = section.body
        .map((block) => {
          if (block.kind === "ul") return ul(block.items);
          return p(block.text);
        })
        .join("");
      return `${h2(section.heading)}${body}`;
    })
    .join("");

  const related = GUIDES.filter((g) => g.slug !== guide.slug);

  return [
    NAV,
    `<article>`,
    `<nav aria-label="Migas de pan"><a href="${SITE}/">Inicio</a> / <a href="${SITE}/guias">Guías</a></nav>`,
    `<h1>${esc(guide.h1)}</h1>`,
    p(guide.description),
    `<p>${guide.readingMinutes} min de lectura</p>`,
    sections,
    h2("Seguir leyendo"),
    `<ul>${related
      .map((g) => `<li><a href="${SITE}/guias/${g.slug}">${esc(g.h1)}</a></li>`)
      .join("")}</ul>`,
    `</article>`,
  ].join("");
}

const guideRoutes: PrerenderRoute[] = GUIDES.map((guide) => ({
  path: `/guias/${guide.slug}`,
  title: guide.title,
  description: guide.description,
  ogType: "article",
  body: guideBody(guide),
  jsonLd: [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.h1,
      description: guide.description,
      inLanguage: "es",
      datePublished: guide.datePublished,
      dateModified: guide.dateModified,
      mainEntityOfPage: `${SITE}/guias/${guide.slug}`,
      image: OG_IMAGE,
      author: ORG_REF,
      publisher: ORG_REF,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE}/guias` },
        { "@type": "ListItem", position: 3, name: guide.h1 },
      ],
    },
  ],
}));

/* ------------------------------ Tabla final ------------------------------ */

export const PRERENDER_ROUTES: PrerenderRoute[] = [
  {
    path: "/",
    title: "Auditoría de seguridad para tu red | S.S.S",
    description:
      "Descubre los dispositivos conectados a tu red, escanea puertos expuestos y detecta vulnerabilidades (CVE) con un agente local que nunca expone tu red a internet.",
    ogType: "website",
    body: landingBody,
    jsonLd: landingJsonLd,
  },
  {
    path: "/demo",
    title: "Chequeo rápido de tu conexión | S.S.S",
    description:
      "Analiza tu conexión a internet, revisa fugas de privacidad del navegador y verifica si alguna contraseña apareció en una filtración conocida. Sin crear cuenta.",
    ogType: "website",
    body: [
      NAV,
      `<main>`,
      `<h1>Chequeo rápido</h1>`,
      p(
        "Analiza tu conexión a internet actual, directamente desde tu navegador o nuestros servidores. No hace falta instalar nada ni crear una cuenta.",
      ),
      p(
        "El chequeo rápido revisa lo que se puede ver desde fuera de tu red: tu IP pública y su reputación, fugas de privacidad del navegador y si alguna contraseña apareció en una filtración conocida. Para el inventario de los dispositivos conectados a tu red hace falta el agente local.",
      ),
      `</main>`,
    ].join(""),
  },
  {
    path: "/guias",
    title: "Guías de seguridad de red | S.S.S",
    description:
      "Guías prácticas para entender tu propia red: quién está conectado a tu WiFi, qué puertos tienes abiertos y qué significa una vulnerabilidad CVE.",
    ogType: "website",
    body: [
      NAV,
      `<main>`,
      `<h1>Entiende tu propia red</h1>`,
      p(
        "Explicaciones directas, sin relleno, sobre las preguntas que aparecen cuando uno empieza a mirar en serio su red. Se leen solas, sin necesidad de instalar nada.",
      ),
      GUIDES.map(
        (g) =>
          `${h2(g.h1)}${p(g.summary)}<p><a href="${SITE}/guias/${g.slug}">Leer la guía: ${esc(g.h1)}</a></p>`,
      ).join(""),
      `</main>`,
    ].join(""),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Guías de seguridad de red",
        description:
          "Guías prácticas sobre dispositivos conectados, puertos abiertos y vulnerabilidades conocidas.",
        url: `${SITE}/guias`,
        inLanguage: "es",
        hasPart: GUIDES.map((g) => ({
          "@type": "Article",
          headline: g.h1,
          url: `${SITE}/guias/${g.slug}`,
        })),
      },
    ],
  },
  ...guideRoutes,
  {
    path: "/login",
    title: "Iniciar sesión | S.S.S - Security Smart Services",
    description:
      "Accede a tu panel de S.S.S para revisar los dispositivos, puertos y vulnerabilidades detectados en tu red.",
    ogType: "website",
    body: `${NAV}<main><h1>Iniciar sesión</h1>${p("Accede a tu panel de S.S.S para revisar los dispositivos, puertos y vulnerabilidades detectados en tu red.")}</main>`,
  },
  {
    path: "/signup",
    title: "Crear cuenta | S.S.S - Security Smart Services",
    description:
      "Crea tu cuenta de S.S.S y empieza a auditar la seguridad de tu red doméstica o de pequeña empresa con un agente local.",
    ogType: "website",
    body: `${NAV}<main><h1>Crear cuenta</h1>${p("Crea tu cuenta de S.S.S y empieza a auditar la seguridad de tu red doméstica o de pequeña empresa con un agente local.")}</main>`,
  },
];
