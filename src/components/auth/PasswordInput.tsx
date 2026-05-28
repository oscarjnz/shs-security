import { useState, forwardRef, type InputHTMLAttributes } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Show the lock icon on the left. Default true. */
  withLockIcon?: boolean;
}

/**
 * Password field with show/hide toggle (eye icon).
 * Drop-in replacement for <Input type="password">.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, withLockIcon = true, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        {withLockIcon && (
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          ref={ref}
          {...props}
          type={visible ? "text" : "password"}
          className={cn(
            withLockIcon ? "pl-10" : "",
            "pr-10",
            className,
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 ease-out-quart hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 active:scale-95"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
