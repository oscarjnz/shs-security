import { useState, useEffect, useCallback } from "react";

/**
 * Suite de checks de seguridad que NO requieren agente local. Todos se
 * ejecutan desde el browser o desde Vercel functions.
 */

export type CheckStatus = "ok" | "warn" | "bad" | "neutral" | "loading" | "error";

export interface CheckResult<T = unknown> {
  status: CheckStatus;
  title: string;
  /** Texto corto que resume el resultado. */
  summary: string;
  /** Datos crudos por si la UI quiere mostrar más detalle. */
  data?: T;
  /** Si falló, el mensaje de error. */
  error?: string;
  /** Cuándo se ejecutó (ISO). */
  ranAt?: string;
}

/* ─── Network exposure (Vercel function) ─── */

export interface NetworkInfo {
  ip: string;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  org: string | null;
  asn: string;
  asnName: string | null;
  verdict: "residential" | "vpn" | "datacenter" | "mobile" | "unknown";
  flags: { isProxy: boolean; isHosting: boolean; isMobile: boolean; asnInVpnList: boolean };
}

export function useNetworkCheck() {
  const [result, setResult] = useState<CheckResult<NetworkInfo>>({
    status: "loading",
    title: "Tu conexión a internet",
    summary: "Consultando…",
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/security-checks/network")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error ?? "Error");
        const d = json.data as NetworkInfo;
        const ranAt = new Date().toISOString();

        let status: CheckStatus = "neutral";
        let summary = `Conectado desde ${d.city ?? "?"}, ${d.country ?? "?"} via ${d.isp ?? d.asnName ?? "?"}`;

        if (d.verdict === "vpn") {
          status = "ok";
          summary = `Conectado vía VPN (${d.isp ?? d.asnName}). Tu IP real está oculta.`;
        } else if (d.verdict === "datacenter") {
          status = "warn";
          summary = `Tu IP parece ser de un datacenter (${d.org ?? d.isp}). Inusual desde casa. ¿Estás en un servidor remoto?`;
        } else if (d.verdict === "mobile") {
          status = "ok";
          summary = `Datos móviles (${d.isp ?? d.asnName}, ${d.country}). NAT del operador protege bastante.`;
        } else if (d.verdict === "residential") {
          status = "warn";
          summary = `Conexión residencial directa (${d.isp ?? d.asnName}, ${d.city ?? d.country}). Sin VPN.`;
        }

        setResult({
          status,
          title: "Tu conexión a internet",
          summary,
          data: d,
          ranAt,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({
          status: "error",
          title: "Tu conexión a internet",
          summary: "No pude analizar tu conexión.",
          error: err instanceof Error ? err.message : "Error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}

/* ─── WebRTC IP leak (browser-only) ─── */

export interface WebRtcLeakInfo {
  publicIps: string[];
  localIps: string[];
  leaksLocal: boolean;
}

export function useWebRtcLeakCheck() {
  const [result, setResult] = useState<CheckResult<WebRtcLeakInfo>>({
    status: "loading",
    title: "Filtración WebRTC",
    summary: "Probando…",
  });

  useEffect(() => {
    let cancelled = false;
    detectWebRtcLeak()
      .then((info) => {
        if (cancelled) return;
        const status: CheckStatus = info.leaksLocal ? "warn" : "ok";
        const summary = info.leaksLocal
          ? `Tu navegador revela tu IP local (${info.localIps.join(", ")}). Útil para devs, pero algunos sitios la usan para fingerprinting.`
          : "Tu navegador no filtra tu IP local por WebRTC. Bien.";
        setResult({
          status,
          title: "Filtración WebRTC",
          summary,
          data: info,
          ranAt: new Date().toISOString(),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({
          status: "error",
          title: "Filtración WebRTC",
          summary: "No pude probar WebRTC en este navegador.",
          error: err instanceof Error ? err.message : "Error",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}

/* ─── Connection security (browser-only) ─── */

export interface ConnectionInfo {
  isSecureContext: boolean;
  protocol: string;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  globalPrivacyControl: boolean;
}

export function useConnectionCheck() {
  const [result] = useState<CheckResult<ConnectionInfo>>(() => {
    const info: ConnectionInfo = {
      isSecureContext: window.isSecureContext,
      protocol: window.location.protocol,
      cookiesEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack === "1",
      globalPrivacyControl:
        (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    };
    const issues: string[] = [];
    if (!info.isSecureContext) issues.push("conexión no segura");
    if (!info.cookiesEnabled) issues.push("cookies bloqueadas (afecta el login)");

    let status: CheckStatus = "ok";
    let summary = "Tu navegador y conexión están en orden (HTTPS + cookies + privacidad).";
    if (issues.length > 0) {
      status = "warn";
      summary = `Detectamos: ${issues.join(", ")}.`;
    } else if (!info.doNotTrack && !info.globalPrivacyControl) {
      status = "neutral";
      summary = "Conexión segura. Tu navegador no envía señales de privacidad (DNT / GPC), es opcional.";
    }

    return {
      status,
      title: "Navegador y conexión",
      summary,
      data: info,
      ranAt: new Date().toISOString(),
    };
  });
  // Static result, no effect needed
  return result;
}

/* ─── Pwned password check (on demand) ─── */

export interface PwnedResult {
  count: number;
  pwned: boolean;
}

export function usePwnedPasswordCheck() {
  const [result, setResult] = useState<CheckResult<PwnedResult>>({
    status: "neutral",
    title: "¿Tu contraseña fue filtrada?",
    summary: "Escribe una contraseña para comprobar contra Have I Been Pwned. No se envía nunca el texto completo.",
  });

  const check = useCallback(async (password: string) => {
    if (!password) return;
    setResult((r) => ({ ...r, status: "loading", summary: "Comprobando…", error: undefined }));

    try {
      const hash = await sha1Hex(password);
      const prefix = hash.slice(0, 5).toUpperCase();
      const suffix = hash.slice(5).toUpperCase();

      const res = await fetch(`/api/security-checks/pwned-password?prefix=${prefix}`);
      if (!res.ok) throw new Error(`Servidor devolvió ${res.status}`);
      const text = await res.text();

      let count = 0;
      for (const line of text.split("\n")) {
        const [s, c] = line.split(":");
        if (s && s.toUpperCase() === suffix) {
          count = Number((c ?? "0").trim());
          break;
        }
      }

      const pwned = count > 0;
      setResult({
        status: pwned ? "bad" : "ok",
        title: "¿Tu contraseña fue filtrada?",
        summary: pwned
          ? `Tu contraseña apareció en ${count.toLocaleString("es")} filtraciones públicas. Cámbiala YA en cualquier servicio donde la uses.`
          : "No encontramos tu contraseña en las filtraciones públicas. (Bien, pero igual usa una distinta por servicio).",
        data: { count, pwned },
        ranAt: new Date().toISOString(),
      });
    } catch (err) {
      setResult({
        status: "error",
        title: "¿Tu contraseña fue filtrada?",
        summary: "No pude verificar la contraseña.",
        error: err instanceof Error ? err.message : "Error",
      });
    }
  }, []);

  return { result, check };
}

/* ─── helpers ─── */

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function detectWebRtcLeak(): Promise<WebRtcLeakInfo> {
  return new Promise<WebRtcLeakInfo>((resolve, reject) => {
    if (typeof RTCPeerConnection === "undefined") {
      reject(new Error("WebRTC no disponible"));
      return;
    }
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.createDataChannel("");
    const publicIps = new Set<string>();
    const localIps = new Set<string>();
    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-fA-F0-9:]+:+[a-fA-F0-9:]+)/g;

    const isPrivate = (ip: string) =>
      /^10\./.test(ip) ||
      /^192\.168\./.test(ip) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
      /^127\./.test(ip) ||
      /^169\.254\./.test(ip) ||
      /^fe80:/i.test(ip) ||
      /^fc/i.test(ip);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const m = e.candidate.candidate.match(ipRegex);
      if (!m) return;
      for (const ip of m) {
        if (isPrivate(ip)) localIps.add(ip);
        else publicIps.add(ip);
      }
    };

    pc.createOffer()
      .then((o) => pc.setLocalDescription(o))
      .catch(() => {
        /* ignore */
      });

    setTimeout(() => {
      try { pc.close(); } catch {}
      resolve({
        publicIps: Array.from(publicIps),
        localIps: Array.from(localIps),
        leaksLocal: localIps.size > 0,
      });
    }, 1500);
  });
}
