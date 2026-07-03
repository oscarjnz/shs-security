import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOwaspTop10, streamOwaspChat, type OwaspItem } from "@/lib/cveApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ShieldCheck, Loader2, Send, Sparkles, BookOpen, ExternalLink } from "lucide-react";
import { SimpleMarkdown } from "@/lib/simpleMarkdown";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "¿Qué es OWASP Top 10 y por qué me debería importar?",
  "Explícame qué es una inyección SQL con un ejemplo simple",
  "¿Cómo sé si mi banco usa contraseñas bien cifradas?",
  "¿Qué es el SSRF y por qué es peligroso?",
  "Si abro una app dudosa, ¿qué señales de seguridad debo mirar?",
];

export function OwaspPage() {
  const { data: items, isLoading } = useQuery({
    queryKey: ["owasp-top10"],
    queryFn: getOwaspTop10,
    staleTime: 1000 * 60 * 60,
  });

  return (
    <div className="space-y-6">
      <Reveal immediate as="header" className="flex items-start gap-3">
        <BookOpen className="h-8 w-8 shrink-0 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">OWASP Top 10 & ACi</h1>
          <p className="text-sm text-muted-foreground">
            Los 10 riesgos más importantes de seguridad web, explicados sin tecnicismos.
            Pregúntale a ACi lo que quieras sobre el tema.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="pressable">
          <a href="https://owasp.org/Top10/" target="_blank" rel="noreferrer noopener">
            owasp.org
            <ExternalLink className="ml-2 h-3 w-3" />
          </a>
        </Button>
      </Reveal>

      <Reveal className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card className="surface-glass h-full">
            <CardHeader>
              <CardTitle className="text-base">Los 10 riesgos (edición 2021)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Accordion type="single" collapsible className="w-full">
                  {(items ?? []).map((item) => (
                    <OwaspAccordionItem key={item.id} item={item} />
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <ChatPanel />
        </div>
      </Reveal>
    </div>
  );
}

function OwaspAccordionItem({ item }: { item: OwaspItem }) {
  return (
    <AccordionItem value={item.id}>
      <AccordionTrigger className="text-left">
        <div className="flex flex-1 items-center gap-3">
          <Badge variant="outline" className="font-mono">
            #{item.rank}
          </Badge>
          <span className="font-medium">{item.shortName}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-3 pt-2 text-sm">
        <div>
          <h4 className="mb-1 font-semibold text-foreground">{item.name}</h4>
          <p className="leading-relaxed text-muted-foreground">{item.description}</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <h5 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Ejemplo cotidiano
          </h5>
          <p className="text-muted-foreground">{item.example}</p>
        </div>
        <div className="rounded-md border border-green-700/30 bg-green-950/20 p-3">
          <h5 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-500">
            <ShieldCheck className="h-3 w-3" /> Cómo se mitiga
          </h5>
          <p className="text-muted-foreground">{item.mitigation}</p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (overrideQ?: string) => {
    const q = (overrideQ ?? input).trim();
    if (!q || streaming) return;
    if (!overrideQ) setInput("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);
    abortRef.current = new AbortController();
    try {
      await streamOwaspChat(q, {
        signal: abortRef.current.signal,
        onDelta: (chunk) => {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            if (last && last.role === "assistant") {
              copy[copy.length - 1] = { ...last, content: last.content + chunk };
            }
            return copy;
          });
        },
      });
    } catch (err) {
      setMessages((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          copy[copy.length - 1] = { ...last, content: `Error: ${(err as Error).message}` };
        }
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <Card className="surface-glass flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          ACi: Pregúntame
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <ScrollArea
          className="min-h-[24rem] flex-1 rounded-md border border-border bg-muted/20 p-3"
          ref={scrollRef}
        >
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Sugerencias:</p>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => void send(q)}
                  disabled={streaming}
                  className="block w-full rounded-md border border-border bg-background p-2 text-left text-xs hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-md p-3 text-sm ${
                    m.role === "user"
                      ? "ml-6 bg-primary/10 text-foreground"
                      : "mr-6 bg-background text-foreground"
                  }`}
                >
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {m.role === "user" ? "Tú" : "ACi"}
                  </div>
                  {m.role === "assistant" && m.content ? (
                    <SimpleMarkdown text={m.content} className="leading-relaxed" />
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta…"
            disabled={streaming}
            maxLength={500}
          />
          <Button type="submit" disabled={streaming || !input.trim()}>
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
