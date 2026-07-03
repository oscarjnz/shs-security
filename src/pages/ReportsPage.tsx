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
import { useUser, useAuth as useClerkAuth } from "@clerk/react";
import { useProfile } from "@/contexts/AuthContext";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { Eye, Trash2 } from "lucide-react";
import { ReportDetailDialog } from "@/components/reports/ReportDetailDialog";
import type { ReportRow } from "@/lib/database.types";

type ReportSectionKey = "threats" | "devices" | "vulnerabilities" | "network" | "scans" | "pulse" | "ai_summary";

const SECTION_OPTIONS: Array<{ key: ReportSectionKey; label: string; description: string }> = [
  { key: "threats", label: "Amenazas", description: "Activas e investigadas, con su tipo y severidad." },
  { key: "devices", label: "Dispositivos", description: "Inventario de dispositivos detectados en tu red." },
  { key: "vulnerabilities", label: "Vulnerabilidades", description: "Inventario de CVEs y CVSS detectados." },
  { key: "network", label: "Métricas de red", description: "Velocidad, latencia y pérdida de paquetes recientes." },
  { key: "scans", label: "Historial de escaneos", description: "Últimos escaneos ejecutados con sus resultados." },
  { key: "pulse", label: "Pulso de la red", description: "Uptime y latencia de cada dispositivo en los últimos 7 días." },
  { key: "ai_summary", label: "Resumen ejecutivo con IA", description: "ACi genera un análisis del estado general." },
];

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
  const { user } = useUser();
  const { getToken } = useClerkAuth();
  const { isAdmin } = useProfile();
  const qc = useQueryClient();

  // Detail + delete state
  const [detailReport, setDetailReport] = useState<ReportRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReportRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState<string[]>([]);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Set<ReportSectionKey>>(
    new Set(SECTION_OPTIONS.map((s) => s.key)),
  );
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const [recipientEmails, setRecipientEmails] = useState("");
  const [sending, setSending] = useState(false);

  const toggleSection = (key: ReportSectionKey) => {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const allSelected = selectedSections.size === SECTION_OPTIONS.length;
  const noneSelected = selectedSections.size === 0;

  const reportsQuery = useQuery({
    queryKey: ["reports", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("reports")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(50);
      // Un usuario normal solo ve sus propios reportes; el admin ve todos
      // (incluidos los antiguos generados antes de migrar a Clerk).
      if (!isAdmin && user) q = q.eq("generated_by", user.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReportRow[];
    },
  });

  const reports = reportsQuery.data ?? [];

  const handleGenerate = useCallback(async () => {
    setGenerateDialogOpen(false);
    setGenerating(true);
    setGeneratingSteps([]);

    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesion activa");

      const jobId = crypto.randomUUID();
      const sectionsArray = Array.from(selectedSections);
      const reportType = allSelected ? "custom" : sectionsArray.length === 1 ? sectionsArray[0]! : "custom";

      const res = await fetch(`${AGENT_URL}/api/reports/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: reportType,
          jobId,
          sections: allSelected ? undefined : sectionsArray,
        }),
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
  }, [qc, selectedSections, allSelected]);

  const openSendDialog = (reportId: string) => {
    setSendingReportId(reportId);
    setRecipientEmails("");
    setSendDialogOpen(true);
  };

  const openDetail = (report: ReportRow) => {
    setDetailReport(report);
    setDetailOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesion activa");
      const res = await fetch(`${AGENT_URL}/api/reports/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || json.success === false) {
        throw new Error(json.error ?? `Error: ${res.status}`);
      }
      toast({ title: "Reporte eliminado" });
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      toast({
        title: "No se pudo eliminar",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSendReport = async () => {
    if (!sendingReportId || !recipientEmails.trim()) return;
    setSending(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Sin sesion activa");

      const emails = recipientEmails
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const res = await fetch(`${AGENT_URL}/api/reports/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      <Reveal immediate as="header" className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Reportes de seguridad
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Genera, revisa y envia reportes de seguridad de tu infraestructura.
          </p>
        </div>

        <Button onClick={() => setGenerateDialogOpen(true)} disabled={generating} className="pressable">
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Generar reporte
        </Button>
      </Reveal>

      {/* Generation progress */}
      {generating && generatingSteps.length > 0 && (
        <Card className="surface-glass">
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
        <Card className="surface-glass">
          <CardContent className="py-12 text-center">
            <FileBarChart className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay reportes generados. Haz clic en &quot;Generar reporte&quot;
              para crear el primero.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report, i) => (
            <Reveal key={report.id} delay={i * 60} className="flex">
            <Card className="surface-glass hoverable-card flex w-full flex-col justify-between">
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
                    Puntuación:
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

                {/* Summary (de la columna o del resumen IA dentro de sections) */}
                {(() => {
                  const s = report.summary || (report.sections as { aiSummary?: string } | null)?.aiSummary || "";
                  return s ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground" title={s}>
                      {s}
                    </p>
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Sin resumen. Abre "Ver" para el detalle completo.
                    </p>
                  );
                })()}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => openDetail(report)}
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openSendDialog(report.id)}
                    title="Enviar por correo"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTarget(report)}
                    title="Eliminar"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            </Reveal>
          ))}
        </div>
      )}

      {/* Generate dialog - pick sections */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué incluyo en el reporte?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Reporte completo</p>
                <p className="text-xs text-muted-foreground">Marca todas las secciones</p>
              </div>
              <Button
                type="button"
                variant={allSelected ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setSelectedSections(
                    allSelected ? new Set() : new Set(SECTION_OPTIONS.map((s) => s.key)),
                  )
                }
              >
                {allSelected ? "Quitar todo" : "Incluir todo"}
              </Button>
            </div>

            {SECTION_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50"
              >
                <Checkbox
                  checked={selectedSections.has(opt.key)}
                  onCheckedChange={() => toggleSection(opt.key)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={noneSelected || generating}
            >
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Detail dialog */}
      <ReportDetailDialog
        report={detailReport}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSend={(reportId) => {
          setDetailOpen(false);
          openSendDialog(reportId);
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este reporte?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.title}</strong> se borrará de forma permanente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
