import { useScanChat } from "@/hooks/useScanChat";
import { ScanChat } from "@/components/scan/ScanChat";
import { ScanSearch } from "lucide-react";

export function ScanPage() {
  const { messages, isScanning, sendMessage, clearMessages } = useScanChat();

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2">
          <ScanSearch className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Scanner de Red
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pregunta en lenguaje natural sobre tu red y ejecutaremos las
          herramientas de seguridad por ti.
        </p>
      </div>

      {/* Chat takes remaining space */}
      <div className="min-h-0 flex-1">
        <ScanChat
          messages={messages}
          isScanning={isScanning}
          onSend={sendMessage}
          onClear={clearMessages}
        />
      </div>
    </div>
  );
}
