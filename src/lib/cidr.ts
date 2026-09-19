/**
 * Minimal IPv4/IPv6 CIDR parsing and containment checks for the browser scan engine.
 *
 * The server engine uses Python's `ipaddress` module; this mirrors that
 * containment behaviour so the client-side engine classifies Cloudflare IPs
 * identically. IPv4 and IPv6 values are compared as big integers with the
 * network mask applied.
 */

export interface ParsedCidr {
  network: bigint;
  mask: bigint;
  bits: 32 | 128;
}

interface ParsedIp {
  value: bigint;
  bits: 32 | 128;
}

function parseIpv4(ip: string): ParsedIp | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = (value << 8n) | BigInt(octet);
  }
  return { value, bits: 32 };
}

function parseIpv6(ip: string): ParsedIp | null {
  let text = ip.trim().toLowerCase();
  if (!text.includes(":")) return null;

  // Drop a zone identifier such as fe80::1%eth0
  const zoneIndex = text.indexOf("%");
  if (zoneIndex !== -1) text = text.slice(0, zoneIndex);

  // Rewrite a trailing IPv4 form (e.g. ::ffff:1.2.3.4) as two hex groups.
  if (text.includes(".")) {
    const lastColon = text.lastIndexOf(":");
    if (lastColon === -1) return null;
    const v4 = parseIpv4(text.slice(lastColon + 1));
    if (!v4) return null;
    const high = ((v4.value >> 16n) & 0xffffn).toString(16);
    const low = (v4.value & 0xffffn).toString(16);
    text = `${text.slice(0, lastColon + 1)}${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...new Array<string>(missing).fill("0"), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    value = (value << 16n) | BigInt(parseInt(group, 16));
  }
  return { value, bits: 128 };
}

function parseIp(ip: string): ParsedIp | null {
  const trimmed = ip.trim();
  if (!trimmed) return null;
  return trimmed.includes(":") ? parseIpv6(trimmed) : parseIpv4(trimmed);
}

/** Parses a single CIDR block such as `104.16.0.0/13` or `2606:4700::/32`. */
export function parseCidr(cidr: string): ParsedCidr | null {
  const [address, prefixText] = cidr.trim().split("/");
  const ip = parseIp(address ?? "");
  if (!ip) return null;

  const prefix =
    prefixText === undefined || prefixText === "" ? ip.bits : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > ip.bits) return null;

  const mask =
    prefix === 0 ? 0n : (((1n << BigInt(prefix)) - 1n) << BigInt(ip.bits - prefix));
  return { network: ip.value & mask, mask, bits: ip.bits };
}

/** Parses newline-separated CIDR text, ignoring blank lines and `#` comments. */
export function parseCidrList(raw: string): ParsedCidr[] {
  const networks: ParsedCidr[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parsed = parseCidr(trimmed);
    if (parsed) networks.push(parsed);
  }
  return networks;
}

/** Returns true when `ip` falls inside any of the supplied networks. */
export function isIpInCidrs(ip: string, networks: ParsedCidr[]): boolean {
  const parsed = parseIp(ip);
  if (!parsed) return false;

  for (const network of networks) {
    // IPv4 addresses only ever match IPv4 blocks (and vice versa).
    if (network.bits !== parsed.bits) continue;
    if ((parsed.value & network.mask) === network.network) return true;
  }
  return false;
}
