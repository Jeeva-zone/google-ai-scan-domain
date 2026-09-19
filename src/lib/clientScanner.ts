/**
 * Browser (client-side) scan engine.
 *
 * Used when the app is served as a static site with no backend available
 * (for example the Freebuff static deployment). It mirrors the server engine:
 *
 *   1. Discover candidate subdomains from Certificate Transparency (crt.sh)
 *   2. Resolve candidates to IPv4/IPv6 via DNS-over-HTTPS (Cloudflare 1.1.1.1)
 *   3. Keep only IPs inside Cloudflare's published CIDR ranges
 *
 * All three sources are reachable directly from the browser (CORS enabled),
 * except the CIDR list, which is bundled at build time from
 * `public/cloudflare-ranges.txt`.
 */
import { isIpInCidrs, parseCidrList, type ParsedCidr } from "./cidr";
import { loadLocalConfig } from "./localConfig";
import type { ScanResultItem, ScanStage, ScanSuccessResponse } from "../types";

const CRT_SH_URL = "https://crt.sh/";
const DOH_URL = "https://cloudflare-dns.com/dns-query";
const DOH_HEADERS = { accept: "application/dns-json" };

export type ClientScanErrorCode =
  | "INVALID_DOMAIN"
  | "DISCOVERY_UNAVAILABLE"
  | "CANCELED"
  | "INTERNAL_ERROR";

export class ClientScanError extends Error {
  code: ClientScanErrorCode;

  constructor(code: ClientScanErrorCode, message: string) {
    super(message);
    this.name = "ClientScanError";
    this.code = code;
  }
}

export interface ClientScanOptions {
  domain: string;
  signal: AbortSignal;
  onStage?: (stage: ScanStage) => void;
  /**
   * CIDR text override. Defaults to the build-time snapshot bundled from
   * `public/cloudflare-ranges.txt` (see lib/rangesSnapshot).
   */
  rangesRaw?: string;
}

const INVALID_DOMAIN_MESSAGE =
  "Please enter a valid domain, for example: speedtest.net";
const DISCOVERY_MESSAGE =
  "Subdomain discovery is temporarily unavailable. Please try again later.";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isAborted(signal: AbortSignal): boolean {
  return signal.aborted;
}

/** fetch with both an external abort signal and a per-request timeout. */
async function fetchWithTimeout(
  url: string,
  options: { signal: AbortSignal; timeoutMs: number; headers?: Record<string, string> }
): Promise<Response> {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal, headers: options.headers });
  } finally {
    clearTimeout(timer);
    options.signal.removeEventListener("abort", onAbort);
  }
}

/** Mirrors backend/validation.py's normalization and validation. */
export function normalizeAndValidateDomain(rawInput: string): string {
  if (!rawInput || typeof rawInput !== "string") {
    throw new ClientScanError("INVALID_DOMAIN", INVALID_DOMAIN_MESSAGE);
  }

  let domain = rawInput.trim().toLowerCase();
  if (domain.startsWith("http://")) domain = domain.slice(7);
  else if (domain.startsWith("https://")) domain = domain.slice(8);
  for (const separator of ["/", "?", "#", ":"]) {
    const index = domain.indexOf(separator);
    if (index !== -1) domain = domain.slice(0, index).trim();
  }
  if (domain.endsWith(".")) domain = domain.slice(0, -1);

  if (!domain || domain.length > 253) {
    throw new ClientScanError("INVALID_DOMAIN", INVALID_DOMAIN_MESSAGE);
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(domain) || domain.includes(":")) {
    throw new ClientScanError(
      "INVALID_DOMAIN",
      "Please enter a valid domain name, not an IP address (for example: speedtest.net)"
    );
  }
  if (!domain.includes(".")) {
    throw new ClientScanError("INVALID_DOMAIN", INVALID_DOMAIN_MESSAGE);
  }

  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    throw new ClientScanError("INVALID_DOMAIN", INVALID_DOMAIN_MESSAGE);
  }
  for (const label of labels) {
    if (!label || label.length > 63 || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) {
      throw new ClientScanError("INVALID_DOMAIN", INVALID_DOMAIN_MESSAGE);
    }
  }

  return domain;
}

