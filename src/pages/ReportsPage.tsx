import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileBarChart,
  Send,
  RefreshCw,
  Loader2,
  Calendar,
  Shield,
} from "lucide-react";
import { supabase, AGENT_URL } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportRow } from "@/lib/database.types";

const TYPE_LABELS: Record<string, string> = {
  weekly: "Semanal",
  threat: "Amenazas",
  vulnerability: "Vulnerabilidades",
  network: "Red",
  custom: "Personalizado",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviado",
  archived: "Archivado",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "sent") return "default";
  if (status === "archived") return "secondary";
  return "outline";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [generating, setGenerating] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState<string[]>([]);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [sending, setSending] = useState(false);

  const reportsQuery = useQuery({
    queryKey: ["reports", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const reports = reportsQuery.data ?? [];

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setGeneratingSteps([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sin sesion activa");

      const jobId = crypto.randomUUID();

      const res = await fetch(`${AGENT_URL}/api/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: "custom", jobId }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? `Error: ${res.status}`,
        );
      }

      // Try to read SSE progress
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";

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
              const parsed = JSON.parse(payload) as {
                step?: string;
                message?: string;
              };
              const stepText = parsed.step ?? parsed.message;
              if (stepText) {
                setGeneratingSteps((prev) => [...prev, stepText]);
              }
            } catch {
              // skip malformed
            }
          }
        }
      }

      toast({ title: "Reporte generado exitosamente" });
      qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      toast({
        title: "Error al generar reporte",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }, [qc]);

  const openSendDialog = (reportId: string) => {
    setSendingReportId(reportId);
    setRecipientEmails("");
    setSendDialogOpen(true);
  };

  const handleSendReport = async () => {
    if (!sendingReportId || !recipientEmails.trim()) return;
    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sin sesion activa");

      const emails = recipientEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch(`${AGENT_URL}/api/reports/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ report_id: sendingReportId, recipients: emails }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          (json as { error?: string }).error ?? `Error: ${res.status}`,
        );
      }

      toast({ title: "Reporte enviado exitosamente" });
      setSendDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      toast({
        title: "Error al enviar reporte",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Reportes de Seguridad
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Genera, revisa y envia reportes de seguridad de tu infraestructura.
          </p>
        </div>

        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Generar Reporte
        </Button>
      </div>

      {/* Generation progress */}
      {generating && generatingSteps.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="mb-2 text-sm font-medium">Generando reporte...</p>
            <div className="space-y-1">
              {generatingSteps.map((step, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  &#10003; {step}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reports grid */}
      {reportsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileBarChart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay reportes generados. Haz clic en &quot;Generar Reporte&quot;
              para crear el primero.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">
                    {report.title}
                  </CardTitle>
                  <Badge variant={statusVariant(report.status)}>
                    {STATUS_LABELS[report.status] ?? report.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary">
                    {TYPE_LABELS[report.type] ?? report.type}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Security score */}
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Puntuacion:
                  </span>
                  <span
                    className={`text-lg font-bold ${scoreColor(report.security_score)}`}
                  >
                    {report.security_score}/100
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(report.generated_at)}
                </div>

                {/* Summary */}
                {report.summary && (
                  <p
                    className="line-clamp-2 text-xs text-muted-foreground"
                    title={report.summary}
                  >
                    {report.summary}
                  </p>
                )}

                {/* Send button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => openSendDialog(report.id)}
                >
                  <Send className="mr-2 h-3.5 w-3.5" />
                  Enviar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Send dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Reporte</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="recipients">
                Emails de destinatarios (separados por coma)
              </Label>
              <Input
                id="recipients"
                placeholder="usuario@ejemplo.com, otro@ejemplo.com"
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSendDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSendReport}
              disabled={sending || !recipientEmails.trim()}
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
