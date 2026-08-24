import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Clock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal } from "@/components/ui/Reveal";
import { GUIDES } from "@/content/guides";
import { useSeo } from "@/hooks/useSeo";

export function GuidesIndexPage() {
  useSeo({
    title: "Guías de seguridad de red | S.S.S",
    description:
      "Guías prácticas para entender tu propia red: quién está conectado a tu WiFi, qué puertos tienes abiertos y qué significa una vulnerabilidad CVE.",
    path: "/guias",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Guías de seguridad de red",
      description:
        "Guías prácticas sobre dispositivos conectados, puertos abiertos y vulnerabilidades conocidas.",
      url: "https://securitysmartservices.site/guias",
      inLanguage: "es",
      hasPart: GUIDES.map((g) => ({
        "@type": "Article",
        headline: g.h1,
        url: `https://securitysmartservices.site/guias/${g.slug}`,
      })),
    },
  });

  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      <div className="mx-auto max-w-4xl px-4 py-12">
        <Reveal immediate as="header" className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyber-green">
            Guías
          </p>
          <h1 className="mt-4 text-3xl font-extrabold text-foreground sm:text-4xl">
            Entiende tu propia red
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Explicaciones directas, sin relleno, sobre las preguntas que aparecen cuando uno
            empieza a mirar en serio su red. Se leen solas, sin necesidad de instalar nada.
          </p>
        </Reveal>

        <div className="mt-12 space-y-4">
          {GUIDES.map((guide, i) => (
            <Reveal key={guide.slug} delay={i * 80}>
              <Link to={`/guias/${guide.slug}`} className="block">
                <Card className="surface-glass hoverable-card group">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyber-green/10 ring-1 ring-cyber-green/25">
                      <BookOpen className="h-5 w-5 text-cyber-green" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-foreground">{guide.h1}</h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {guide.summary}
                      </p>
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                        <Clock className="h-3.5 w-3.5" />
                        {guide.readingMinutes} min de lectura
                      </p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-cyber-green" />
                  </CardContent>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={240} className="mt-12">
          <Card className="surface-glass border-cyber-green/25">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <h2 className="text-lg font-bold text-foreground">
                ¿Prefieres que lo revise una herramienta?
              </h2>
              <p className="max-w-md text-sm text-muted-foreground">
                S.S.S hace este mismo trabajo de forma continua sobre tu red y te avisa cuando
                algo cambia.
              </p>
              <Link
                to="/"
                className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-cyber-green hover:underline"
              >
                Ver cómo funciona
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
