import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useScanContext } from "@/contexts/ScanContext";
import { ScanForm } from "@/components/scan/ScanForm";
import { ScanOutput } from "@/components/scan/ScanOutput";
import { AssistantPanel } from "@/components/scan/AssistantPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScanSearch, Plus, Bot } from "lucide-react";
import { AgentStartHelp, AgentOfflineTitle, useAgentStatus } from "@/components/scanner/AgentStartHelp";
import { Reveal } from "@/components/ui/Reveal";

const ACI_PREF_KEY = "sss-scan-assistant-open";

export function ScanPage() {
  const { state, known, runScan, abort, lastTarget, lastCommand } = useScanContext();
  const agent = useAgentStatus();

  // ACi se puede abrir y cerrar a voluntad (solo desktop). La preferencia se
  // recuerda para no reabrirlo cada vez.
  const [assistantOpen, setAssistantOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(ACI_PREF_KEY) !== "false";
  });
  const setAssistant = useCallback((open: boolean) => {
    setAssistantOpen(open);
    try {
      window.localStorage.setItem(ACI_PREF_KEY, String(open));
    } catch {
      /* noop */
    }
  }, []);

  // Mostrar la guía de "encender el agente" si el usuario tiene escáner pero
  // ninguno online, o si el escaneo fallo por algo relacionado al agente.
  const errorLooksAgentRelated =
    !!state.error && /online|agente|esc[aá]ner|scanner|no est[aá]/i.test(state.error);
  const showOfflineHelp =
    (!agent.loading && agent.hasAgents && agent.onlineCount === 0) || errorLooksAgentRelated;
  const showNoAgent = !agent.loading && !agent.hasAgents;

  return (
    <div className="flex flex-col gap-4">
      <Reveal immediate as="header">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Revisar mi red</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige qué quieres revisar y te mostramos qué hay en tu red y si algo necesita atención.
          ACi te explica los resultados en lenguaje sencillo.
        </p>
      </Reveal>

      {/* Sin escáner instalado: no se puede escanear la red */}
      {showNoAgent && (
        <Card className="surface-glass border-primary/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              Necesitas un escáner instalado en tu red para poder revisarla. Aún no tienes ninguno.
            </p>
            <Button asChild size="sm">
              <Link to="/settings/scanners">
                <Plus className="mr-2 h-4 w-4" /> Instalar mi escáner
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tiene escáner pero está apagado (Offline): cómo encenderlo */}
      {showOfflineHelp && (
        <Card className="surface-glass border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-base">
              <AgentOfflineTitle />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentStartHelp />
          </CardContent>
        </Card>
      )}

      <Reveal className="hidden lg:grid lg:grid-cols-12 lg:gap-4">
        <div className="lg:col-span-4 min-w-0">
          <Card className="surface-glass">
            <CardContent className="pt-5">
              <ScanForm isRunning={state.isRunning} onSubmit={runScan} onAbort={abort} />
            </CardContent>
          </Card>
        </div>

        <div className={`${assistantOpen ? "lg:col-span-5" : "lg:col-span-8"} min-w-0`}>
          <ScanOutput state={state} knownIps={known.ips} knownMacs={known.macs} />
        </div>

        {assistantOpen ? (
          <div className="lg:col-span-3 lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)] min-w-0">
            <AssistantPanel
              scanState={state}
              target={lastTarget}
              command={lastCommand}
              onClose={() => setAssistant(false)}
            />
          </div>
        ) : null}
      </Reveal>

      {/* Botón flotante para reabrir ACi cuando está cerrado (solo desktop) */}
      {!assistantOpen && (
        <Button
          type="button"
          onClick={() => setAssistant(true)}
          className="pressable fixed bottom-6 right-6 z-40 hidden gap-2 shadow-lg lg:inline-flex"
        >
          <Bot className="h-4 w-4" />
          Abrir ACi
        </Button>
      )}

      <Tabs defaultValue="scanner" className="lg:hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner">Revisar</TabsTrigger>
          <TabsTrigger value="output">Resultados</TabsTrigger>
          <TabsTrigger value="assistant">ACi</TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="mt-3">
          <Card className="surface-glass">
            <CardContent className="pt-5">
              <ScanForm isRunning={state.isRunning} onSubmit={runScan} onAbort={abort} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="output" className="mt-3">
          <ScanOutput state={state} knownIps={known.ips} knownMacs={known.macs} />
        </TabsContent>

        <TabsContent value="assistant" className="mt-3 h-[70vh]">
          <AssistantPanel scanState={state} target={lastTarget} command={lastCommand} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
