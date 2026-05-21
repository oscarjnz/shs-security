import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useAuth, type OAuthProvider } from "@/contexts/AuthContext";

interface ProviderMeta {
  id: OAuthProvider;
  label: string;
  icon: JSX.Element;
}

const DEFAULT_ENABLED: OAuthProvider[] = ["google", "github"];

function getEnabledProviders(): Set<OAuthProvider> {
  const raw = import.meta.env.VITE_ENABLED_PROVIDERS as string | undefined;
  if (!raw) return new Set(DEFAULT_ENABLED);
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is OAuthProvider => s === "google" || s === "github" || s === "azure");
  return new Set(list.length ? list : DEFAULT_ENABLED);
}

const ALL_PROVIDERS: ProviderMeta[] = [
  {
    id: "google",
    label: "Google",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M12 10.2v3.92h5.46c-.24 1.4-1.66 4.1-5.46 4.1-3.29 0-5.98-2.72-5.98-6.07S8.7 6.07 12 6.07c1.87 0 3.13.8 3.85 1.48l2.62-2.52C16.85 3.5 14.65 2.5 12 2.5 6.74 2.5 2.5 6.74 2.5 12s4.24 9.5 9.5 9.5c5.49 0 9.13-3.86 9.13-9.3 0-.62-.07-1.1-.16-1.58H12z"
        />
      </svg>
    ),
  },
  {
    id: "github",
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        <path d="M12 .5a11.5 11.5 0 0 0-3.63 22.42c.57.1.78-.25.78-.55v-1.92c-3.2.7-3.88-1.54-3.88-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.5 3.17-1.18 3.17-1.18.63 1.58.23 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.78 1.06.78 2.14v3.17c0 .3.21.66.79.55A11.5 11.5 0 0 0 12 .5z" />
      </svg>
    ),
  },
  {
    id: "azure",
    label: "Microsoft",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <rect x="2"  y="2"  width="9" height="9" fill="#F25022" />
        <rect x="13" y="2"  width="9" height="9" fill="#7FBA00" />
        <rect x="2"  y="13" width="9" height="9" fill="#00A4EF" />
        <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
      </svg>
    ),
  },
];

interface OAuthButtonsProps {
  disabled?: boolean;
}

export function OAuthButtons({ disabled = false }: OAuthButtonsProps) {
  const { signInWithOAuth } = useAuth();
  const [pending, setPending] = useState<OAuthProvider | null>(null);
  const enabled = getEnabledProviders();
  const providers = ALL_PROVIDERS.filter((p) => enabled.has(p.id));

  if (providers.length === 0) return null;

  const handle = async (provider: OAuthProvider) => {
    setPending(provider);
    const err = await signInWithOAuth(provider);
    if (err) {
      setPending(null);
      toast({
        title: `No se pudo iniciar sesión con ${provider}`,
        description: err,
        variant: "destructive",
      });
    }
    // On success the browser redirects to the OAuth provider — no need to clear pending.
  };

  return (
    <div className="space-y-2">
      {providers.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          disabled={disabled || pending !== null}
          onClick={() => handle(p.id)}
          className="w-full justify-center gap-2 border-cyber-border bg-cyber-dark/40 text-foreground hover:bg-cyber-dark/70"
        >
          {pending === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : p.icon}
          Continuar con {p.label}
        </Button>
      ))}
    </div>
  );
}
