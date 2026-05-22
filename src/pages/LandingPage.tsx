import { Link } from "react-router-dom";
import {
  ScanSearch,
  ShieldAlert,
  Bot,
  Activity,
  Lock,
  Wifi,
  ArrowRight,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/4 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-cyber-green/8 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 text-center sm:pt-24">
          <Logo className="mx-auto h-20 w-20" />
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Tu red Wi-Fi,
            <br />
            <span className="text-cyber-green">sin secretos.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            S.S.S descubre todos los dispositivos en tu red doméstica, detecta puertos
            peligrosos y te avisa de amenazas. Pensado para gente normal, no para hackers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2 bg-cyber-green text-cyber-dark hover:bg-cyber-green/90">
              <Link to="/demo">
                Probar scan ahora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2 border-cyber-border">
              <Link to="/signup">Crear cuenta gratis</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sin cuenta: 5 escaneos demo por hora · Con cuenta: ilimitado + historial + reportes
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-cyber-card/30 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground">Qué hace por ti</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
            Tres cosas, hechas bien.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Feature
              icon={<ScanSearch className="h-6 w-6 text-cyber-green" />}
              title="Descubre quién está en tu red"
              desc="Identifica cada teléfono, TV, cámara, consola o vecino-colado conectado a tu Wi-Fi. IP, fabricante, sistema operativo."
            />
            <Feature
              icon={<ShieldAlert className="h-6 w-6 text-cyber-green" />}
              title="Detecta puertos peligrosos"
              desc="Si tu cámara, NAS o IoT está exponiendo Telnet, RDP, SMB o bases de datos, te avisamos antes de que lo descubran."
            />
            <Feature
              icon={<Bot className="h-6 w-6 text-cyber-green" />}
              title="Pregúntale a ACi"
              desc="Asistente de ciberseguridad integrado. Te explica qué encontró, qué significa cada puerto, y qué pasos tomar."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold text-foreground">Cómo empieza</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Step
              n={1}
              title="Instala el agente"
              desc="Una sola vez. Es el que escanea tu red localmente. Sin él, no podríamos ver tu Wi-Fi (ni tampoco nadie en la nube)."
            />
            <Step
              n={2}
              title="Escanea tu red"
              desc="Desde cualquier dispositivo con navegador. El agente descubre dispositivos y servicios en segundos."
            />
            <Step
              n={3}
              title="Recibe alertas"
              desc="Con cuenta gratis: te llegan alertas por email cuando aparece un dispositivo nuevo o un puerto peligroso."
            />
          </div>
          <div className="mt-10 flex justify-center">
            <Button asChild size="lg" className="gap-2 bg-cyber-green text-cyber-dark hover:bg-cyber-green/90">
              <Link to="/demo">
                Empezar ahora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-border bg-cyber-card/30 py-14">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-2">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-cyber-green" />
              <h3 className="text-lg font-bold text-foreground">Tus datos son tuyos</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Cada cuenta tiene su propio espacio en la base de datos con RLS estricto
              de Supabase. Otro usuario, ni nosotros, podemos leer tus escaneos. El agente
              corre en tu PC: el tráfico real nunca abandona tu red.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-cyber-green" />
              <h3 className="text-lg font-bold text-foreground">Sólo redes privadas</h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Por defecto sólo permitimos escanear tu LAN (192.168/16, 10/8, 172.16-31/12).
              Escanear redes públicas sin autorización es delito en muchos países y violaría
              los TOS de tu ISP — no lo hacemos.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            <span>S.S.S — Security Smart Services</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/oscarjnz/shs-security"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              Código en GitHub
            </a>
            <Link to="/login" className="hover:text-foreground">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card className="border-cyber-border bg-cyber-card/60">
      <CardContent className="space-y-2 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber-green/10">
          {icon}
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="space-y-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyber-green/10 text-sm font-bold text-cyber-green">
        {n}
      </div>
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
