import { Network } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { UnderDevelopmentNotice } from "@/components/ui/UnderDevelopmentNotice";

export function NetworkOverviewPage() {
  return (
    <div className="space-y-6">
      <Reveal immediate as="header">
        <div className="flex items-center gap-2">
          <Network className="h-6 w-6 text-cyber-green" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Red</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitoreo de tráfico y estado de tu conexión de red.
        </p>
      </Reveal>

      <Reveal as="section">
        <Card className="surface-glass">
          <CardContent className="py-6">
            <UnderDevelopmentNotice
              title="El monitoreo de red está en desarrollo"
              description="Estamos construyendo la medición de velocidad de bajada y subida, latencia y pérdida de paquetes de tu conexión. Todavía no hay datos reales que mostrar aquí, así que preferimos avisarte en vez de dejar la sección vacía sin explicación. Estará disponible en una próxima actualización."
            />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
