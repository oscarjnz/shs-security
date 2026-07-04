/**
 * Version "latest" publicada del scanner-agent.
 *
 * En vez de hardcodear el numero (que se desincroniza en cada release, justo
 * el bug que ya pasamos con 0.1.0 vs 0.1.4), lo leemos en vivo de la API publica
 * de GitHub Releases del repo del agente. Asi cuando Oscar publica una release
 * nueva, el portal avisa a los usuarios de la actualizacion sin tocar codigo.
 *
 * Se cachea en localStorage un rato para no pegarle a GitHub en cada carga
 * (el rate-limit sin token es 60/h por IP). Si la llamada falla o no hay red,
 * degradamos suave: no mostramos badge de "actualizacion", pero la guia de
 * "como actualizar" sigue disponible.
 */
import { useEffect, useState } from "react";

/** Repo publico del agente (mismo que usan los instaladores). */
export const SCANNER_GITHUB_REPO = "oscarjnz/shs-scanner-agent";

const CACHE_KEY = "sss-scanner-latest-version";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

interface CachedVersion {
  version: string;
  fetchedAt: number;
}

/** Quita una 'v' inicial y espacios: "v0.1.5" -> "0.1.5". */
function normalize(tag: string): string {
  return tag.trim().replace(/^v/i, "");
}

/**
 * Compara dos versiones semver simples (a.b.c). Devuelve:
 *   < 0 si a es MENOR que b, 0 si iguales, > 0 si a es MAYOR.
 * Ignora sufijos raros; compara solo los segmentos numericos.
 */
export function compareVersions(a: string, b: string): number {
  const pa = normalize(a).split(".").map((n) => parseInt(n, 10) || 0);
  const pb = normalize(b).split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/**
 * true si `current` (la version que reporta un agente) esta por debajo de
 * `latest`. Si falta cualquiera de las dos, devolvemos false (no molestamos
 * con avisos cuando no tenemos datos fiables).
 */
export function isOutdated(current: string | null | undefined, latest: string | null | undefined): boolean {
  if (!current || !latest) return false;
  return compareVersions(current, latest) < 0;
}

function readCache(): string | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedVersion;
    if (!parsed.version || Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.version;
  } catch {
    return null;
  }
}

function writeCache(version: string): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ version, fetchedAt: Date.now() } satisfies CachedVersion));
  } catch {
    /* noop */
  }
}

/**
 * Hook: devuelve la ultima version publicada del agente (o null mientras carga
 * / si falla). Cachea el resultado para no repetir la llamada.
 */
export function useLatestScannerVersion(): string | null {
  const [latest, setLatest] = useState<string | null>(() => readCache());

  useEffect(() => {
    if (latest) return; // ya la tenemos (cache fresca)
    let cancelled = false;
    (async () => {
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(`https://api.github.com/repos/${SCANNER_GITHUB_REPO}/releases/latest`, {
          headers: { Accept: "application/vnd.github+json" },
          signal: ctrl.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return;
        const json = (await res.json()) as { tag_name?: string };
        const tag = json?.tag_name ? normalize(json.tag_name) : null;
        if (tag && !cancelled) {
          writeCache(tag);
          setLatest(tag);
        }
      } catch {
        /* sin red / rate-limit: degradamos suave */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latest]);

  return latest;
}
