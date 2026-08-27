import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, ArrowRight, Wifi, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { PublicHeader } from "@/components/PublicHeader";
import { SecurityChecksGrid } from "@/components/security/SecurityChecksGrid";
import { GeoLocationPage } from "@/pages/GeoLocationPage";
import { useSeo } from "@/hooks/useSeo";

/**
 * Tarjeta de vista previa para funciones que solo existen con cuenta + agente
 * local (dispositivos de la LAN, puertos, etc). Muestra datos de ejemplo,
 * inertes y atenuados, con un candado explicando que no son datos reales.
 */
function LockedPreviewCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="surface-glass relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-40">
        <CardContent className="space-y-2.5 p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            {icon}
            {title}
          </div>
          {children}
        </CardContent>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-cyber-dark/70 p-4 text-center">
        <Lock className="h-4 w-4 text-cyber-green" />
        <p className="text-xs font-semibold text-foreground">Requiere una cuenta en S.S.S</p>
        <p className="max-w-[220px] text-[11px] text-muted-foreground">
          Datos de ejemplo. Con el agente instalado en tu red verías los tuyos, en tiempo real.
        </p>
      </div>
    </Card>
  );
}

export function DemoPage() {
  useSeo({
    title: "Chequeo rápido | S.S.S - Security Smart Services",
    description:
      "Analiza tu conexión a internet, revisa fugas de privacidad del navegador y verifica si alguna contraseña apareció en una filtración conocida. Sin crear cuenta.",
    path: "/demo",
  });

  return (
    <div className="min-h-screen bg-cyber-dark">
      <PublicHeader />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Header */}
        <Reveal immediate as="header" className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">Chequeo rápido</h1>
              <Badge variant="outline" className="border-cyber-green/40 text-cyber-green">
                Vista previa limitada
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Analiza tu conexión a internet actual, directamente desde tu navegador o nuestros
              servidores. No hace falta instalar nada ni crear una cuenta.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esto <strong className="text-foreground">no es</strong> la función principal de
              S.S.S: es solo lo que se puede revisar desde fuera de tu red. El escaneo real de tu
              Wi-Fi (dispositivos, puertos, amenazas) necesita el agente local y una cuenta.
            </p>
          </div>
        </Reveal>

        {/* Explicación honesta de qué se puede y qué no se puede hacer aquí */}
        <Reveal>
          <Card className="surface-glass border-primary/30">
            <CardContent className="space-y-2 p-5 text-xs text-muted-foreground">
              <p>
                Estos chequeos revisan tu IP pública, si tu navegador filtra tu IP local por
                WebRTC, información de tu conexión y si alguna de tus contraseñas apareció en una
                filtración conocida. Todo corre en tu navegador o en nuestros servidores, sin
                tocar tu red doméstica.
              </p>
              <p>
                Para ver qué dispositivos hay conectados a tu Wi-Fi y qué puertos exponen,
                necesitas el agente local instalado en un equipo de tu red, lo cual requiere una
                cuenta gratuita.
              </p>
            </CardContent>
          </Card>
        </Reveal>

        {/* Localizador de IP, en su propia seccion */}
        <Reveal delay={60}>
          <Card className="surface-glass">
            <CardContent className="p-5">
              <GeoLocationPage />
            </CardContent>
          </Card>
        </Reveal>

        {/* Los chequeos reales */}
        <Reveal delay={90}>
          <SecurityChecksGrid />
        </Reveal>

        {/* Vista previa de lo que solo existe con cuenta + agente local.
            Datos de ejemplo, inertes, marcados con candado: no son reales
            y no se pueden confundir con los chequeos de arriba. */}
        <Reveal delay={110} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">Así se ve con una cuenta</h2>
            <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
              Datos de ejemplo
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Estas tarjetas no son interactivas: muestran cómo se vería tu panel una vez que
            instalas el agente local en un equipo de tu red.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LockedPreviewCard title="Dispositivos conectados" icon={<Wifi className="h-4 w-4 text-cyber-green" />}>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>iPhone de Ana · 192.168.1.14 · Confiable</li>
                <li>Impresora HP LaserJet · 192.168.1.22</li>
                <li>Smart TV Samsung · 192.168.1.31 · Nuevo</li>
              </ul>
            </LockedPreviewCard>
            <LockedPreviewCard title="Puertos y amenazas" icon={<Radar className="h-4 w-4 text-cyber-green" />}>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>Puerto 445 (SMB) abierto en 192.168.1.22</li>
                <li>Puerto 22 (SSH) abierto en 192.168.1.1</li>
                <li>1 vulnerabilidad crítica detectada (CVE)</li>
              </ul>
            </LockedPreviewCard>
          </div>
        </Reveal>

        {/* CTA hacia la cuenta gratis, que sí escanea la red real */}
        <Reveal delay={140}>
          <Card className="surface-glass border-cyber-green/40">
            <CardContent className="space-y-3 p-5">
              <h3 className="text-base font-bold text-foreground">
                Para escanear tu Wi-Fi de verdad, necesitas una cuenta
              </h3>
              <p className="text-sm text-muted-foreground">
                Con una cuenta instalas el agente local en un equipo de tu red (toma menos de un
                minuto) y desde ahí sí ves los dispositivos conectados, los puertos expuestos y
                las amenazas reales de tu Wi-Fi.
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Inventario de dispositivos y puertos expuestos dentro de tu red
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Alertas por email cuando aparece un dispositivo nuevo o un puerto peligroso
                </li>
                <li className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyber-green" />
                  Reportes PDF, ACi (asistente IA) y pulso continuo de la red
                </li>
              </ul>
              <Button
                asChild
                className="w-full gap-2 bg-cyber-green text-cyber-dark hover:bg-cyber-green/90"
              >
                <Link to="/signup">
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
