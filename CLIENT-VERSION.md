# Orange Test — Client-Side Version 🟠

> **Status:** ✅ Working & deployed
> **Live URL:** <https://orangecloud.freebuff.app>
> **Platform:** [Freebuff Cloud](https://freebuff.com) — workspace, build and hosting
> **Branch:** `client-version`
> **Engine:** 100% in-browser — no backend required

This document describes the **client-side build** of Orange Test: the version deployed at
<https://orangecloud.freebuff.app>. Every stage of a scan — discovery, DNS resolution and
Cloudflare matching — runs inside the visitor's browser. Nothing is sent to a server we operate.

**Contents**

1. [Summary](#-summary)
2. [How the client-side engine works](#-how-the-client-side-engine-works)
3. [Technical reference](#-technical-reference)
4. [Automatic engine selection](#-automatic-engine-selection)
5. [Settings in browser mode](#%EF%B8%8F-settings-in-browser-mode)
6. [Measured performance](#-measured-performance)
7. [Verification evidence](#-verification-evidence)
8. [Privacy & data flow](#-privacy--data-flow)
9. [Limitations & honest caveats](#%EF%B8%8F-limitations--honest-caveats)
10. [Browser requirements](#-browser-requirements)
11. [Built & hosted on Freebuff Cloud](#%EF%B8%8F-built--hosted-on-freebuff-cloud)
12. [Running it locally](#%EF%B8%8F-running-it-locally)
13. [Reproducing the verification](#-reproducing-the-verification)
14. [Troubleshooting](#-troubleshooting)
15. [Client-side code map](#-client-side-code-map)
16. [Branch workflow](#-branch-workflow)

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

## 🔬 Technical reference

### Network calls made by a scan

Every request is issued **by the visitor's browser directly** — there is no proxy, no server of
ours, and no API key.

| # | Endpoint | Purpose | Headers sent | CORS |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET https://crt.sh/?q=%25.<domain>&output=json` | Certificate Transparency subdomain discovery | `accept: application/json` | `access-control-allow-origin: *` |
| 2 | `GET https://cloudflare-dns.com/dns-query?name=<host>&type=A` | IPv4 resolution (DoH JSON) | `accept: application/dns-json` | `access-control-allow-origin: *` |
| 3 | `GET https://cloudflare-dns.com/dns-query?name=<host>&type=AAAA` | IPv6 resolution (DoH JSON) | `accept: application/dns-json` | `access-control-allow-origin: *` |
| 4 | `GET /cloudflare-ranges.txt` (own origin) | CIDR snapshot fallback | — | same-origin |

Only `accept` is sent, so requests stay in the **CORS simple-request** category and never trigger a
preflight `OPTIONS`. Cloudflare's ranges endpoint (`cloudflare.com/ips-v4`) sends no CORS headers at
all, which is exactly why the ranges are bundled instead of fetched (see
[Limitations](#%EF%B8%8F-limitations--honest-caveats)).

### Limits, clamps and timeouts

All values come from the visitor's in-app settings and are clamped in code (`src/lib/clientScanner.ts`):

| Setting | Default | Accepted range | Applied as |
| :--- | :--- | :--- | :--- |
| `MAX_CANDIDATES` | `1000` | 10 – 10,000 | Cap on distinct hostnames taken from crt.sh |
| `DNS_CONCURRENCY` | `25` | 1 – 50 | Parallel DoH workers (also capped by hostname count) |
| `REQUEST_TIMEOUT` | `30` s | 5 – 180 s | Timeout for the crt.sh discovery request |
| `MAX_RESULTS` | `500` | 1 – 5,000 | Cap on returned Cloudflare records |
| DoH per-request timeout | `8` s | fixed | Timeout for each A/AAAA lookup |
| IPv6 lookups | 6 (`ipv6=6` for speedtest.net in testing) | — | `AAAA` answers that matched Cloudflare |

### Result shape

The browser engine returns the same response contract as the server, so the UI is identical in both
modes. It is mirrored on `src/types.ts` (`ScanSuccessResponse`):

```json
{
  "success": true,
  "domain": "speedtest.net",
  "results": [
    { "hostname": "speedtest.net", "ip": "104.18.6.178", "cloudflare": true }
  ],
  "count": 52,
  "duration_ms": 5889,
  "discovery_source": "crt.sh (browser)",
  "note": "Scanned in-browser: Certificate Transparency discovery with DNS-over-HTTPS resolution."
}
```

### Error taxonomy

| Code | Raised when | UI behaviour |
| :--- | :--- | :--- |
| `INVALID_DOMAIN` | Input is empty, over 253 chars, an IP, has a bad label/TLD, etc. | Inline field error, no scan starts |
| `DISCOVERY_UNAVAILABLE` | crt.sh is unreachable, returns non-2xx, or returns an HTML error page instead of JSON | "Subdomain discovery is temporarily unavailable" message |
| `CANCELED` | The visitor presses Cancel — the shared `AbortSignal` fires mid-request | Stage card resets, progress returns to `Ready` |
| `INTERNAL_ERROR` | Unexpected failure anywhere else | Generic error state with the message shown |

### Parity with the server engine

The browser engine deliberately re-implements the Python logic instead of approximating it:

| Concern | Server implementation | Browser implementation |
| :--- | :--- | :--- |
| Domain normalization/validation | `backend/validation.py` | `normalizeAndValidateDomain()` in `src/lib/clientScanner.ts` |
| Candidate cleanup (wildcards, dedupe, suffix match) | `backend/discovery.py` | `normalizeCandidateName()` |
| CIDR containment | `backend/cloudflare_ranges.py` + Python `ipaddress` | `src/lib/cidr.ts` (`isIpInCidrs`) |
| Deduplication of `hostname|ip` pairs | yes | yes |
| Result ordering | sorted by hostname then IP | sorted by hostname then IP |

The CIDR matcher was cross-validated against Python's `ipaddress` on 30 cases (see
[Verification evidence](#-verification-evidence)), so a record classified as Cloudflare in the
browser is classified identically by the server and vice versa.

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

## 📊 Measured performance

Timings below are **real measurements** taken against the live `crt.sh` and `cloudflare-dns.com`
services for `speedtest.net` with default settings:

| Stage | Time | Notes |
| :--- | ---: | :--- |
| 1 · Discovery (crt.sh) | **4.4 s** | 2,673 CT entries → 65 unique hostnames; dominates total runtime |
| 2 · Resolution (DoH, A + AAAA) | **~1.4 s** | 25 parallel workers against Cloudflare DoH |
| 3 · Filtering (CIDR matching) | < 10 ms | Pure in-memory matching, cached parsed ranges |
| **Total (end-to-end)** | **5.9 s** | 52 Cloudflare records across 23 hostnames, 6 of them IPv6 |

Observed variation across runs:

| Run | Total | Results |
| :--- | ---: | ---: |
| Fast | 4.6 s | 52 |
| Typical | 5.9 s | 52 |
| Slow (crt.sh throttled) | 26.6 s | 52 |

> **Where the time goes:** crt.sh latency swings from ~3.5 s to ~25 s depending on load, and it is
> the single biggest factor. Resolution and filtering are consistently sub-second. Beyond the
> discovery stage, nothing in this pipeline depends on our infrastructure. The engine reports the
> measured total in `duration_ms` on every scan.

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

## 🔒 Privacy & data flow

| Question | Answer |
| :--- | :--- |
| Does a scan touch our servers? | **No.** The browser calls crt.sh and Cloudflare's public DoH resolver directly; we never receive the domain or the results |
| Is anything stored server-side? | **No** — there is no server in this deployment |
| Is anything stored locally? | Only the settings object in `localStorage` under `orange-test:browser-config` |
| Cookies / analytics / tracking | **None** |
| Who sees the scanned domain? | `crt.sh` (in its request path) and Cloudflare's DoH resolver — the same exposure as a normal DNS lookup |
| What about the export? | CSV download and clipboard copy are generated **client-side**; the file never leaves the machine |

Because the requests come from the visitor's own browser, third-party rate limits apply per visitor
rather than per server, and no shared quota is consumed by anybody else.

> Running the server engine yourself (`npm run dev`, Docker, Vercel/Netlify) changes this: there,
> the requests originate from your host, and rate limiting plus CIDR caching apply.

---

## 🖥️ Browser requirements

| Requirement | Why | Detection |
| :--- | :--- | :--- |
| `fetch` + `Response.json()` | all network stages | assumed (ES2020 target) |
| `AbortController` / `AbortSignal` | per-request timeouts + mid-scan cancel | used by `fetchWithTimeout` |
| `localStorage` | persisting settings in browser mode | wrapped in try/catch, falls back to defaults |
| HTTPS | DNS-over-HTTPS calls and mixed-content rules | any modern browser on `https://` |
| ES2020 modules + dynamic `import()` | the ranges snapshot is code-split and loaded on demand | Vite build target |

Verified working in current Chromium-based browsers; no legacy (IE) support is attempted.

---

## ☁️ Built & Hosted on Freebuff Cloud

Both the workspace this branch was developed in **and** the live site run on
**[Freebuff Cloud](https://freebuff.com)**. The GitHub repository is the source of truth;
Freebuff installs, builds and serves it.

| Property | Value |
| :--- | :--- |
| Platform | [Freebuff Cloud](https://freebuff.com) |
| Live URL | <https://orangecloud.freebuff.app> |
| Hosting mode | `static_vite` (static files only — no server, no Python runtime) |
| Deployed ref | `client-version` |
| Configuration | Stored in Freebuff project settings via `freebuff-preview` — no config file in the repo |

### Configured commands

| Stage | Command | Why |
| :--- | :--- | :--- |
| **Install** | `npm install` | The hosting builder is a Node.js-only image — `npm` is guaranteed present |
| **Build** | `npm run build` | Runs `vite build` + bundles `server.ts` → `dist/server.cjs`, then exits |
| **Preview (dev)** | `bun run dev` | Local dev server on port 3000 (`npm run dev` works too) |
| **Build output** | `dist/` (static) | `dist/server.cjs` is produced but unused in static mode |

> **Why `npm run build` and not `vite build`?** Invoking `vite` directly fails on the hosting
> builder with `/bin/bash: vite: command not found`, because the build shell does not put
> `node_modules/.bin` on `PATH`. Running the build through the package manager resolves the
> binaries correctly. This was the fix for the first failed deploy of this branch.

### Deploy workflow

| Task | Command / action |
| :--- | :--- |
| **First deploy** | Press **Deploy** in the Freebuff workspace (required once) |
| **Redeploy** | `freebuff-deploy start` — or the Deploy button |
| **Pre-flight check** | `freebuff-deploy check` — shows the exact commands hosting will run and any problems, without spending a build |
| **Deploy status** | `freebuff-deploy status` — state (`deploying`/`active`/`error`), mode, file count |
| **Build errors** | `freebuff-deploy logs` |

```bash
git push origin client-version     # ship the change
freebuff-deploy check              # confirm hosting config is valid
freebuff-deploy start              # redeploy
```

### Production environment variables

Production variables on Freebuff are separate from the workspace `.env` files:

```bash
freebuff-deploy env list
freebuff-deploy env set '{"MAX_CANDIDATES":"500"}'
freebuff-deploy env unset MAX_CANDIDATES
```

> **These do not affect this branch's deployment.** In static mode there is no server reading
> `process.env`; the browser engine takes its limits from the in-app **Variable Settings**
> (per-visitor `localStorage`). Production env vars only matter when the server engine is running
> — see the table in [Settings in browser mode](#%EF%B8%8F-settings-in-browser-mode).

### Static-hosting specifics

- Freebuff serves `dist/` only, so `/api/health`, `/api/scan`, `/api/config`, `/api/reset-rate-limit`
  and `/api/sample-domains` are **not** reachable. Known responses from the live static host:
  - `GET /api/*` → the SPA `index.html` (`200`, `content-type: text/html`), which the app recognises
    as "no API" and switches engines
  - `POST /api/scan` → `405 Method Not Allowed`, empty body
- `public/cloudflare-ranges.txt` is copied verbatim into `dist/` **and** bundled through a `?raw`
  import (`src/lib/rangesSnapshot.ts`), so the CIDR snapshot is available even if the file request fails.
- `sample-domains.txt` is also bundled at build time, so the example chips render without a backend.
- No server process and no Python runtime exist in production — the scanner's Node/Python code is
  inert there.

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

## 🧪 Reproducing the verification

Everything claimed in this document can be re-checked from a fresh clone:

```bash
npm install                     # or: bun install

# 1. Type safety of the client engine and its consumers
npx tsc --noEmit

# 2. Server-side parity suite (validation, discovery, CIDR, formatting)
python3 -m unittest discover tests -v      # 13/13 pass

# 3. Production build — must emit dist/ and exit
npm run build
ls dist/ | head                             # index.html, assets/, cloudflare-ranges.txt

# 4. Client-side behaviour without a backend
npx serve dist                              # open it: header shows "Engine: Browser (CT + DoH)"
```

To exercise the engine's code path outside a browser (as was done during development), import
`runClientScan` from `src/lib/clientScanner.ts` and pass the CIDR text explicitly, since the
`?raw` snapshot import is Vite-only:

```ts
import { readFileSync } from "node:fs";
import { runClientScan } from "./src/lib/clientScanner";

const out = await runClientScan({
  domain: "speedtest.net",
  signal: new AbortController().signal,
  rangesRaw: readFileSync("public/cloudflare-ranges.txt", "utf8"),
});
console.log(out.count, out.results.slice(0, 3));
```

---

## 🧯 Troubleshooting

| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| Header says `Engine: Browser (CT + DoH)` even locally | The API probe failed — the Node server isn't running or is on another port | Start the dev server (`npm run dev`); confirm `curl localhost:3000/api/health` returns `{"status":"ok"}` |
| "Subdomain discovery is temporarily unavailable" | crt.sh is overloaded or rate-limiting, or returned an HTML error page | Retry in a minute; lower `DNS_CONCURRENCY`/`MAX_CANDIDATES`; the same message appears if your network blocks `crt.sh` |
| Scan finishes with `0` results | The domain either has no live Cloudflare-fronted hosts, or nothing resolved | Try `speedtest.net` as a control — it returns ~52 records |
| Fewer IPv6 rows than expected | The host has no `AAAA` record, or the resolver filtered it | Expected: CT reveals hostnames, not record types |
| Built site has no CIDR snapshot | `public/cloudflare-ranges.txt` missing from the build | It is copied by Vite from `public/`; re-run `npm run build` and check `dist/cloudflare-ranges.txt` |
| `vite: command not found` on a deploy | A deploy build invoked `vite` directly | Use `npm run build`, which resolves `node_modules/.bin` through the package manager |
| Settings seem ignored | Values are stored per browser/origin | Re-open the site on the same origin; check `localStorage["orange-test:browser-config"]` |
| Newly added sample domain not shown | Static builds bundle `sample-domains.txt` at build time | Commit the change and redeploy — the snapshot only refreshes on build |

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
  Documents the client-side engine plus the Freebuff Cloud build/hosting setup that serves
  <https://orangecloud.freebuff.app>.
- **`main`** — the primary branch; carries the Freebuff Cloud build & hosting section in its
  README as well, so the platform is documented wherever the code is browsed.
- **`old-backup`** — pre-update snapshot of the project; the Freebuff Cloud section was added to its
  README as a documentation-only commit on top of the original snapshot (commit `6974c17` remains
  intact in its history).

Changes here are additive: documentation plus the client-side engine and its support modules.
Nothing in this branch rewrites history or alters `main`.