/** Mirrors backend/discovery.py's candidate normalization. */
export function normalizeCandidateName(rawName: string, targetDomain: string): string {
  if (!rawName) return "";

  let name = rawName.trim().toLowerCase();
  while (name.startsWith("*.") || name.startsWith("*")) {
    name = name.replace(/^\*+/, "").replace(/^\.+/, "");
  }
  if (name.endsWith(".")) name = name.slice(0, -1);
  name = name.trim();

  if (!name) return "";
  if (/[\s\t\r\n/\\@:]/.test(name)) return "";
  if (name === targetDomain || name.endsWith(`.${targetDomain}`)) return name;
  return "";
}

function ipv4FromDoH(data: string): string | null {
  const trimmed = data.trim();
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmed)) return null;
  return trimmed.split(".").every((octet) => Number(octet) <= 255) ? trimmed : null;
}

function ipv6FromDoH(data: string): string | null {
  const trimmed = data.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed.includes(":") || !/^[0-9a-f:.]+$/.test(trimmed)) return null;
  return trimmed;
}

/* ------------------------------------------------------------------ */
/* Pipeline stages                                                     */
/* ------------------------------------------------------------------ */

interface DoHAnswer {
  type?: number;
  data?: string;
}

interface DoHResponse {
  Status?: number;
  Answer?: DoHAnswer[];
}

async function discoverSubdomains(
  domain: string,
  maxCandidates: number,
  timeoutMs: number,
  signal: AbortSignal
): Promise<string[]> {
  const url = `${CRT_SH_URL}?q=%25.${encodeURIComponent(domain)}&output=json`;
  let response: Response;

  try {
    response = await fetchWithTimeout(url, { signal, timeoutMs, headers: { accept: "application/json" } });
  } catch (err) {
    if (isAborted(signal)) throw new ClientScanError("CANCELED", "Scan canceled.");
    throw new ClientScanError("DISCOVERY_UNAVAILABLE", DISCOVERY_MESSAGE);
  }

  if (!response.ok) {
    throw new ClientScanError("DISCOVERY_UNAVAILABLE", DISCOVERY_MESSAGE);
  }

  const text = await response.text();
  const candidates = new Set<string>([domain]);

  if (!text.trim()) return [...candidates];

  let entries: unknown;
  try {
    entries = JSON.parse(text);
  } catch {
    // crt.sh returns an HTML error page when it is overloaded
    throw new ClientScanError("DISCOVERY_UNAVAILABLE", DISCOVERY_MESSAGE);
  }

  if (!Array.isArray(entries)) return [...candidates];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const nameValue = (entry as { name_value?: unknown }).name_value;
    if (typeof nameValue !== "string") continue;

    for (const line of nameValue.split(/\r?\n/)) {
      const cleaned = normalizeCandidateName(line, domain);
      if (!cleaned) continue;
      candidates.add(cleaned);
      if (candidates.size >= maxCandidates) return [...candidates].sort();
    }
  }

  return [...candidates].sort();
}

async function resolveHostname(
  hostname: string,
  timeoutMs: number,
  signal: AbortSignal
): Promise<string[]> {
  const ips = new Set<string>();

  for (const [type, parse] of [
    ["A", ipv4FromDoH],
    ["AAAA", ipv6FromDoH],
  ] as const) {
    const url = `${DOH_URL}?name=${encodeURIComponent(hostname)}&type=${type}`;
    try {
      const response = await fetchWithTimeout(url, { signal, timeoutMs, headers: DOH_HEADERS });
      if (!response.ok) continue;

      const payload = (await response.json()) as DoHResponse;
      if (!payload || payload.Status !== 0 || !Array.isArray(payload.Answer)) continue;

      for (const answer of payload.Answer) {
        if (typeof answer?.data !== "string") continue;
        if (type === "A" && answer.type !== 1) continue;
        if (type === "AAAA" && answer.type !== 28) continue;
        const ip = parse(answer.data);
        if (ip) ips.add(ip);
      }
    } catch {
      if (isAborted(signal)) throw new ClientScanError("CANCELED", "Scan canceled.");
      // Unresolvable host or a transient DoH error — skip this record/type.
    }
  }

  return [...ips].sort();
}

