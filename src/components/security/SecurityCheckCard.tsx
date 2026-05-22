import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  HelpCircle,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckStatus, CheckResult } from "@/hooks/useSecurityChecks";

interface SecurityCheckCardProps {
  result: CheckResult;
  icon: ReactNode;
  /** Optional children rendered between summary and the action row (extra detail, on-demand input, etc). */
  children?: ReactNode;
  /** ACi prompt to pre-fill when the user clicks "Pregunta a ACi". */
  aciPrompt?: string;
}

export function SecurityCheckCard({
  result,
  icon,
  children,
  aciPrompt,
}: SecurityCheckCardProps) {
  const { status, title, summary, error } = result;
  const palette = statusPalette(status);

  return (
    <Card className={cn("h-full", palette.border)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", palette.iconBg)}>
              {icon}
            </div>
            <CardTitle className="text-sm leading-tight break-words">{title}</CardTitle>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {error ? `Error: ${error}` : summary}
        </p>
        {children}
        {aciPrompt && status !== "loading" && (
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-7 w-full justify-start gap-1.5 px-2 text-xs"
          >
            <Link to={`/ai-analysis?q=${encodeURIComponent(aciPrompt)}`}>
              <Bot className="h-3 w-3" />
              Pregunta a ACi
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const palette = statusPalette(status);
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1 text-[10px]", palette.badge)}>
      {palette.icon}
      {palette.label}
    </Badge>
  );
}

function statusPalette(status: CheckStatus) {
  switch (status) {
    case "ok":
      return {
        label: "OK",
        icon: <CheckCircle2 className="h-3 w-3" />,
        badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
        border: "border-l-4 border-l-emerald-500/60",
        iconBg: "bg-emerald-500/10 text-emerald-500",
      };
    case "warn":
      return {
        label: "Atención",
        icon: <AlertTriangle className="h-3 w-3" />,
        badge: "border-yellow-500/40 bg-yellow-500/10 text-yellow-500",
        border: "border-l-4 border-l-yellow-500/60",
        iconBg: "bg-yellow-500/10 text-yellow-500",
      };
    case "bad":
      return {
        label: "Crítico",
        icon: <XCircle className="h-3 w-3" />,
        badge: "border-destructive/40 bg-destructive/10 text-destructive",
        border: "border-l-4 border-l-destructive/60",
        iconBg: "bg-destructive/10 text-destructive",
      };
    case "loading":
      return {
        label: "Cargando",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        badge: "border-muted bg-muted/20 text-muted-foreground",
        border: "border-l-4 border-l-muted/40",
        iconBg: "bg-muted/20 text-muted-foreground",
      };
    case "error":
      return {
        label: "Fallo",
        icon: <XCircle className="h-3 w-3" />,
        badge: "border-muted bg-muted/20 text-muted-foreground",
        border: "border-l-4 border-l-muted/40",
        iconBg: "bg-muted/20 text-muted-foreground",
      };
    case "neutral":
    default:
      return {
        label: "Info",
        icon: <HelpCircle className="h-3 w-3" />,
        badge: "border-blue-500/40 bg-blue-500/10 text-blue-500",
        border: "border-l-4 border-l-blue-500/40",
        iconBg: "bg-blue-500/10 text-blue-500",
      };
  }
}
