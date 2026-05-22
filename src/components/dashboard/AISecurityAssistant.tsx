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
          ACi - Asistente de Ciberseguridad
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          ACi es un asistente conversacional que te explica conceptos de
          ciberseguridad y revisa el estado actual de tu red cuando se lo
          pides. Responde sobre amenazas, vulnerabilidades, dispositivos
          y buenas prácticas, en lenguaje claro.
        </p>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyber-green" />
            Explica resultados de escaneos y puertos abiertos
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyber-green" />
            Enseña sobre phishing, malware, reverse shells, OWASP
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyber-green" />
            Analiza tus amenazas activas y dispositivos al pedírselo
          </li>
        </ul>

        <Button
          onClick={() => navigate("/ai-analysis")}
          className="w-full gap-2 bg-violet-600 text-white hover:bg-violet-700"
        >
          Hablar con ACi
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
