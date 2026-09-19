# Orange Test — Client-Side Version 🟠

> **Status:** ✅ Working & deployed
> **Live URL:** <https://orangecloud.freebuff.app>
> **Branch:** `client-version`
> **Engine:** 100% in-browser — no backend required

This document describes the **client-side build** of Orange Test: the version deployed at
<https://orangecloud.freebuff.app>. Every stage of a scan — discovery, DNS resolution and
Cloudflare matching — runs inside the visitor's browser. Nothing is sent to a server we operate.

---

## 📋 Summary

| Property | Value |
| :--- | :--- |
| Hosting | Freebuff static hosting (`static_vite` mode) |
| Backend required | **No** — the app is a static bundle |
| Discovery source | `crt.sh` Certificate Transparency logs (fetched from the browser) |
| Resolution method | DNS-over-HTTPS (A + AAAA) via `cloudflare-dns.com` |
| Cloudflare matching | Bundled CIDR snapshot (`public/cloudflare-ranges.txt`) |
| Settings storage | `localStorage` (browser), applied to in-browser scans |
| Rate limiting | Not applicable — no server resources are consumed |
| Build output | Static `dist/` (HTML + JS + CSS + snapshot file) |

---

## 🧠 How the client-side engine works

```
Browser
  │
  ├─ 1. DISCOVER ──► https://crt.sh/?q=%25.<domain>&output=json
  │                    (Certificate Transparency logs; CORS: access-control-allow-origin: *)
  │                    → candidate subdomains, wildcards normalized, deduplicated
  │
  ├─ 2. RESOLVE  ──► https://cloudflare-dns.com/dns-query?name=<host>&type=A|AAAA
  │                    (DNS-over-HTTPS; CORS: access-control-allow-origin: *)
  │                    → IPv4 (A) + IPv6 (AAAA) records, bounded concurrency
  │
  ├─ 3. FILTER   ──► Cloudflare published CIDR ranges
  │                    (bundled at build time from public/cloudflare-ranges.txt)
  │                    → keep only IPs inside Cloudflare's networks (🟠)
  │
  └─ 4. FORMAT   ──► deduplicated { hostname, ip, cloudflare: true } results
                      Copy to clipboard · Download CSV
```

**Nothing in this pipeline requires our infrastructure.** The only network calls are to crt.sh
(discovery) and Cloudflare's public DNS resolver (resolution) — both directly from the browser.

### Why client-side here?

Freebuff hosting serves this project as a **static Vite site**: `dist/` only, with no Node server
and no Python runtime. Server-side API routes (`POST /api/scan`, `GET /api/health`, …) are therefore
unavailable in production — the host answers them with the SPA HTML (`200`) or `405 Method Not Allowed`.
Rather than leave the deployed app unable to scan, this branch adds an equivalent engine that runs
in the browser.

---

## 🔁 Automatic engine selection

The app is **dual-engine** and picks the right one by itself:

1. On load it probes `GET /api/health`.
   - JSON `{"status":"ok"}` → **server engine** (a real backend is present).
   - HTML / failure → **browser engine** (static deployment).
2. Every scan calls `POST /api/scan` first. If the response is not JSON (SPA HTML) or is rejected
   with `405`/`404`, the app transparently re-runs the scan in-browser.
3. The active engine is shown in the header:
   - `Engine: Browser (CT + DoH)` — the version documented here
   - `Engine: Server (CT + CIDR)` — when a backend is running

This means the same codebase works locally with the full Python/Node stack **and** as a static
deployment, with no configuration switch.

---

## ⚙️ Settings in browser mode

The **Variable Settings** modal adapts automatically. Without a backend it stores values in the
browser's `localStorage` (key `orange-test:browser-config`) and applies them to in-browser scans:

| Setting | Applies in browser mode | Notes |
| :--- | :--- | :--- |
| `MAX_CANDIDATES` | ✅ | Caps subdomains taken from crt.sh (10–10,000) |
| `DNS_CONCURRENCY` | ✅ | Parallel DoH lookups (1–50, clamped) |
| `REQUEST_TIMEOUT` | ✅ | Per-request timeout for crt.sh queries (5–180s) |
| `MAX_RESULTS` | ✅ | Caps returned Cloudflare records |
| `RATE_LIMIT_SECONDS` | ❌ | Server-only concept |
| `CF_CACHE_TTL_SECONDS` | ❌ | Server-only; the browser uses the bundled snapshot |

Settings are per-browser — each visitor can tune their own limits without affecting anyone else.

---

## ✅ Verification evidence

The client engine was verified before and after deployment:

