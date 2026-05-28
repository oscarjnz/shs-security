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
    <Card className={cn("group/check h-full transition-[border-color,box-shadow,transform] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border", palette.border, palette.hoverShadow)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-200 ease-out-quart group-hover/check:scale-[1.04]", palette.iconBg, palette.iconRing)}>
              {icon}
            </div>
            <CardTitle className="text-sm leading-tight tracking-[-0.01em] break-words">{title}</CardTitle>
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
            className="h-7 w-full justify-start gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
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
        badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        border: "border-l-2 border-l-emerald-500/70",
        iconBg: "bg-emerald-500/10 text-emerald-400",
        iconRing: "ring-emerald-500/20",
        hoverShadow: "hover:shadow-[0_8px_24px_-12px_hsl(160_84%_39%/0.35)]",
      };
    case "warn":
      return {
        label: "Atención",
        icon: <AlertTriangle className="h-3 w-3" />,
        badge: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
        border: "border-l-2 border-l-yellow-500/70",
        iconBg: "bg-yellow-500/10 text-yellow-400",
        iconRing: "ring-yellow-500/20",
        hoverShadow: "hover:shadow-[0_8px_24px_-12px_hsl(47_96%_53%/0.3)]",
      };
    case "bad":
      return {
        label: "Crítico",
        icon: <XCircle className="h-3 w-3" />,
        badge: "border-destructive/40 bg-destructive/10 text-destructive",
        border: "border-l-2 border-l-destructive/70",
        iconBg: "bg-destructive/10 text-destructive",
        iconRing: "ring-destructive/20",
        hoverShadow: "hover:shadow-[0_8px_24px_-12px_hsl(0_72%_51%/0.35)]",
      };
    case "loading":
      return {
        label: "Cargando",
        icon: <Loader2 className="h-3 w-3 animate-spin" />,
        badge: "border-muted bg-muted/20 text-muted-foreground",
        border: "border-l-2 border-l-muted/40",
        iconBg: "bg-muted/20 text-muted-foreground",
        iconRing: "ring-muted/30",
        hoverShadow: "",
      };
    case "error":
      return {
        label: "Fallo",
        icon: <XCircle className="h-3 w-3" />,
        badge: "border-muted bg-muted/20 text-muted-foreground",
        border: "border-l-2 border-l-muted/40",
        iconBg: "bg-muted/20 text-muted-foreground",
        iconRing: "ring-muted/30",
        hoverShadow: "",
      };
    case "neutral":
    default:
      return {
        label: "Info",
        icon: <HelpCircle className="h-3 w-3" />,
        badge: "border-blue-500/40 bg-blue-500/10 text-blue-400",
        border: "border-l-2 border-l-blue-500/50",
        iconBg: "bg-blue-500/10 text-blue-400",
        iconRing: "ring-blue-500/20",
        hoverShadow: "hover:shadow-[0_8px_24px_-12px_hsl(199_89%_48%/0.3)]",
      };
  }
}
