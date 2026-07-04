/**
 * Ayuda "Hay una version nueva de tu escaner. Asi lo actualizas".
 *
 * Actualizar el agente = volver a correr el instalador. El instalador baja la
 * ultima release, para el servicio/tarea, reemplaza el binario y lo deja listo.
 * NO borra el emparejamiento (la identidad vive en otra carpeta). Aqui se lo
 * explicamos al usuario por sistema operativo, con el comando listo para copiar.
 *
 * Se muestra en la pagina de Escaneres cuando algun agente reporta una version
 * por debajo de la ultima publicada (ver useLatestScannerVersion / isOutdated).
 */
import { useState } from "react";
import { ArrowUpCircle, ShieldAlert } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detectOs, type OsKey } from "@/components/scanner/scannerPairing";
import { CopyableCommand } from "@/components/scanner/AgentStartHelp";

/** Pasos para ACTUALIZAR el agente ya instalado, por sistema operativo. */
const UPDATE_STEPS: Record<
  OsKey,
  { terminal: string; admin: boolean; install: string; restart: string }
> = {
  windows: {
    terminal:
      "Abre PowerShell COMO ADMINISTRADOR (menu Inicio -> escribe 'PowerShell' -> clic derecho -> Ejecutar como administrador).",
    admin: true,
    install: "iwr https://securitysmartservices.site/install.ps1 | iex",
    restart: "Start-ScheduledTask -TaskName SHSScanner",
  },
  macos: {
    terminal: "Abre la Terminal (Cmd+Espacio -> escribe 'Terminal').",
    admin: false,
    install: "curl -fsSL https://securitysmartservices.site/install.sh | sh",
    restart: "shs-scanner start",
  },
  linux: {
    terminal: "Abre una terminal.",
    admin: false,
    install: "curl -fsSL https://securitysmartservices.site/install.sh | sh",
    restart: "sudo systemctl restart shs-scanner",
  },
};

/** Guia por SO para actualizar el agente. Reutilizable en cualquier vista. */
export function AgentUpdateHelp() {
  const [os, setOs] = useState<OsKey>(detectOs());
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Actualizar tu escaner es volver a correr el instalador: descarga la ultima version y
        reemplaza la anterior. <strong>No pierdes el emparejamiento</strong>, sigue siendo el mismo
        escaner en tu cuenta.
      </p>

      <Tabs value={os} onValueChange={(v) => setOs(v as OsKey)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="windows">Windows</TabsTrigger>
          <TabsTrigger value="macos">macOS</TabsTrigger>
          <TabsTrigger value="linux">Linux</TabsTrigger>
        </TabsList>

        {(["windows", "macos", "linux"] as OsKey[]).map((k) => {
          const s = UPDATE_STEPS[k];
          return (
            <TabsContent key={k} value={k} className="mt-3 space-y-2">
              <ol className="space-y-2 text-sm">
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 font-semibold text-primary">1.</span>
                  <span>{s.terminal}</span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 font-semibold text-primary">2.</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span>Pega este comando para instalar la ultima version:</span>
                    <CopyableCommand command={s.install} />
                  </div>
                </li>
                <li className="flex gap-2">
                  <span className="mt-0.5 shrink-0 font-semibold text-primary">3.</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <span>Vuelve a encender el escaner:</span>
                    <CopyableCommand command={s.restart} />
                  </div>
                </li>
              </ol>

              {s.admin && (
                <p className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  En Windows la ventana DEBE ser de Administrador; si no, la instalacion falla. Fijate
                  que el titulo de la ventana diga "Administrador".
                </p>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <p className="text-xs text-muted-foreground">
        Para comprobar la version: <code className="font-mono">shs-scanner version</code>. En esta
        lista, la columna Version se actualiza cuando el escaner se reconecta.
      </p>
    </div>
  );
}

/** Icono + titulo reutilizable para encabezar la ayuda de actualizacion. */
export function AgentUpdateTitle() {
  return (
    <span className="flex items-center gap-2">
      <ArrowUpCircle className="h-4 w-4 text-primary" />
      Hay una version nueva de tu escaner. Asi lo actualizas
    </span>
  );
}