async function resolveHostnames(
  hostnames: string[],
  concurrency: number,
  timeoutMs: number,
  signal: AbortSignal
): Promise<Array<[string, string]>> {
  if (hostnames.length === 0) return [];

  const workers = Math.max(1, Math.min(concurrency, hostnames.length, 50));
  const pairs: Array<[string, string]> = [];
  const seen = new Set<string>();
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < hostnames.length) {
      if (isAborted(signal)) throw new ClientScanError("CANCELED", "Scan canceled.");
      const hostname = hostnames[cursor++];
      const ips = await resolveHostname(hostname, timeoutMs, signal);
      for (const ip of ips) {
        const key = `${hostname}|${ip}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([hostname, ip]);
      }
    }
  };

  await Promise.all(Array.from({ length: workers }, runWorker));
  pairs.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  return pairs;
}

let cachedNetworks: ParsedCidr[] | null = null;

/** Parses the Cloudflare CIDR snapshot (cached after first use). */
export function loadCloudflareNetworks(rangesRaw: string): ParsedCidr[] {
  if (!cachedNetworks) cachedNetworks = parseCidrList(rangesRaw);
  return cachedNetworks;
}

/** Resolves the CIDR text: explicit override, else the bundled build-time snapshot. */
async function resolveRangesRaw(override?: string): Promise<string> {
  if (override) return override;
  const { CLOUDFLARE_RANGES_RAW } = await import("./rangesSnapshot");
  return CLOUDFLARE_RANGES_RAW;
}

/* ------------------------------------------------------------------ */
/* Orchestration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Runs a full passive scan entirely in the browser.
 * Stages are reported through `onStage` as the pipeline advances.
 */
export async function runClientScan(options: ClientScanOptions): Promise<ScanSuccessResponse> {
  const { signal, onStage } = options;
  const started = Date.now();
  const config = loadLocalConfig();
  const maxCandidates = Math.max(10, Math.min(config.MAX_CANDIDATES, 10000));
  const maxResults = Math.max(1, Math.min(config.MAX_RESULTS, 5000));
  const concurrency = Math.max(1, Math.min(config.DNS_CONCURRENCY, 50));
  const requestTimeoutMs = Math.max(5, Math.min(config.REQUEST_TIMEOUT, 180)) * 1000;

  onStage?.("validating");
  const domain = normalizeAndValidateDomain(options.domain);

  onStage?.("discovering");
  const candidates = await discoverSubdomains(domain, maxCandidates, requestTimeoutMs, signal);

  onStage?.("resolving");
  const pairs = await resolveHostnames(candidates, concurrency, 8000, signal);

  onStage?.("filtering");
  const networks = loadCloudflareNetworks(await resolveRangesRaw(options.rangesRaw));
  const results: ScanResultItem[] = [];
  const seen = new Set<string>();

  for (const [hostname, ip] of pairs) {
    if (!isIpInCidrs(ip, networks)) continue;
    const key = `${hostname}|${ip}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ hostname: hostname.toLowerCase(), ip, cloudflare: true });
    if (results.length >= maxResults) break;
  }

  onStage?.("formatting");

  return {
    success: true,
    domain,
    results,
    count: results.length,
    duration_ms: Math.max(Date.now() - started, 1),
    discovery_source: "crt.sh (browser)",
    note: "Scanned in-browser: Certificate Transparency discovery with DNS-over-HTTPS resolution.",
  };
}
