import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Bot, Send, Loader2, User, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { useAuth } from "@clerk/react";
import type { ScanState } from "@/hooks/useScanRun";
import { cn } from "@/lib/utils";

interface AssistantPanelProps {
  scanState: ScanState;
  target: string;
  command?: string;
  /** Si se pasa, muestra un boton para cerrar/ocultar el panel (solo desktop). */
  onClose?: () => void;
}

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GENERAL_PROMPTS = [
  "¿Qué es phishing y cómo me protejo?",
  "Explícame qué es una reverse shell",
  "¿Cómo funciona un ataque MITM?",
  "¿Qué es defensa en profundidad?",
];

export function AssistantPanel({ scanState, target, command, onClose }: AssistantPanelProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasScanContext = scanState.devices.length > 0 || scanState.threats.length > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: AssistantMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);
      setIsStreaming(true);
      setInput("");

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const token = await getToken();
        if (!token) throw new Error("Sesión no válida");

        const useScanContext = hasScanContext;
        const endpoint = useScanContext ? "/api/assistant/explain-scan" : "/api/assistant/chat";

        const body = useScanContext
          ? {
              context: {
                target,
                command: command ?? "",
                summary: scanState.summary
                  ? `${scanState.summary.devices} hosts, ${scanState.summary.ports} puertos abiertos, ${scanState.summary.threats} amenazas`
                  : "",
                devices: scanState.devices,
              },
              question: text,
            }
          : {
              messages: [...messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: text }],
              includeNetworkContext: false,
            };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
          throw new Error(err.error ?? `Error ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream no disponible");

        const decoder = new TextDecoder();
        let buffer = "";
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { content?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                acc += parsed.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m)),
                );
              }
            } catch {
              // skip
            }
          }
        }

        if (!acc) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: "El asistente no devolvió respuesta. Intenta de nuevo." }
                : m,
            ),
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: `Error: ${msg}` } : m)),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [hasScanContext, target, command, scanState, messages],
  );

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    send(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = hasScanContext
    ? [
        "¿Qué riesgo hay en este resultado?",
        "Explícame los puertos abiertos",
        "¿Cómo cierro los puertos peligrosos?",
        "Dame un plan de hardening",
      ]
    : GENERAL_PROMPTS;

  return (
    <Card className="surface-glass flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            ACi
          </CardTitle>
          {onClose && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-7 w-7 shrink-0 text-muted-foreground"
              aria-label="Cerrar asistente"
              title="Cerrar asistente"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {hasScanContext
            ? "Te explico este escaneo y los próximos pasos."
            : "Pregúntame sobre cualquier tema de ciberseguridad."}
        </p>
      </CardHeader>

      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-3 pb-2">
          {messages.length === 0 && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Prueba con:
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => send(p)}
                    disabled={isStreaming}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {m.content || (isStreaming ? <Loader2 className="h-3 w-3 animate-spin" /> : "")}
              </div>
              {m.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                  <User className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <CardContent className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasScanContext ? "Pregunta sobre este escaneo…" : "Pregunta de ciberseguridad…"}
            className="min-h-[40px] resize-none"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="h-10 w-10 shrink-0"
          >
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
