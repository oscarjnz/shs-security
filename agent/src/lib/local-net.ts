import { networkInterfaces } from "node:os";

export interface LocalSubnet {
  interfaceName: string;
  ip: string;
  netmask: string;
  cidr: string;
  prefix: number;
  /**
   * A scan-friendly /24 around the user's IP. Always 256 hosts max,
   * so it fits within our CIDR cap and finishes in reasonable time.
   * Equal to `cidr` if the network is already /24 or smaller.
   */
  suggestedCidr: string;
}

const PRIVATE_PREFIXES = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

export function listLocalPrivateSubnets(): LocalSubnet[] {
  const ifaces = networkInterfaces();
  const out: LocalSubnet[] = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family !== "IPv4" || a.internal) continue;
      if (!PRIVATE_PREFIXES.some((re) => re.test(a.address))) continue;

      const prefix = maskToPrefix(a.netmask);
      if (prefix === null) continue;

      const network = applyMask(a.address, prefix);
      // Always offer at most a /24 around the user's IP for scans, otherwise
      // 4k+ host networks (typical /20 / /16) blow up scan time and our cap.
      const scanPrefix = Math.max(prefix, 24);
      const scanNetwork = applyMask(a.address, scanPrefix);
      out.push({
        interfaceName: name,
        ip: a.address,
        netmask: a.netmask,
        cidr: `${network}/${prefix}`,
        prefix,
        suggestedCidr: `${scanNetwork}/${scanPrefix}`,
      });
    }
  }

  // sort: smallest /prefix first (largest network), then by ip
  out.sort((x, y) => x.prefix - y.prefix || x.ip.localeCompare(y.ip));
  return out;
}

function maskToPrefix(mask: string): number | null {
  const parts = mask.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  let total = 0;
  for (const p of parts) {
    if (p === 255) { total += 8; continue; }
    if (p === 0) { total += 0; continue; }
    let bits = 0;
    let val = p;
    while (val & 0x80) { bits++; val = (val << 1) & 0xff; }
    total += bits;
    if (val !== 0) return null;
  }
  return total;
}

function applyMask(ip: string, prefix: number): string {
  const parts = ip.split(".").map(Number);
  let bits = prefix;
  const out = parts.map((p) => {
    if (bits >= 8) { bits -= 8; return p; }
    if (bits === 0) return 0;
    const m = (0xff << (8 - bits)) & 0xff;
    bits = 0;
    return p & m;
  });
  return out.join(".");
}
