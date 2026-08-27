import { Link } from "react-router-dom";
import {
  ScanSearch,
  ShieldAlert,
  Bot,
  Lock,
  Wifi,
  ArrowRight,
  Github,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal } from "@/components/ui/Reveal";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { useSeo } from "@/hooks/useSeo";
import { FAQS } from "@/content/faq";
import { PLANS } from "@/content/plans";
import { GUIDES } from "@/content/guides";
import { HERO, FEATURES, STEPS, SECURITY } from "@/content/landing";

const FEATURE_ICONS = [
  <ScanSearch className="h-6 w-6 text-cyber-green" />,
  <ShieldAlert className="h-6 w-6 text-cyber-green" />,
  <Bot className="h-6 w-6 text-cyber-green" />,
];

export function LandingPage() {
  useSeo({
    title: "Auditoría de seguridad para tu red | S.S.S",
    description:
      "Descubre los dispositivos conectados a tu red, escanea puertos expuestos y detecta vulnerabilidades (CVE) con un agente local que nunca expone tu red a internet.",
    path: "/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "S.S.S - Security Smart Services",
        alternateName: "S.H.S - Security Home Services",
        url: "https://securitysmartservices.site/",
        description:
          "Plataforma de auditoría de seguridad de red doméstica y de pequeña empresa: inventario de dispositivos, escaneo de puertos y detección de vulnerabilidades mediante un agente local.",
        applicationCategory: "SecurityApplication",
        operatingSystem: "Windows, macOS, Linux",
        inLanguage: "es",
        publisher: { "@id": "https://securitysmartservices.site/#organizacion" },
        // Los precios los toma de PLANS para que el esquema no pueda quedar
        // desfasado de lo que muestran las tarjetas de la propia página.
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: Math.min(...PLANS.map((p) => p.price)),
          highPrice: Math.max(...PLANS.map((p) => p.price)),
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
    ],
  });

  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      {/* Hero cinematico */}
      <section className="relative isolate overflow-hidden">
        {/* Capas de fondo */}
        <div className="pointer-events-none absolute inset-0">
          {/* Lineas verticales finas (desktop) */}
          <div className="hero-grid-lines absolute inset-0 hidden sm:block" />
          {/* Grid punteado con desvanecido */}
          <div className="bg-grid-fade absolute inset-0 opacity-60" />
          {/* Glow central superior */}
          <div className="hero-glow absolute left-1/2 top-0 h-[360px] w-[min(900px,120%)] -translate-x-1/2" />
        </div>

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 pb-24 pt-20 text-center sm:pt-24">
          {/* Eyebrow */}
          <Reveal immediate>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cyber-green">
              {HERO.eyebrow}
            </p>
          </Reveal>

          {/* Titular */}
          <Reveal immediate delay={120} className="mt-10">
            <h1 className="text-[1.9rem] font-extrabold uppercase leading-[1.3] tracking-[0.05em] text-foreground sm:text-4xl lg:text-5xl">
              {HERO.h1}
            </h1>
          </Reveal>

          {/* Descripcion */}
          <Reveal immediate delay={240}>
            <p className="mx-auto mt-6 max-w-[512px] text-sm leading-relaxed text-foreground/70 sm:text-base">
              {HERO.lead}
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal immediate delay={320} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="pressable gap-2 rounded-full bg-cyber-green px-7 font-semibold text-cyber-dark brand-glow-sm hover:bg-cyber-green/90"
            >
              <Link to="/demo">
                Probar el chequeo rápido
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="pressable gap-2 rounded-full border-cyber-border px-7"
            >
              <Link to="/signup">Crear cuenta</Link>
            </Button>
          </Reveal>

          <Reveal immediate delay={380}>
            <p className="mt-4 text-xs text-muted-foreground">
              {HERO.note}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border/60 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-foreground">Qué hace</h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
              Tres funciones centrales para entender y proteger tu red.
            </p>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Feature
                key={f.title}
                delay={i * 80}
                icon={FEATURE_ICONS[i]}
                title={f.title}
                desc={f.desc}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-foreground">Cómo funciona</h2>
          </Reveal>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Step key={step.title} n={i + 1} delay={i * 80} title={step.title} desc={step.desc} />
            ))}
          </div>
          <Reveal className="mt-10 flex justify-center">
            <Button
              asChild
              size="lg"
              className="pressable gap-2 rounded-full bg-cyber-green px-7 font-semibold text-cyber-dark brand-glow-sm hover:bg-cyber-green/90"
            >
              <Link to="/signup">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-border/60 py-14">
        <Reveal as="div" className="mx-auto grid max-w-5xl gap-4 px-4 md:grid-cols-2">
          {SECURITY.map((item, i) => (
            <Card key={item.title} className="surface-glass hoverable-card">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center gap-2">
                  {i === 0 ? (
                    <Lock className="h-5 w-5 text-cyber-green" />
                  ) : (
                    <Wifi className="h-5 w-5 text-cyber-green" />
                  )}
                  <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </Reveal>
      </section>

      {/* Precios */}
      <PricingSection />

      {/* Preguntas frecuentes */}
      <FaqSection />

      {/* Guias: enlaces internos hacia el contenido que compite por busquedas
          genericas, que la landing por si sola nunca alcanzaria. */}
      <section className="border-t border-border/60 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <Reveal>
            <h2 className="text-center text-2xl font-bold text-foreground">Guías</h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
              Explicaciones prácticas sobre tu red, para leer sin instalar nada.
            </p>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {GUIDES.map((guide, i) => (
              <Reveal key={guide.slug} delay={i * 80} className="flex">
                <Link to={`/guias/${guide.slug}`} className="flex w-full">
                  <Card className="surface-glass hoverable-card group flex w-full flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-6">
                      <BookOpen className="h-5 w-5 text-cyber-green" />
                      <h3 className="text-base font-bold text-foreground">{guide.h1}</h3>
                      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                        {guide.summary}
                      </p>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyber-green">
                        Leer
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo className="h-5 w-5" />
            <span>S.S.S - Security Smart Services</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/oscarjnz/shs-security"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <Link to="/guias" className="hover:text-foreground">
              Guías
            </Link>
            <Link to="/login" className="hover:text-foreground">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="flex">
      <Card className="surface-glass hoverable-card w-full">
        <CardContent className="space-y-2 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber-green/10 ring-1 ring-inset ring-cyber-green/20">
            {icon}
          </div>
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Reveal>
  );
}

function Step({
  n,
  title,
  desc,
  delay,
}: {
  n: number;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="space-y-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyber-green/10 text-sm font-bold text-cyber-green ring-1 ring-inset ring-cyber-green/20">
        {n}
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </Reveal>
  );
}
