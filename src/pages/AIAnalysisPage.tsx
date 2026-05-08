import { useState, useRef, useEffect, useCallback } from "react";
import { Brain, Send, Loader2, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase, AGENT_URL } from "@/lib/supabase";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function renderContent(text: string): JSX.Element {
  const lines = text.split("\n");

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const bullet = trimmed.slice(2);
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-muted-foreground">&#8226;</span>
              <span>{renderInline(bullet)}</span>
            </div>
          );
        }

        if (trimmed === "") return <div key={i} className="h-2" />;

        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): JSX.Element {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
    </span>
  );
}

export function AIAnalysisPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const streamMessage = useCallback(
    async (userContent: string) => {
      setIsStreaming(true);
      abortRef.current = new AbortController();

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        },
      ]);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sin sesion activa");

        const res = await fetch(`${AGENT_URL}/api/ai/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ message: userContent }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`Error del servidor: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No se pudo leer la respuesta");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") break;

            try {
              const parsed = JSON.parse(payload) as { content?: string };
              if (parsed.content) {
                accumulated += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulated } : m,
                  ),
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        if (!accumulated) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      "No se recibio respuesta del modelo. Intente de nuevo.",
                  }
                : m,
            ),
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;

        const errorMsg =
          err instanceof Error ? err.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${errorMsg}` }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Auto-send initial analysis
  useEffect(() => {
    if (hasInitialized || messages.length > 0) return;
    setHasInitialized(true);

    const initMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content:
        "Realiza un analisis general de seguridad de mi red. Resume amenazas activas, vulnerabilidades y recomendaciones.",
      timestamp: new Date(),
    };
    setMessages([initMsg]);
    streamMessage(initMsg.content);
  }, [hasInitialized, messages.length, streamMessage]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    streamMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Analisis de Seguridad AI
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Asistente de inteligencia artificial para analisis de seguridad en
          tiempo real.
        </p>
      </div>

      {/* Chat area */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {msg.role === "assistant" && !msg.content && isStreaming ? (
                    <LoadingDots />
                  ) : msg.role === "assistant" ? (
                    renderContent(msg.content)
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta de seguridad..."
              className="min-h-[44px] max-h-32 resize-none"
              disabled={isStreaming}
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={isStreaming || !input.trim()}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
