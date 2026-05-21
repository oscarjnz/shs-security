import { spawn } from "node:child_process";

/* ─────────────────────────────────────────────────────────────────────────────
   SECURITY MODEL
   ───────────────────────────────────────────────────────────────────────────
   - Execution: spawn() with argv array (NO shell, NO concatenation → no
     command injection by construction).
   - Targets: RFC1918 by default. Public targets require explicit user
     consent + are rate-limited at 1/hour + go to a separate audit log.
   - Flags: strict regex whitelist + explicit blacklist for dangerous ones
     (file I/O, intrusive NSE scripts, raw ethernet).
   - CIDR: blocks /16 or larger to prevent abuse.
   - Timeout + maxBuffer enforced. Output streams line-by-line via SSE.
   ──────────────────────────────────────────────────────────────────────────── */

const ALLOWED_COMMANDS = new Set(["nmap", "ping", "traceroute", "tracert"]);

const PRIVATE_RANGES: RegExp[] = [
  /^192\.168\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/,
  /^localhost$/i,
];

const IP_OR_CIDR = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
const HOSTNAME = /^[a-zA-Z0-9.-]{1,253}$/;

const FLAG_WHITELIST = /^-{1,2}[A-Za-z][A-Za-z0-9_-]*([0-9,.:\/+-]*)?(=.+)?$/;
const VALUE_WHITELIST = /^[A-Za-z0-9_,.:\/+-]+$/;

const FLAG_BLACKLIST = [
  /^-o[NXGAS]?$/i,
  /^--output/i,
  /^-iL$/i,
  /^-iR$/i,
  /^--datadir/i,
  /^--resume/i,
  /^--send-eth$/i,
  /^--script-args-file/i,
  /^--script-help/i,
  /^--privileged$/i,
  /^--unprivileged$/i,
  /^-D$/i,
  /^-S$/i,
  /^-e$/i,
];

const ALLOWED_SCRIPT_CATEGORIES = new Set([
  "safe", "discovery", "default", "version", "auth-safe",
]);

const SCRIPT_BLOCK_KEYWORDS = [
  "vuln", "exploit", "brute", "dos", "malware", "intrusive", "external", "fuzzer",
];

const PRIVATE_RATE_LIMIT = 5;
const PRIVATE_RATE_WINDOW_MS = 60_000;
const PUBLIC_RATE_LIMIT = 1;
const PUBLIC_RATE_WINDOW_MS = 60 * 60_000;

const PRIVATE_TIMEOUT_MS = Number(process.env["SCAN_PRIVATE_TIMEOUT_MS"] ?? 60 * 60_000);
const PUBLIC_TIMEOUT_MS = Number(process.env["SCAN_PUBLIC_TIMEOUT_MS"] ?? 120 * 60_000);
const MAX_OUTPUT_BYTES = Number(process.env["SCAN_MAX_OUTPUT_BYTES"] ?? 16 * 1024 * 1024);

const CIDR_MIN_PREFIX = 22;

const privateRateMap = new Map<string, number[]>();
const publicRateMap = new Map<string, number[]>();

/* ─── types ─── */

export type ScanProfileId =
  | "discovery"
  | "quick_top100"
  | "quick_top1000"
  | "full_tcp"
  | "udp_common"
  | "os_detect"
  | "vuln_safe"
  | "aggressive";

export interface ScanProfile {
  id: ScanProfileId;
  name: string;
  description: string;
  flags: string[];
  etaSeconds: number;
  requiresRoot: boolean;
  warning?: string;
}

export interface ParsedPort {
  port: number;
  protocol: "tcp" | "udp";
  state: "open" | "closed" | "filtered";
  service: string;
  version?: string;
}

export interface ParsedDevice {
  ip: string;
  mac?: string;
  vendor?: string;
  hostname?: string;
  status: "up" | "down" | "unknown";
  latencyMs?: number;
  os?: string;
  ports?: ParsedPort[];
}

export interface ScanContext {
  userId: string;
  target: string;
  isPublic: boolean;
}

export interface ScanRunOptions {
  profileId?: ScanProfileId;
  customArgs?: string[];
}

