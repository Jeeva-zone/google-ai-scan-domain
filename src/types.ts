/**
 * Type definitions for Orange Test application.
 */

export interface ScanResultItem {
  hostname: string;
  ip: string;
  cloudflare: true;
}

export interface ScanSuccessResponse {
  success: true;
  domain: string;
  results: ScanResultItem[];
  count: number;
  duration_ms: number;
  discovery_source: string;
  note: string;
}

export interface ScanErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ScanResponse = ScanSuccessResponse | ScanErrorResponse;

export type ScanStage =
  | "ready"
  | "validating"
  | "discovering"
  | "resolving"
  | "filtering"
  | "formatting"
  | "complete"
  | "error"
  | "canceled";
