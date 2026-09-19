/**
 * Scan configuration shared by the settings modal and the browser scan engine.
 *
 * When the server API is reachable, configuration lives in process env on the
 * server. In a static deployment (browser engine) there is no server, so the
 * same values are persisted in localStorage and applied client-side.
 */

export interface ScanConfig {
  MAX_CANDIDATES: number;
  DNS_CONCURRENCY: number;
  REQUEST_TIMEOUT: number;
  MAX_RESULTS: number;
  RATE_LIMIT_SECONDS: number;
  CF_CACHE_TTL_SECONDS: number;
}

export const DEFAULT_CONFIG: ScanConfig = {
  MAX_CANDIDATES: 1000,
  DNS_CONCURRENCY: 25,
  REQUEST_TIMEOUT: 30,
  MAX_RESULTS: 500,
  RATE_LIMIT_SECONDS: 0,
  CF_CACHE_TTL_SECONDS: 3600,
};

export const CONFIG_STORAGE_KEY = "orange-test:browser-config";

function coerce(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

/** Reads browser-mode configuration, falling back to defaults. */
export function loadLocalConfig(): ScanConfig {
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw) as Partial<ScanConfig>;
    return {
      MAX_CANDIDATES: coerce(parsed.MAX_CANDIDATES, DEFAULT_CONFIG.MAX_CANDIDATES),
      DNS_CONCURRENCY: coerce(parsed.DNS_CONCURRENCY, DEFAULT_CONFIG.DNS_CONCURRENCY),
      REQUEST_TIMEOUT: coerce(parsed.REQUEST_TIMEOUT, DEFAULT_CONFIG.REQUEST_TIMEOUT),
      MAX_RESULTS: coerce(parsed.MAX_RESULTS, DEFAULT_CONFIG.MAX_RESULTS),
      RATE_LIMIT_SECONDS: coerce(
        parsed.RATE_LIMIT_SECONDS,
        DEFAULT_CONFIG.RATE_LIMIT_SECONDS
      ),
      CF_CACHE_TTL_SECONDS: coerce(
        parsed.CF_CACHE_TTL_SECONDS,
        DEFAULT_CONFIG.CF_CACHE_TTL_SECONDS
      ),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Persists browser-mode configuration. */
export function saveLocalConfig(config: ScanConfig): void {
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage can be unavailable (private mode) — configuration simply resets.
  }
}
