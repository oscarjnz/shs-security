import { useNavigate } from "react-router-dom";
import { Brain, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AISecurityAssistant() {
  const navigate = useNavigate();

  return (
    <Card className="border-cyber-border bg-cyber-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Brain className="h-5 w-5 text-violet-400" />
          Asistente de Seguridad IA
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Nuestro asistente impulsado por inteligencia artificial analiza
          continuamente tu red, identifica patrones sospechosos y genera
          recomendaciones personalizadas para fortalecer la seguridad de tu
          hogar.
        </p>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyber-green" />
            Deteccion de anomalias en tiempo real
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyber-green" />
            Analisis predictivo de vulnerabilidades
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyber-green" />
            Recomendaciones automaticas de seguridad
          </li>
        </ul>

        <Button
          onClick={() => navigate("/ai-analysis")}
          className="w-full gap-2 bg-violet-600 text-white hover:bg-violet-700"
        >
          Ir al Analisis IA
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
