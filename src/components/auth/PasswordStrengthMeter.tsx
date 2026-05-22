import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PasswordCriteria {
  longEnough: boolean;     // >= 8
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
  notTooShort: boolean;    // != ""
  veryLong: boolean;       // >= 14
}

export function evaluatePassword(pwd: string): PasswordCriteria {
  return {
    longEnough: pwd.length >= 8,
    hasLower: /[a-z]/.test(pwd),
    hasUpper: /[A-Z]/.test(pwd),
    hasDigit: /\d/.test(pwd),
    hasSymbol: /[^A-Za-z0-9]/.test(pwd),
    notTooShort: pwd.length > 0,
    veryLong: pwd.length >= 14,
  };
}

export function passwordScore(c: PasswordCriteria): number {
  // 0..5
  let score = 0;
  if (c.longEnough) score++;
  if (c.hasLower && c.hasUpper) score++;
  if (c.hasDigit) score++;
  if (c.hasSymbol) score++;
  if (c.veryLong) score++;
  return score;
}

const LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte", "Excelente"];
const COLORS = [
  "bg-red-500",
  "bg-red-400",
  "bg-yellow-500",
  "bg-emerald-500",
  "bg-emerald-500",
  "bg-emerald-400",
];

interface PasswordStrengthMeterProps {
  password: string;
  /** Hide the meter when the field is empty. Default true. */
  hideWhenEmpty?: boolean;
}

export function PasswordStrengthMeter({
  password,
  hideWhenEmpty = true,
}: PasswordStrengthMeterProps) {
  const criteria = useMemo(() => evaluatePassword(password), [password]);
  const score = passwordScore(criteria);

  if (hideWhenEmpty && !password) return null;

  const label = LABELS[score] ?? "-";
  const color = COLORS[score] ?? "bg-muted";

  return (
    <div className="space-y-2 text-xs">
      {/* Bar */}
      <div className="flex items-center gap-2">
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-full flex-1 transition-colors",
                i < score ? color : "bg-transparent",
                i > 0 && "ml-0.5",
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "text-[10px] font-medium uppercase tracking-wider",
            score >= 3 ? "text-emerald-400" : score >= 2 ? "text-yellow-400" : "text-red-400",
          )}
        >
          {label}
        </span>
      </div>

      {/* Checklist */}
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <Criterion ok={criteria.longEnough} text="8 caracteres o más" />
        <Criterion ok={criteria.hasLower} text="letra minúscula" />
        <Criterion ok={criteria.hasUpper} text="letra mayúscula" />
        <Criterion ok={criteria.hasDigit} text="número" />
        <Criterion ok={criteria.hasSymbol} text="símbolo (!@#$…)" />
        <Criterion ok={criteria.veryLong} text="14+ caracteres (recomendado)" />
      </ul>

      <p className="text-[10px] text-muted-foreground">
        Caracteres actuales: <span className="font-mono">{password.length}</span>
      </p>
    </div>
  );
}

function Criterion({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      {ok ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <X className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
      <span className={ok ? "text-emerald-400" : "text-muted-foreground"}>{text}</span>
    </li>
  );
}

/**
 * The minimum score we require before allowing form submission.
 * 2 = "Aceptable": 8+ chars AND has lower+upper OR has digit AND has symbol.
 */
export const MIN_PASSWORD_SCORE = 2;