| Check | Result |
| :--- | :--- |
| **CIDR matcher vs Python `ipaddress`** | Identical on 30 cases — IPv4, IPv6, boundary IPs (`172.71.255.255` in /13, `172.72.0.0` out), IPv4-mapped, malformed input |
| **Live end-to-end browser pipeline** | `speedtest.net` → **52 Cloudflare records in 4.6 s** |
| **Server ⇄ browser agreement** | Same IPs found by both engines (`104.18.6.178`, `104.18.37.18`, `172.64.150.238`, `2606:4700:4407::ac40:96ee`, …) |
| **Invalid domain** | Rejected with `INVALID_DOMAIN` |
| **Mid-scan cancel** | Raised `CANCELED`, UI returns to a clean state |
| **CORS** | `crt.sh` and `cloudflare-dns.com` both return `access-control-allow-origin: *` with an `Origin` header (no preflight needed — only `accept` is sent) |
| **Deployed bundle** | Contains the engine, DoH endpoint, bundled ranges chunk and sample domains; all assets serve `200` |
| **Typecheck / tests** | `tsc --noEmit` clean · 13/13 Python tests pass |

---

## ⚠️ Limitations & honest caveats

- **CIDR snapshot freshness** — Cloudflare's range list is bundled at build time because their
  endpoint does not send CORS headers. Cloudflare changes these ranges rarely; refresh
  `public/cloudflare-ranges.txt` from <https://www.cloudflare.com/ips-v4> and `.../ips-v6`,
  then redeploy. Server-engine deployments always fetch them live.
- **Shared third-party rate limits** — crt.sh and Cloudflare DoH see requests from each visitor's
  own IP, so limits are per-visitor instead of per-server. Heavy use can still be throttled by
  those services; the app surfaces a clear "discovery unavailable" message when that happens.
- **Client bandwidth** — large scans (thousands of candidates) run on the visitor's machine and
  connection. `MAX_CANDIDATES` / `DNS_CONCURRENCY` control the load.
- **Discovery completeness** — as with the server engine, Certificate Transparency only reveals
  hostnames that have had a public certificate, and CT records do not guarantee current DNS state.
- **Browser requirements** — needs `fetch`, `AbortController` and `localStorage` (all current
  browsers). DNS-over-HTTPS is HTTPS-only.

---

## 🚀 Deployment (Freebuff static hosting)

| Stage | Command |
| :--- | :--- |
| Install | `npm install` |
| Build | `npm run build` |
| Build output | `dist/` (static) + `dist/server.cjs` (unused in static mode) |

Notes:

- The build must be invoked through the package manager (`npm run build`). Calling `vite build`
  directly fails on the hosting builder with `vite: command not found`, because the build shell
  does not put `node_modules/.bin` on `PATH`.
- The build produces static output and **exits** — it never starts a server.
- `public/cloudflare-ranges.txt` is copied into `dist/` by Vite and also bundled via a `?raw`
  import (`src/lib/rangesSnapshot.ts`), so the snapshot is available even if the file request fails.
- Validate before deploying with `freebuff-deploy check`; redeploy with `freebuff-deploy start`.

### Redeploying after a change

```bash
git push origin client-version     # or merge into main
freebuff-deploy check
freebuff-deploy start
```

---

## 🛠️ Running it locally

```bash
npm install            # or: bun install
npm run dev            # dev server on http://localhost:3000
```

Locally the API **is** available, so you get the server engine automatically. To preview the
client-side behaviour exactly as deployed, build and serve the static output without the API:

```bash
npm run build
npx serve dist          # or any static file server
```

When the API is unreachable the header switches to `Engine: Browser (CT + DoH)`.

---

## 📁 Client-side code map

| File | Purpose |
| :--- | :--- |
| `src/lib/clientScanner.ts` | Browser scan pipeline: discovery → DoH resolution → Cloudflare filtering → results |
| `src/lib/cidr.ts` | IPv4/IPv6 CIDR parsing and containment (cross-validated against Python `ipaddress`) |
| `src/lib/rangesSnapshot.ts` | Build-time `?raw` import of the Cloudflare CIDR snapshot |
| `src/lib/localConfig.ts` | Config defaults + `localStorage` persistence for browser mode |
| `public/cloudflare-ranges.txt` | Bundled Cloudflare CIDR snapshot (refreshed manually) |
| `src/App.tsx` | Engine detection, server-first scan with transparent browser fallback, engine badge |
| `src/components/DomainForm.tsx` | Example chips bundled from `sample-domains.txt` (works without an API) |
| `src/components/SettingsModal.tsx` | Settings that switch between server env and `localStorage` |

---

## 🌿 Branch workflow

- **`client-version`** — this branch: documentation and code for the deployed client-side build.
- **`main`** — kept untouched by this branch's documentation work.
- **`old-backup`** — pre-update snapshot of the project.

Changes here are additive: documentation plus the client-side engine and its support modules.
Nothing in this branch rewrites history or alters `main`.
