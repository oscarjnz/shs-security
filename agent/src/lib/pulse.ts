import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { platform } from "node:os";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listLocalPrivateSubnets } from "./local-net.js";

const execFileAsync = promisify(execFile);

/* ─────────────────────────────────────────────────────────────────────────────
   Pulso de la red - Fase 1
   ───────────────────────────────────────────────────────────────────────────
   Every PULSE_INTERVAL_MS, for each device whose IP is in a subnet visible
   from THIS agent's interfaces, run a single ICMP ping with a short timeout
   and record (rtt_ms, alive) into device_pings.
   ──────────────────────────────────────────────────────────────────────────── */

const PULSE_INTERVAL_MS = Number(process.env["PULSE_INTERVAL_MS"] ?? 60_000);
const PULSE_TIMEOUT_MS  = Number(process.env["PULSE_TIMEOUT_MS"]  ?? 2_000);
const PULSE_CONCURRENCY = Number(process.env["PULSE_CONCURRENCY"] ?? 10);

const isWindows = platform() === "win32";

let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;
let lastTickStats: { startedAt: string; pinged: number; alive: number; durationMs: number } | null = null;

export function getLastPulseStats() {
  return lastTickStats;
}

/* ─── single ping ─── */

interface PingResult {
  alive: boolean;
  rttMs: number | null;
}

async function pingOnce(ip: string): Promise<PingResult> {
  // Windows: -n 1 -w <ms>
  // Linux/Mac: -c 1 -W <seconds>  (BSD ping uses -t, GNU uses -W in seconds)
  const args = isWindows
    ? ["-n", "1", "-w", String(PULSE_TIMEOUT_MS), ip]
    : ["-c", "1", "-W", String(Math.ceil(PULSE_TIMEOUT_MS / 1000)), ip];

  try {
    const { stdout } = await execFileAsync("ping", args, {
      timeout: PULSE_TIMEOUT_MS + 1000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    return parsePing(stdout);
  } catch {
    // Non-zero exit code from ping = host unreachable
    return { alive: false, rttMs: null };
  }
}

function parsePing(out: string): PingResult {
  // Windows: "Reply from 192.168.1.1: bytes=32 time=4ms TTL=64"
  // Unix:    "64 bytes from 192.168.1.1: icmp_seq=1 ttl=64 time=4.123 ms"
  const m =
    /time[=<]([0-9.]+)\s*ms/i.exec(out) ??
    /tiempo[=<]([0-9.]+)\s*ms/i.exec(out); // ping en español
  if (!m) return { alive: false, rttMs: null };
  const rtt = Number(m[1]);
  if (!Number.isFinite(rtt)) return { alive: false, rttMs: null };
  return { alive: true, rttMs: Math.round(rtt * 100) / 100 };
}

/* ─── concurrency-limited map ─── */

async function pMapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }).map(async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/* ─── pulse tick ─── */

interface DeviceRow {
  id: string;
  ip: string | null;
  user_id: string;
  status: string | null;
}

function ipInSubnet(ip: string, cidr: string): boolean {
  const [net, prefStr] = cidr.split("/");
  const prefix = Number(prefStr);
  if (!net || !Number.isFinite(prefix)) return false;
  const toInt = (s: string) =>
    s.split(".").reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
  const ipInt = toInt(ip);
  const netInt = toInt(net);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

async function runPulseTick(supabase: SupabaseClient): Promise<void> {
  if (isRunning) return; // skip if previous tick still in progress
  isRunning = true;
  const tickStart = Date.now();

  try {
    const localNets = listLocalPrivateSubnets();
    if (localNets.length === 0) return;

    // Fetch all devices whose IP looks like it's on one of our LANs.
    // We pull all candidate devices (still small, < 1000 typical) and filter.
    const { data: candidates } = await supabase
      .from("devices")
      .select("id,ip,user_id,status")
      .not("ip", "is", null)
      .limit(2000);

    if (!candidates || candidates.length === 0) return;

    const targets = (candidates as DeviceRow[]).filter((d) => {
      if (!d.ip) return false;
      return localNets.some((n) => ipInSubnet(d.ip!, n.cidr));
    });

    if (targets.length === 0) return;

    // Ping all in parallel with a concurrency cap
    const results = await pMapLimit(targets, PULSE_CONCURRENCY, async (dev) => {
      const r = await pingOnce(dev.ip!);
      return { dev, r };
    });

    const aliveCount = results.filter((x) => x.r.alive).length;

    // Bulk insert pings
    const pingRows = results.map(({ dev, r }) => ({
      device_id: dev.id,
      user_id: dev.user_id,
      rtt_ms: r.rttMs,
      alive: r.alive,
    }));

    if (pingRows.length > 0) {
      await supabase.from("device_pings").insert(pingRows);
    }

    // Update device.status only when it CHANGED, to avoid noise
    for (const { dev, r } of results) {
      const newStatus = r.alive ? "online" : "offline";
      if (dev.status !== newStatus) {
        await supabase
          .from("devices")
          .update({
            status: newStatus,
            ...(r.alive ? { last_seen: new Date().toISOString() } : {}),
          })
          .eq("id", dev.id);
      } else if (r.alive) {
        // alive AND already online -> just bump last_seen
        await supabase
          .from("devices")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", dev.id);
      }
    }

    lastTickStats = {
      startedAt: new Date(tickStart).toISOString(),
      pinged: targets.length,
      alive: aliveCount,
      durationMs: Date.now() - tickStart,
    };
  } catch (err) {
    console.error("[Pulse] tick failed:", err);
  } finally {
    isRunning = false;
  }
}

/* ─── start ─── */

export function startPulse(supabase: SupabaseClient): void {
  if (intervalHandle) return;
  console.log(`[Pulse] Starting - interval ${PULSE_INTERVAL_MS}ms, timeout ${PULSE_TIMEOUT_MS}ms, concurrency ${PULSE_CONCURRENCY}`);
  // Fire once immediately so the UI has data on first load
  void runPulseTick(supabase);
  intervalHandle = setInterval(() => void runPulseTick(supabase), PULSE_INTERVAL_MS);
}

export function stopPulse(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
