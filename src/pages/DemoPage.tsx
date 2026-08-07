import { Link } from "react-router-dom";
import { ShieldCheck, Lock, ArrowRight, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { PublicHeader } from "@/components/PublicHeader";
import { SecurityChecksGrid } from "@/components/security/SecurityChecksGrid";
import { GeoLocationPage } from "@/pages/GeoLocationPage";
import { useSeo } from "@/hooks/useSeo";

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
        <Reveal immediate as="header" className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chequeo rápido</h1>
            <p className="text-sm text-muted-foreground">
              Analiza tu conexión a internet actual, directamente desde tu navegador o nuestros
              servidores. No hace falta instalar nada ni crear una cuenta.
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

        {/* Los chequeos reales */}
        <Reveal delay={60}>
          <SecurityChecksGrid />
        </Reveal>

        {/* Localizador de IP, en su propia seccion */}
        <Reveal delay={90}>
          <Card className="surface-glass">
            <CardContent className="p-5">
              <GeoLocationPage />
            </CardContent>
          </Card>
        </Reveal>

        {/* CTA hacia la cuenta gratis, que sí escanea la red real */}
        <Reveal delay={120}>
          <Card className="surface-glass border-cyber-green/40">
            <CardContent className="space-y-3 p-5">
              <h3 className="text-base font-bold text-foreground">
                Para escanear tu Wi-Fi de verdad, necesitas una cuenta
              </h3>
              <p className="text-sm text-muted-foreground">
                Con una cuenta gratuita instalas el agente local en un equipo de tu red (toma
                menos de un minuto) y desde ahí sí ves los dispositivos conectados, los puertos
                expuestos y las amenazas reales de tu Wi-Fi.
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
                  Crear cuenta gratis
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
