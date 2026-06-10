/**
 * LocalAgentDetector
 * ────────────────────────────────────────────────────────────────────
 * Cuando un usuario entra a su cuenta por PRIMERA vez en esta máquina
 * (controlado con localStorage por userId), preguntamos al agente local
 * — si lo hay — quién es. Si el agente está corriendo y pertenece a
 * OTRA cuenta, ofrecemos importarlo. Si no hay agente, o el agente ya
 * es de esta cuenta, o el usuario rechazó la oferta, no se muestra
 * nada y no se vuelve a preguntar.
 *
 * Reglas exactas (las del producto):
 *   - No hay agente local corriendo .................. silencio total
 *   - Hay agente local, ya está en esta cuenta ....... silencio total
 *   - Hay agente local, vinculado a otra cuenta ...... diálogo "importar"
 *
 * Diseño técnico:
 *   - El agente expone GET http://127.0.0.1:47878/whoami con CORS para
 *     este origen, devolviendo { agentId, orgId, hostname, version }.
 *   - Si el agentId NO está en la lista /api/agents de la cuenta actual,
 *     consideramos que "es de otra cuenta" (el dueño es quien tiene ese
 *     agentId asociado en su perfil, no nosotros).
 *   - Importar = generar un código de emparejamiento nuevo para ESTA
 *     cuenta + POST http://127.0.0.1:47878/repair con ese código. El
 *     agente local desempareja y se reempareja con la cuenta nueva,
 *     usando exactamente el mismo flujo que un emparejamiento normal.
 *
 * Robustez:
 *   - Cualquier error de red (CORS, EADDRINUSE, agente viejo sin
 *     servidor local, etc.) se trata como "no hay agente": el detector
 *     queda en silencio. La idea es que jamás muestre un error al
 *     usuario por el simple hecho de chequear.
 */
import { useEffect, useState, useCallback } from "react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { AGENT_URL } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Cpu } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LOCAL_AGENT_URL = "http://127.0.0.1:47878";
const DETECT_TIMEOUT_MS = 1500;
const STORAGE_KEY_PREFIX = "shs:agent-detect:";

interface WhoAmIResponse {
  ok: boolean;
  paired: boolean;
  agentId?: string;
  orgId?: string;
  hostname?: string;
  version?: string;
}

interface AccountAgent {
  id: string;
  name: string;
}

