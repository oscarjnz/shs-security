import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = new Set(["nmap", "ping", "traceroute", "tracert", "arp", "dig", "nslookup", "whois"]);

const PRIVATE_RANGES = [
  /^192\.168\.\d{1,3}\.\d{1,3}/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
  /^192\.168\.\d{1,3}\.0\/\d{1,2}/,
  /^10\.\d{1,3}\.\d{1,3}\.0\/\d{1,2}/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.0\/\d{1,2}/,
];

const DANGEROUS_CHARS = /[;&|`$(){}[\]!<>\\'"]/;

const SCAN_TIMEOUT_MS = 60_000;
const MAX_SCANS_PER_MINUTE = 5;

const rateLimitMap = new Map<string, number[]>();

export interface ScanIntent {
  intent: string;
  command: string;
  args: string[];
  target: string;
}

export interface ParsedDevice {
  ip: string;
  mac?: string;
  hostname?: string;
  status: string;
  os?: string;
  ports?: { port: number; service: string; state: string }[];
}

export interface ScanResult {
  intent: string;
  command: string;
  rawOutput: string;
  devices: ParsedDevice[];
  summary: string;
  durationMs: number;
}

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) ?? [];
  const recent = timestamps.filter((t) => now - t < 60_000);
  if (recent.length >= MAX_SCANS_PER_MINUTE) return false;
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return true;
}

export function validateScanIntent(intent: ScanIntent): string | null {
  if (!ALLOWED_COMMANDS.has(intent.command)) {
    return `Comando no permitido: ${intent.command}. Permitidos: ${[...ALLOWED_COMMANDS].join(", ")}`;
  }

  for (const arg of intent.args) {
    if (DANGEROUS_CHARS.test(arg)) {
      return `Argumento inválido: caracteres peligrosos detectados`;
    }
  }

  if (intent.target && DANGEROUS_CHARS.test(intent.target)) {
    return "Target contiene caracteres no permitidos";
  }

  if (intent.command === "nmap" && intent.target) {
    const isPrivate = PRIVATE_RANGES.some((r) => r.test(intent.target));
    if (!isPrivate && !intent.target.includes("localhost")) {
      return "Solo se permite escanear rangos de red privada (192.168.x.x, 10.x.x.x, 172.16-31.x.x)";
    }
  }

  return null;
}

export async function executeScan(intent: ScanIntent): Promise<ScanResult> {
  const fullArgs = [...intent.args];
  if (intent.target) fullArgs.push(intent.target);

  const start = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(intent.command, fullArgs, {
      timeout: SCAN_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    const durationMs = Date.now() - start;
    const rawOutput = stdout || stderr;
    const devices = parseNmapOutput(rawOutput, intent.command);

    return {
      intent: intent.intent,
      command: `${intent.command} ${fullArgs.join(" ")}`,
      rawOutput,
      devices,
      summary: buildSummary(devices, intent.intent, durationMs),
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : "Error desconocido";
    return {
      intent: intent.intent,
      command: `${intent.command} ${fullArgs.join(" ")}`,
      rawOutput: message,
      devices: [],
      summary: `Error ejecutando el escaneo: ${message}`,
      durationMs,
    };
  }
}

function parseNmapOutput(output: string, command: string): ParsedDevice[] {
  if (command !== "nmap") {
    return [{ ip: "—", status: "info", hostname: output.slice(0, 500) }];
  }

  const devices: ParsedDevice[] = [];
  const hostBlocks = output.split(/Nmap scan report for /);

  for (const block of hostBlocks.slice(1)) {
    const lines = block.split("\n");
    const headerLine = lines[0] ?? "";

    let ip = "";
    let hostname: string | undefined;
    const ipMatch = headerLine.match(/\(?([\d.]+)\)?/);
    if (ipMatch) ip = ipMatch[1]!;

    const hostMatch = headerLine.match(/^([^\s(]+)/);
    if (hostMatch && hostMatch[1] !== ip) hostname = hostMatch[1];

    const status = block.includes("Host is up") ? "up" : "down";

    let mac: string | undefined;
    const macMatch = block.match(/MAC Address:\s+([\dA-F:]+)/i);
    if (macMatch) mac = macMatch[1];

    let os: string | undefined;
    const osMatch = block.match(/OS details?:\s+(.+)/i) ?? block.match(/Running:\s+(.+)/i);
    if (osMatch) os = osMatch[1]?.trim();

    const ports: ParsedDevice["ports"] = [];
    const portRegex = /^(\d+)\/(tcp|udp)\s+(open|closed|filtered)\s+(\S+)/gm;
    let pm;
    while ((pm = portRegex.exec(block)) !== null) {
      ports.push({ port: Number(pm[1]), state: pm[3]!, service: pm[4]! });
    }

    if (ip) {
      devices.push({ ip, mac, hostname, status, os, ports: ports.length > 0 ? ports : undefined });
    }
  }

  return devices;
}

function buildSummary(devices: ParsedDevice[], intent: string, durationMs: number): string {
  const upCount = devices.filter((d) => d.status === "up").length;
  const totalPorts = devices.reduce((n, d) => n + (d.ports?.length ?? 0), 0);
  const seconds = (durationMs / 1000).toFixed(1);

  if (devices.length === 0) return `Escaneo completado en ${seconds}s. No se encontraron dispositivos.`;

  let msg = `Se encontraron ${devices.length} dispositivo(s) (${upCount} activo(s)) en ${seconds}s.`;
  if (totalPorts > 0) msg += ` ${totalPorts} puerto(s) detectado(s).`;
  return msg;
}

export const SCAN_SYSTEM_PROMPT = `Eres un asistente de seguridad de red que interpreta preguntas en lenguaje natural y las convierte en comandos de escaneo de red seguros.

Herramientas disponibles: nmap, ping, traceroute, tracert, arp, dig, nslookup, whois.

REGLAS:
- Solo escanear redes privadas: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
- Si el usuario no especifica un rango, usa 192.168.1.0/24 como default
- Nunca incluyas caracteres peligrosos en los argumentos
- Para descubrimiento de hosts usa: nmap -sn <rango>
- Para escaneo de puertos usa: nmap -sV <target>
- Para ping usa: ping -c 4 <target> (o -n 4 en Windows)

Responde SIEMPRE en JSON válido con esta estructura exacta:
{
  "intent": "descripción breve de lo que el usuario quiere",
  "command": "nombre del comando (nmap, ping, etc.)",
  "args": ["lista", "de", "argumentos"],
  "target": "dirección IP o rango"
}

Si la pregunta no tiene que ver con seguridad de red, responde:
{ "intent": "no_scan", "command": "", "args": [], "target": "" }`;
