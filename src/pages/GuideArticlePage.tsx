import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Clock, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal } from "@/components/ui/Reveal";
import { GUIDES, findGuide, type Block } from "@/content/guides";
import { useSeo } from "@/hooks/useSeo";

const SITE = "https://securitysmartservices.site";

function BlockView({ block }: { block: Block }) {
  if (block.kind === "p") {
    return (
      <p className="text-[0.95rem] leading-relaxed text-muted-foreground">{block.text}</p>
    );
  }

  if (block.kind === "ul") {
    return (
      <ul className="space-y-2.5">
        {block.items.map((item) => (
          <li
            key={item}
            className="flex gap-3 text-[0.95rem] leading-relaxed text-muted-foreground"
          >
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyber-green" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="surface-elevated flex gap-3 rounded-xl border border-cyber-green/25 p-4">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyber-green" />
      <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
    </div>
  );
}

export function GuideArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const guide = findGuide(slug);

  // Los hooks no pueden ir despues de un return condicional, asi que la guia
  // ausente se resuelve con valores de relleno y se redirige justo despues.
  useSeo({
    title: guide?.title ?? "Guía no encontrada | S.S.S",
    description: guide?.description ?? "",
    path: guide ? `/guias/${guide.slug}` : "/guias",
    ogType: "article",
    noindex: !guide,
    jsonLd: guide
      ? [
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: guide.h1,
            description: guide.description,
            inLanguage: "es",
            datePublished: guide.datePublished,
            dateModified: guide.dateModified,
            mainEntityOfPage: `${SITE}/guias/${guide.slug}`,
            image: `${SITE}/og-image.png`,
            author: { "@id": `${SITE}/#organizacion` },
            publisher: { "@id": `${SITE}/#organizacion` },
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
        ]
      : undefined,
  });

  if (!guide) return <Navigate to="/guias" replace />;

  const others = GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      <article className="mx-auto max-w-3xl px-4 py-12">
        <Reveal immediate as="header">
          {/* Migas de pan: ademas de orientar al lector, son el enlace interno que
              le dice a un buscador donde encaja esta pagina dentro del sitio. */}
          <nav aria-label="Migas de pan" className="text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              Inicio
            </Link>
            <span className="mx-1.5 text-muted-foreground/50">/</span>
            <Link to="/guias" className="hover:text-foreground">
              Guías
            </Link>
          </nav>

          <h1 className="mt-5 text-3xl font-extrabold leading-tight text-foreground sm:text-4xl">
            {guide.h1}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-foreground/70">
            {guide.description}
          </p>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Clock className="h-3.5 w-3.5" />
            {guide.readingMinutes} min de lectura
          </p>
        </Reveal>

        <div className="mt-12 space-y-10">
          {guide.sections.map((section, i) => (
            <Reveal key={section.heading} delay={Math.min(i, 3) * 60}>
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-foreground">{section.heading}</h2>
                {section.body.map((block, j) => (
                  <BlockView key={j} block={block} />
                ))}
              </section>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14">
          <Card className="surface-glass border-cyber-green/25">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <h2 className="text-lg font-bold text-foreground">
                Revisa tu red sin instalar nada
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                El chequeo rápido analiza tu conexión actual desde el navegador. Para el
                inventario completo de tu red hace falta el agente local.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  className="pressable gap-2 rounded-full bg-cyber-green px-6 font-semibold text-cyber-dark hover:bg-cyber-green/90"
                >
                  <Link to="/demo">
                    Probar el chequeo rápido
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="pressable rounded-full border-cyber-border px-6"
                >
                  <Link to="/signup">Crear cuenta</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {others.length > 0 && (
          <Reveal className="mt-12">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Seguir leyendo
            </h2>
            <div className="mt-4 space-y-3">
              {others.map((other) => (
                <Link key={other.slug} to={`/guias/${other.slug}`} className="block">
                  <Card className="surface-glass hoverable-card group">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{other.h1}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{other.summary}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-cyber-green" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </Reveal>
        )}

        <div className="mt-12">
          <Link
            to="/guias"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a las guías
          </Link>
        </div>
      </article>
    </div>
  );
}
