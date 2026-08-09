import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnderDevelopmentNoticeProps {
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}

export function UnderDevelopmentNotice({
  title = "Esta función está en desarrollo",
  description = "Estamos trabajando en esto para ofrecer una mejor experiencia. Estará disponible próximamente.",
  compact = false,
  className,
}: UnderDevelopmentNoticeProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5",
        compact ? "p-3" : "p-5",
        className,
      )}
    >
      <HardHat className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div>
        <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