export type SSEEvent =
  | { event: "progress"; data: { message: string } }
  | { event: "line"; data: { line: string } }
  | { event: "warning"; data: { code: string; message: string } }
  | { event: "known"; data: { ips: string[]; macs: string[] } }
  | { event: "device"; data: ParsedDevice }
  | { event: "threat"; data: { ip: string; port: number; service: string; severity: "medium" | "high" } }
  | { event: "summary"; data: { devices: number; ports: number; threats: number; durationMs: number } }
  | { event: "done"; data: { rawOutput: string; devices: ParsedDevice[] } }
  | { event: "error"; data: { message: string } };

/* ─── profiles ─── */

export const NMAP_PROFILES: Record<ScanProfileId, ScanProfile> = {
  discovery: {
    id: "discovery",
    name: "Descubrimiento de hosts",
    description: "Detecta qué dispositivos están vivos combinando ICMP, ARP y sondas TCP/UDP a puertos comunes. Funciona en redes con firewall.",
    flags: [
      "-sn", "-v", "-n",
      "-PE", "-PP", "-PM",
      "-PS21,22,23,25,53,80,135,139,443,445,3389,8080",
      "-PA80,443",
      "-PU53,161,5353",
    ],
    etaSeconds: 30,
    requiresRoot: false,
    warning: "En Windows: ejecuta el agent como Administrador para habilitar ARP scan (mucho más rápido y preciso). Sin admin, nmap usa TCP-connect, que es más lento y devuelve menos hosts.",
  },
  quick_top100: {
    id: "quick_top100",
    name: "Escaneo rápido (Top 100 puertos)",
    description: "Escanea los 100 puertos más comunes con detección de servicios. Ideal para inspección rápida.",
    flags: ["-T4", "--top-ports", "100", "-sV", "-v", "-n", "-Pn"],
    etaSeconds: 30,
    requiresRoot: false,
  },
  quick_top1000: {
    id: "quick_top1000",
    name: "Escaneo medio (Top 1000 puertos)",
    description: "Escanea los 1000 puertos más relevantes con detección de servicios. Balance entre velocidad y cobertura.",
    flags: ["-T4", "-F", "-sV", "-v", "-n", "-Pn"],
    etaSeconds: 60,
    requiresRoot: false,
  },
  full_tcp: {
    id: "full_tcp",
    name: "TCP completo (65535 puertos)",
    description: "Escanea TODOS los puertos TCP con detección de servicios. Lento pero exhaustivo.",
    flags: ["-p-", "-sV", "-T4", "-v", "-n", "-Pn"],
    etaSeconds: 900,
    requiresRoot: false,
    warning: "Este escaneo puede durar varios minutos y generar tráfico considerable.",
  },
  udp_common: {
    id: "udp_common",
    name: "UDP comunes (Top 50)",
    description: "Escaneo de los 50 puertos UDP más usados (DNS, DHCP, SNMP, etc.). Más lento que TCP por naturaleza del protocolo.",
    flags: ["-sU", "--top-ports", "50", "-T4", "-v", "-n", "-Pn"],
    etaSeconds: 120,
    requiresRoot: true,
    warning: "Requiere permisos elevados (root/Administrador o CAP_NET_RAW).",
  },
  os_detect: {
    id: "os_detect",
    name: "Detección de SO + servicios",
    description: "Identifica el sistema operativo, versiones de servicios y características de la pila TCP/IP.",
    flags: ["-O", "-sV", "-T4", "-v", "-n", "-Pn"],
    etaSeconds: 90,
    requiresRoot: true,
    warning: "La detección de SO requiere permisos elevados para envío de paquetes raw.",
  },
  vuln_safe: {
    id: "vuln_safe",
    name: "Análisis de vulnerabilidades (no intrusivo)",
    description: "Ejecuta scripts NSE de las categorías 'safe' y 'discovery' para detectar configuraciones débiles sin atacar.",
    flags: ["--script=safe,discovery", "-sV", "-T4", "-v", "-n", "-Pn"],
    etaSeconds: 180,
    requiresRoot: false,
  },
  aggressive: {
    id: "aggressive",
    name: "Agresivo (-A)",
    description: "Combina detección de SO, versiones, scripts por defecto y traceroute. Es lo más completo pero también lo más ruidoso.",
    flags: ["-A", "-T4", "-v", "-n", "-Pn"],
    etaSeconds: 300,
    requiresRoot: true,
    warning: "Escaneo agresivo y ruidoso. Puede activar IDS/IPS. Sólo úsalo en redes propias o con autorización.",
  },
};

/* ─── target validation ─── */

