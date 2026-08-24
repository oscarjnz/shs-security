import { useEffect } from "react";

interface SeoOptions {
  title: string;
  description: string;
  path: string;
  ogType?: "website" | "article";
  /** Ruta absoluta dentro del sitio, por ejemplo "/og-image.png". */
  image?: string;
  /** Texto alternativo de la imagen de previsualizacion. */
  imageAlt?: string;
  /** Saca la pagina del indice de los buscadores (404, callbacks, pantallas tecnicas). */
  noindex?: boolean;
  /**
   * Datos estructurados schema.org de ESTA pagina. Se inyectan como un bloque
   * aparte del JSON-LD global de index.html y se limpian al desmontar, para que
   * al navegar dentro de la SPA no queden esquemas de la pagina anterior.
   */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = "https://securitysmartservices.site";
const SITE_NAME = "S.S.S - Security Smart Services";
const DEFAULT_IMAGE = "/og-image.png";
const DEFAULT_IMAGE_ALT =
  "S.S.S - Security Smart Services: auditoria de seguridad de red";

/** Marca los nodos que gestiona este hook, para poder actualizarlos o quitarlos. */
const MANAGED = "data-seo-managed";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute(MANAGED, "");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo({
  title,
  description,
  path,
  ogType = "website",
  image = DEFAULT_IMAGE,
  imageAlt = DEFAULT_IMAGE_ALT,
  noindex = false,
  jsonLd,
}: SeoOptions) {
  const structured = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    const imageUrl = image.startsWith("http") ? image : `${SITE_URL}${image}`;

    document.title = title;
    setMeta("name", "description", description);
    setCanonical(url);

    // Googlebot solo respeta noindex si lo ve; el resto de paginas debe decir
    // explicitamente lo contrario porque en una SPA el <meta> es compartido.
    setMeta(
      "name",
      "robots",
      noindex ? "noindex, follow" : "index, follow, max-image-preview:large",
    );

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:locale", "es_ES");
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", imageAlt);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
    setMeta("name", "twitter:image:alt", imageAlt);
  }, [title, description, path, ogType, image, imageAlt, noindex]);

  useEffect(() => {
    if (!structured) return;

    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute(MANAGED, "");
    el.textContent = structured;
    document.head.appendChild(el);

    return () => {
      el.remove();
    };
  }, [structured]);
}
