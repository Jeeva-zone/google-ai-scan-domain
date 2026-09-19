/**
 * Build-time snapshot of Cloudflare's published IP ranges.
 *
 * Kept in its own module so the raw import (Vite-specific) never leaks into
 * `clientScanner.ts`, which is testable outside a bundler.
 */
import raw from "../../public/cloudflare-ranges.txt?raw";

export const CLOUDFLARE_RANGES_RAW: string = raw;