export function isPrivateTarget(target: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(target));
}

export function validateTarget(target: string): string | null {
  const t = target.trim();
  if (!t) return "El target no puede estar vacío.";
  if (t.length > 64) return "El target es demasiado largo.";
  if (!IP_OR_CIDR.test(t) && !HOSTNAME.test(t) && t !== "localhost") {
    return "Formato de target inválido. Usa una IP, un CIDR (192.168.1.0/24) o un hostname.";
  }
  if (t.includes("/")) {
    const prefix = Number(t.split("/")[1]);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return "Prefijo CIDR inválido.";
    }
    if (prefix < CIDR_MIN_PREFIX) {
      return `CIDR demasiado grande (/${prefix}). Máximo permitido: /${CIDR_MIN_PREFIX}.`;
    }
  }
  return null;
}

/* ─── flag validation ─── */

export interface FlagValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFlags(args: string[]): FlagValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (args.length > 32) {
    errors.push("Demasiados argumentos (máximo 32).");
    return { ok: false, errors, warnings };
  }

  for (const raw of args) {
    const arg = raw.trim();
    if (!arg) continue;

    if (arg.length > 128) {
      errors.push(`Argumento demasiado largo: ${arg.slice(0, 40)}...`);
      continue;
    }

    if (arg.startsWith("-")) {
      if (!FLAG_WHITELIST.test(arg)) {
        errors.push(`Flag con formato inválido: ${arg}`);
        continue;
      }

      const flagOnly = arg.split("=")[0]!;
      if (FLAG_BLACKLIST.some((re) => re.test(flagOnly))) {
        errors.push(`Flag bloqueado por seguridad: ${flagOnly}`);
        continue;
      }

      if (arg.startsWith("--script")) {
        const scriptError = validateScriptArg(arg);
        if (scriptError) errors.push(scriptError);
        continue;
      }

      if (/^-T[0-5]?$/i.test(arg)) {
        if (/^-T[45]$/i.test(arg)) {
          warnings.push("Timing T4/T5 es agresivo. Puede activar IDS o saturar la red.");
        }
        continue;
      }

      if (/^-A$/.test(arg)) {
        warnings.push("Flag -A (agresivo) combina varios escaneos intensos. Úsalo con cuidado.");
      }
    } else {
      if (!VALUE_WHITELIST.test(arg)) {
        errors.push(`Valor con caracteres no permitidos: ${arg}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

function validateScriptArg(arg: string): string | null {
  const eq = arg.indexOf("=");
  if (eq === -1) return "El argumento --script requiere un valor (ej: --script=safe,discovery).";

  const value = arg.slice(eq + 1);
  if (!value) return "El valor de --script está vacío.";

  const parts = value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  for (const part of parts) {
    for (const bad of SCRIPT_BLOCK_KEYWORDS) {
      if (part.includes(bad)) {
        return `Script bloqueado por seguridad: '${part}' (contiene '${bad}').`;
      }
    }
    if (!ALLOWED_SCRIPT_CATEGORIES.has(part)) {
      return `Script no permitido: '${part}'. Categorías permitidas: ${[...ALLOWED_SCRIPT_CATEGORIES].join(", ")}.`;
    }
  }

  return null;
}

/* ─── rate limiting ─── */

export function checkRateLimit(userId: string, isPublic: boolean): { ok: boolean; retryAfterSeconds?: number } {
  const map = isPublic ? publicRateMap : privateRateMap;
  const limit = isPublic ? PUBLIC_RATE_LIMIT : PRIVATE_RATE_LIMIT;
  const window = isPublic ? PUBLIC_RATE_WINDOW_MS : PRIVATE_RATE_WINDOW_MS;

  const now = Date.now();
  const timestamps = (map.get(userId) ?? []).filter((t) => now - t < window);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0]!;
    const retryAfterSeconds = Math.ceil((window - (now - oldest)) / 1000);
    return { ok: false, retryAfterSeconds };
  }

  timestamps.push(now);
  map.set(userId, timestamps);
  return { ok: true };
}

/* ─── execution ─── */

export interface ResolvedScan {
  command: string;
  args: string[];
  isPublic: boolean;
  timeoutMs: number;
}

export function resolveScan(target: string, options: ScanRunOptions): ResolvedScan | { error: string } {
  const targetError = validateTarget(target);
  if (targetError) return { error: targetError };

  const isPublic = !isPrivateTarget(target);

  let args: string[];

  if (options.profileId) {
    const profile = NMAP_PROFILES[options.profileId];
    if (!profile) return { error: `Perfil desconocido: ${options.profileId}` };
    args = [...profile.flags];
  } else if (options.customArgs) {
    const validation = validateFlags(options.customArgs);
    if (!validation.ok) return { error: validation.errors.join("; ") };
    args = [...options.customArgs];
  } else {
    return { error: "Debes especificar profileId o customArgs." };
  }

  args.push(target);

  return {
    command: "nmap",
    args,
    isPublic,
    timeoutMs: isPublic ? PUBLIC_TIMEOUT_MS : PRIVATE_TIMEOUT_MS,
  };
}

export interface StreamedScanResult {
  rawOutput: string;
  devices: ParsedDevice[];
  durationMs: number;
  truncated: boolean;
}

export async function streamScan(
  resolved: ResolvedScan,
  onEvent: (e: SSEEvent) => void,
): Promise<StreamedScanResult> {
  if (!ALLOWED_COMMANDS.has(resolved.command)) {
    onEvent({ event: "error", data: { message: `Comando no permitido: ${resolved.command}` } });
    return { rawOutput: "", devices: [], durationMs: 0, truncated: false };
  }

  const start = Date.now();
  let totalBytes = 0;
  let truncated = false;
  const chunks: string[] = [];
  const seenIps = new Set<string>();

  return new Promise<StreamedScanResult>((resolve) => {
    const child = spawn(resolved.command, resolved.args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      onEvent({ event: "error", data: { message: `Timeout: el escaneo excedió ${resolved.timeoutMs / 1000}s` } });
    }, resolved.timeoutMs);

    let buffer = "";

    const processBuffer = () => {
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line) continue;
        onEvent({ event: "line", data: { line } });

        const ipMatch = /Nmap scan report for (?:([^\s(]+) \()?([\d.]+)\)?/.exec(line);
        if (ipMatch) {
          const ip = ipMatch[2]!;
          if (!seenIps.has(ip)) {
            seenIps.add(ip);
            const hostname = ipMatch[1];
            const device: ParsedDevice = {
              ip,
              status: "unknown",
              ...(hostname ? { hostname } : {}),
            };
            onEvent({ event: "device", data: device });
          }
        }
      }
    };

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString("utf8");
      totalBytes += data.byteLength;
      if (totalBytes > MAX_OUTPUT_BYTES) {
        if (!truncated) {
          truncated = true;
          onEvent({ event: "line", data: { line: "[salida truncada: límite de 1MB alcanzado]" } });
          child.kill("SIGTERM");
        }
        return;
      }
      chunks.push(text);
      buffer += text;
      processBuffer();
    });

    child.stderr.on("data", (data: Buffer) => {
      const text = data.toString("utf8");
      chunks.push(text);
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        onEvent({ event: "line", data: { line: `[stderr] ${trimmed}` } });
        const warning = detectKnownWarning(trimmed);
        if (warning) onEvent({ event: "warning", data: warning });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      const msg = err.message.includes("ENOENT")
        ? `'${resolved.command}' no está instalado en el sistema.`
        : err.message;
      onEvent({ event: "error", data: { message: msg } });
      resolve({
        rawOutput: chunks.join(""),
        devices: parseNmapOutput(chunks.join("")),
        durationMs: Date.now() - start,
        truncated,
      });
    });

    child.on("close", () => {
      clearTimeout(timeout);
      if (buffer) {
        for (const line of buffer.split("\n")) {
          if (line) onEvent({ event: "line", data: { line } });
        }
      }
      const rawOutput = chunks.join("");
      const devices = parseNmapOutput(rawOutput);
      resolve({ rawOutput, devices, durationMs: Date.now() - start, truncated });
    });
  });
}

/* ─── known nmap warnings to surface in UI ─── */

function detectKnownWarning(line: string): { code: string; message: string } | null {
  const l = line.toLowerCase();
  if (l.includes("requires root") || l.includes("requires privileged") || l.includes("you requested a scan type which requires")) {
    return {
      code: "privileges",
      message: "Nmap requiere privilegios elevados para este tipo de escaneo. En Windows ejecuta el agent como Administrador (con Npcap instalado). En Linux usa sudo o `setcap cap_net_raw,cap_net_admin+eip $(which nmap)`.",
    };
  }
  if (l.includes("npcap") && (l.includes("not present") || l.includes("not installed") || l.includes("failed"))) {
    return {
      code: "npcap",
      message: "Npcap no está instalado o fallando. Descárgalo en https://npcap.com/ y reinstala con WinPcap-compat habilitado.",
    };
  }
  if (l.includes("dnet: failed to open device") || l.includes("failed to open ethernet interface")) {
    return {
      code: "interface",
      message: "Nmap no pudo abrir la interfaz de red. Verifica que Npcap esté instalado y el agent corra con permisos de Administrador.",
    };
  }
  return null;
}

/* ─── nmap output parser ─── */

export function parseNmapOutput(output: string): ParsedDevice[] {
  const devices: ParsedDevice[] = [];
  const blocks = output.split(/Nmap scan report for /);

  for (const block of blocks.slice(1)) {
    const lines = block.split("\n");
    const header = lines[0] ?? "";

    let ip = "";
    let hostname: string | undefined;
    const withParen = /^([^\s]+) \(([\d.]+)\)/.exec(header);
    if (withParen) {
      hostname = withParen[1];
      ip = withParen[2]!;
    } else {
      const noParen = /^([\d.]+)/.exec(header);
      if (noParen) ip = noParen[1]!;
    }
    if (!ip) continue;

    const status: ParsedDevice["status"] = block.includes("Host is up")
      ? "up"
      : block.includes("Host seems down") ? "down" : "unknown";

    let mac: string | undefined;
    let vendor: string | undefined;
    const macMatch = /MAC Address:\s+([\dA-F:]{17})(?:\s+\(([^)]+)\))?/i.exec(block);
    if (macMatch) {
      mac = macMatch[1]!.toUpperCase();
      if (macMatch[2] && !/^unknown$/i.test(macMatch[2].trim())) {
        vendor = macMatch[2].trim();
      }
    }

    let latencyMs: number | undefined;
    const latencyMatch = /Host is up\s+\(([\d.]+)s latency\)/i.exec(block);
    if (latencyMatch) {
      const sec = Number(latencyMatch[1]);
      if (Number.isFinite(sec)) latencyMs = Math.round(sec * 1000 * 100) / 100;
    }

    let os: string | undefined;
    const osMatch = /OS details?:\s+(.+)/i.exec(block) ?? /Running:\s+(.+)/i.exec(block);
    if (osMatch) os = osMatch[1]?.trim();

    const ports: ParsedPort[] = [];
    const portRegex = /^(\d+)\/(tcp|udp)\s+(open|closed|filtered)\s+(\S+)(?:\s+(.+))?$/gm;
    let pm: RegExpExecArray | null;
    while ((pm = portRegex.exec(block)) !== null) {
      const port: ParsedPort = {
        port: Number(pm[1]),
        protocol: pm[2] as "tcp" | "udp",
        state: pm[3] as "open" | "closed" | "filtered",
        service: pm[4]!,
        ...(pm[5] ? { version: pm[5]!.trim() } : {}),
      };
      ports.push(port);
    }

    const device: ParsedDevice = {
      ip,
      status,
      ...(mac ? { mac } : {}),
      ...(vendor ? { vendor } : {}),
      ...(hostname ? { hostname } : {}),
      ...(latencyMs !== undefined ? { latencyMs } : {}),
      ...(os ? { os } : {}),
      ...(ports.length ? { ports } : {}),
    };
    devices.push(device);
  }

  return devices;
}

/* ─── summary helper ─── */

export function buildSummary(devices: ParsedDevice[], durationMs: number): string {
  const upCount = devices.filter((d) => d.status === "up").length;
  const totalPorts = devices.reduce((n, d) => n + (d.ports?.length ?? 0), 0);
  const openPorts = devices.reduce(
    (n, d) => n + (d.ports?.filter((p) => p.state === "open").length ?? 0),
    0,
  );
  const seconds = (durationMs / 1000).toFixed(1);

  if (devices.length === 0) {
    return `Escaneo completado en ${seconds}s. No se encontraron dispositivos activos.`;
  }
  let msg = `Encontrados ${devices.length} dispositivo(s), ${upCount} activo(s) en ${seconds}s.`;
  if (totalPorts > 0) msg += ` ${openPorts} puerto(s) abierto(s) de ${totalPorts} detectado(s).`;
  return msg;
}
