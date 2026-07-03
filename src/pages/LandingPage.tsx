import { Link } from "react-router-dom";
import {
  ScanSearch,
  ShieldAlert,
  Bot,
  Lock,
  Wifi,
  ArrowRight,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";
import { Reveal } from "@/components/ui/Reveal";

export function LandingPage() {
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
              Plataforma de auditoría de seguridad de red
            </p>
          </Reveal>

          {/* Tarjeta liquid glass flotante */}
          <Reveal immediate delay={90} className="mt-9">
            <div className="liquid-glass mx-auto flex h-[200px] w-[200px] flex-col justify-between rounded-2xl p-5 text-left">
              <span className="text-[13px] font-medium tracking-[0.2em] text-muted-foreground">
                [ 2026 ]
              </span>
              <div>
                <p className="text-[18px] font-semibold leading-snug text-foreground">
                  Análisis{" "}
                  <span className="font-accent text-cyber-green">local</span>
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  El agente se ejecuta dentro de tu red. El tráfico real nunca sale de ella.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Titular */}
          <Reveal immediate delay={170} className="mt-8">
            <h1 className="text-[2.5rem] font-extrabold uppercase leading-[1.04] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Auditoría de seguridad
              <br />
              para tu red
              <span className="text-cyber-green">.</span>
            </h1>
          </Reveal>

          {/* Descripcion */}
          <Reveal immediate delay={240}>
            <p className="mx-auto mt-6 max-w-[512px] text-sm leading-relaxed text-foreground/70 sm:text-base">
              S.S.S inventaría los dispositivos conectados a tu red, identifica los puertos
              y servicios expuestos y te notifica ante cambios o amenazas. Todo el análisis se
              ejecuta mediante un agente local, sin exponer tu red a internet.
            </p>
          </Reveal>

          {/* CTAs */}
          <Reveal immediate delay={320} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="pressable gap-2 rounded-full bg-cyber-green px-7 font-bold uppercase tracking-wide text-cyber-dark brand-glow-sm hover:bg-cyber-green/90"
            >
              <Link to="/demo">
                Iniciar análisis
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
              Sin registro: 5 análisis de demostración por hora. Con cuenta: análisis ilimitados, historial y reportes.
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
            <Feature
              delay={0}
              icon={<ScanSearch className="h-6 w-6 text-cyber-green" />}
              title="Inventario de dispositivos"
              desc="Identifica cada equipo conectado a tu red (teléfono, televisor, cámara, consola o dispositivo desconocido) junto con su IP, fabricante y sistema operativo."
            />
            <Feature
              delay={80}
              icon={<ShieldAlert className="h-6 w-6 text-cyber-green" />}
              title="Puertos y servicios expuestos"
              desc="Detecta servicios accesibles desde tu red, como Telnet, RDP, SMB o bases de datos, antes de que se conviertan en un vector de riesgo."
            />
            <Feature
              delay={160}
              icon={<Bot className="h-6 w-6 text-cyber-green" />}
              title="Asistente de análisis (ACi)"
              desc="Interpreta los resultados de cada análisis, explica el significado de los puertos detectados y sugiere los pasos a seguir."
            />
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
            <Step
              n={1}
              delay={0}
              title="Instala el agente"
              desc="Se instala una sola vez y ejecuta los análisis dentro de tu red. Sin él, ni la plataforma ni terceros pueden acceder a tu red local."
            />
            <Step
              n={2}
              delay={80}
              title="Ejecuta un análisis"
              desc="Desde cualquier navegador. El agente descubre los dispositivos y servicios activos en cuestión de segundos."
            />
            <Step
              n={3}
              delay={160}
              title="Recibe notificaciones"
              desc="La plataforma te avisa por correo cuando aparece un dispositivo nuevo o un puerto expuesto en tu red."
            />
          </div>
          <Reveal className="mt-10 flex justify-center">
            <Button
              asChild
              size="lg"
              className="pressable gap-2 rounded-full bg-cyber-green px-7 font-bold uppercase tracking-wide text-cyber-dark brand-glow-sm hover:bg-cyber-green/90"
            >
              <Link to="/demo">
                Iniciar análisis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-border/60 py-14">
        <Reveal as="div" className="mx-auto grid max-w-5xl gap-4 px-4 md:grid-cols-2">
          <Card className="surface-glass hoverable-card">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-cyber-green" />
                <h3 className="text-lg font-bold text-foreground">Aislamiento de datos por cuenta</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Cada cuenta dispone de su propio espacio con políticas RLS estrictas en
                Supabase. Ningún otro usuario, ni el equipo de S.S.S, puede acceder a tus
                resultados. El agente se ejecuta en tu equipo y el tráfico real nunca abandona
                tu red.
              </p>
            </CardContent>
          </Card>
          <Card className="surface-glass hoverable-card">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-cyber-green" />
                <h3 className="text-lg font-bold text-foreground">Alcance limitado a redes privadas</h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Por diseño, solo se permite el análisis de rangos privados (192.168/16, 10/8,
                172.16-31/12). Analizar redes públicas sin autorización es ilegal en numerosos
                países e infringe los términos de servicio de tu proveedor; la plataforma no lo
                permite.
              </p>
            </CardContent>
          </Card>
        </Reveal>
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
              Codigo en GitHub
            </a>
            <Link to="/login" className="hover:text-foreground">
              Iniciar sesion
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
