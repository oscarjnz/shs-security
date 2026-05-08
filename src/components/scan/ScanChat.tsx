import { useRef, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { ScanMessage } from "@/hooks/useScanChat";
import { ScanResultCard } from "./ScanResultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  Trash2,
  Bot,
  User,
} from "lucide-react";

interface ScanChatProps {
  messages: ScanMessage[];
  isScanning: boolean;
  onSend: (text: string) => void;
  onClear: () => void;
}

const SUGGESTED_QUESTIONS = [
  "¿Quién está en mi red?",
  "Escanear puertos abiertos",
  "Verificar vulnerabilidades de red",
  "¿Hay dispositivos desconocidos?",
] as const;

export function ScanChat({ messages, isScanning, onSend, onClear }: ScanChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isScanning]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isScanning) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  const handleChipClick = (question: string) => {
    if (isScanning) return;
    onSend(question);
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Asistente de Escaneo
          </h3>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpiar
          </Button>
        )}
      </div>

      {/* ---------- Messages ---------- */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {/* Suggested questions when empty */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Bot className="h-10 w-10 text-muted-foreground/50" />
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                Pregunta en lenguaje natural sobre tu red. Ejecutar&eacute; las herramientas de seguridad por ti.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleChipClick(q)}
                    disabled={isScanning}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat bubbles */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={cn("flex", isUser ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1",
                    isUser ? "items-end" : "items-start",
                  )}
                >
                  {/* Role icon */}
                  <div className="flex items-center gap-1.5">
                    {!isUser && (
                      <Bot className="h-4 w-4 shrink-0 text-primary" />
                    )}
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {isUser ? "Tú" : "Asistente"}
                    </span>
                    {isUser && (
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                      isUser
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-muted text-foreground",
                    )}
                  >
                    {msg.content}
                  </div>

                  {/* Scan result */}
                  {msg.scanResult && <ScanResultCard result={msg.scanResult} />}

                  {/* Timestamp */}
                  <span className="text-[10px] text-muted-foreground">
                    {msg.timestamp.toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isScanning && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Escaneando...
                </span>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ---------- Input ---------- */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta sobre la red..."
          disabled={isScanning}
          className="flex-1"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isScanning}
          aria-label="Enviar mensaje"
        >
          {isScanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