/** Fetch con timeout: nunca cuelga, nunca lanza al caller. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? DETECT_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function LocalAgentDetector(): JSX.Element | null {
  const { isSignedIn, userId, getToken } = useClerkAuth();

  // Estado del flujo
  const [localAgent, setLocalAgent] = useState<WhoAmIResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [importing, setImporting] = useState(false);

  /** Marca el flag para no volver a preguntar a este userId en esta máquina. */
  const markChecked = useCallback((uid: string) => {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${uid}`, "1");
    } catch {
      /* localStorage puede estar deshabilitado (modo privado): no es bloqueante */
    }
  }, []);

  // Detección al primer login en esta máquina para este userId.
  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const flagKey = `${STORAGE_KEY_PREFIX}${userId}`;
    let alreadyChecked = false;
    try {
      alreadyChecked = localStorage.getItem(flagKey) === "1";
    } catch {
      /* ignore */
    }
    if (alreadyChecked) return;

    let cancelled = false;

    (async () => {
      // 1. ¿Responde el agente local?
      const res = await fetchWithTimeout(`${LOCAL_AGENT_URL}/whoami`);
      if (cancelled) return;
      if (!res || !res.ok) {
        // No hay agente local (o es uno viejo sin servidor): silencio.
        markChecked(userId);
        return;
      }

      let data: WhoAmIResponse;
      try {
        data = (await res.json()) as WhoAmIResponse;
      } catch {
        markChecked(userId);
        return;
      }

      if (!data.ok || !data.paired || !data.agentId) {
        // El agente existe pero no está emparejado todavía — no es el
        // caso que nos interesa, deja que el usuario lo empareje
        // normal desde la página de Escáneres.
        markChecked(userId);
        return;
      }

      // 2. ¿Ese agentId ya pertenece a la cuenta actual?
      const token = await getToken().catch(() => null);
      if (!token) {
        // Sin token no podemos comparar; no asustar al usuario,
        // dejamos que reintente en la próxima sesión.
        return;
      }

      const accountRes = await fetchWithTimeout(`${AGENT_URL}/api/agents`, {
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 5000,
      });
      if (cancelled) return;
      if (!accountRes || !accountRes.ok) {
        // No pudimos consultar — no decimos nada, reintentamos otro día.
        return;
      }

      let accountJson: { success: boolean; data?: AccountAgent[] };
      try {
        accountJson = (await accountRes.json()) as { success: boolean; data?: AccountAgent[] };
      } catch {
        return;
      }
      const accountAgents = accountJson.data ?? [];
      const isMine = accountAgents.some((a) => a.id === data.agentId);
      if (isMine) {
        // Caso "ya tiene un agente en esta cuenta y está corriendo": silencio total.
        markChecked(userId);
        return;
      }

      // 3. Hay agente local, pero pertenece a otra cuenta → ofrecer importar.
      setLocalAgent(data);
      setNewName(data.hostname ?? "");
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId, getToken, markChecked]);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    if (userId) markChecked(userId);
  }, [userId, markChecked]);

  const handleImport = useCallback(async () => {
    if (!userId || !localAgent?.agentId) return;
    setImporting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Tu sesión expiró. Recarga la página e intenta de nuevo.");

      // 1. Generar código de emparejamiento normal para esta cuenta.
      const codeRes = await fetch(`${AGENT_URL}/api/agents/pairing-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newName.trim() || undefined }),
      });
      const codeJson = (await codeRes.json()) as {
        success: boolean;
        data?: { code: string };
        error?: string;
      };
      if (!codeRes.ok || !codeJson.success || !codeJson.data?.code) {
        throw new Error(codeJson.error ?? "No se pudo generar el código de emparejamiento.");
      }

      // 2. Pedirle al agente local que se reempareje con ese código.
      const repairRes = await fetchWithTimeout(`${LOCAL_AGENT_URL}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pairingCode: codeJson.data.code }),
        timeoutMs: 15_000,
      });
      if (!repairRes || !repairRes.ok) {
        throw new Error(
          "El agente local no aceptó el código. Asegúrate de que el agente esté corriendo y vuelve a intentar.",
        );
      }

      toast({
        title: "Escáner importado",
        description: `${newName.trim() || "El escáner"} ahora pertenece a tu cuenta.`,
      });
      setOpen(false);
      markChecked(userId);
    } catch (err) {
      toast({
        title: "No se pudo importar",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }, [userId, localAgent, newName, getToken, markChecked]);

  if (!open || !localAgent) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !importing) handleDismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Cpu className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>Ya hay un escáner corriendo en esta máquina</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              Detectamos un escáner S.S.S activo en {localAgent.hostname ? <strong>{localAgent.hostname}</strong> : "esta máquina"},
              pero está vinculado a otra cuenta. ¿Quieres importarlo a la tuya?
            </span>
            <span className="block text-xs">
              Al importarlo, el escáner pasará a aparecer en <strong>tu</strong> lista de escáneres
              y dejará de reportar a la cuenta anterior. El instalado, los permisos y nmap se
              quedan exactamente como están — no hay que reinstalar nada.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="local-agent-name">Nombre para este escáner</Label>
          <Input
            id="local-agent-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={localAgent.hostname ?? "Mi escáner"}
            disabled={importing}
            maxLength={64}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            Sugerido: el nombre del equipo. Puedes cambiarlo más tarde.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDismiss} disabled={importing}>
            No, ahora no
          </Button>
          <Button onClick={handleImport} disabled={importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Importar a mi cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
