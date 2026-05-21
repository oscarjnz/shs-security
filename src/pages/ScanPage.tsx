import { useScanContext } from "@/contexts/ScanContext";
import { ScanForm } from "@/components/scan/ScanForm";
import { ScanOutput } from "@/components/scan/ScanOutput";
import { AssistantPanel } from "@/components/scan/AssistantPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScanSearch } from "lucide-react";

export function ScanPage() {
  const { state, known, runScan, abort, lastTarget, lastCommand } = useScanContext();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <ScanSearch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Scanner de Red</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Elige un perfil predefinido o construye tu propio comando nmap. ACi te ayudará a entender los resultados.
        </p>
      </div>

      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4">
        <div className="lg:col-span-4 min-w-0">
          <Card>
            <CardContent className="pt-5">
              <ScanForm isRunning={state.isRunning} onSubmit={runScan} onAbort={abort} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 min-w-0">
          <ScanOutput state={state} knownIps={known.ips} knownMacs={known.macs} />
        </div>

        <div className="lg:col-span-3 lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)] min-w-0">
          <AssistantPanel scanState={state} target={lastTarget} command={lastCommand} />
        </div>
      </div>

      <Tabs defaultValue="scanner" className="lg:hidden">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scanner">Scanner</TabsTrigger>
          <TabsTrigger value="output">Resultados</TabsTrigger>
          <TabsTrigger value="assistant">ACi</TabsTrigger>
        </TabsList>

        <TabsContent value="scanner" className="mt-3">
          <Card>
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
