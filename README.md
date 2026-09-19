# Orange Test 🟠

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJeeva-zone%2Fgoogle-ai-scan-domain&project-name=orange-test&repository-name=orange-test&env=RATE_LIMIT_SECONDS,MAX_CANDIDATES,DNS_CONCURRENCY,REQUEST_TIMEOUT,MAX_RESULTS,CF_CACHE_TTL_SECONDS)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Jeeva-zone/google-ai-scan-domain)
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jeeva-zone/google-ai-scan-domain)

> **Passive subdomain discovery & Cloudflare IP classification engine.**  
> Effortlessly uncover public subdomains from Certificate Transparency logs and identify which ones are actively fronted by Cloudflare proxy network ranges.

> **☁️ Built, hosted & served on [Freebuff Cloud](https://freebuff.com)** — the development
> workspace, the build pipeline and the [live website](https://orangecloud.freebuff.app) all run on
> Freebuff. See [Freebuff Cloud — Build & Hosting](#%EF%B8%8F-freebuff-cloud--build--hosting).

> **🌿 Branch: `client-version`** — this branch documents the **client-side build** currently live at
> <https://orangecloud.freebuff.app>. Scans run entirely in the browser (crt.sh + DNS-over-HTTPS +
> a bundled Cloudflare CIDR snapshot) with no backend required. See **[CLIENT-VERSION.md](CLIENT-VERSION.md)**
> for full details, verification evidence and limitations.

---

## 🚀 One-Click Deployment

Deploy your own production-ready instance in seconds to **Vercel**, **Netlify** or **Cloudflare Workers**:

| Platform | One-Click Deploy Button | Configuration Notes |
| :--- | :--- | :--- |
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJeeva-zone%2Fgoogle-ai-scan-domain&project-name=orange-test&repository-name=orange-test&env=RATE_LIMIT_SECONDS,MAX_CANDIDATES,DNS_CONCURRENCY,REQUEST_TIMEOUT,MAX_RESULTS,CF_CACHE_TTL_SECONDS) | Uses `vercel.json` rewrites and Python serverless handlers under `/api`. |
| **Netlify** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Jeeva-zone/google-ai-scan-domain) | Uses `netlify.toml` redirects and Python Netlify Functions in `netlify/functions`. |
| **Cloudflare Workers** | [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jeeva-zone/google-ai-scan-domain) | Uses `wrangler.jsonc` (assets-only Worker serving `dist/`) and `public/_headers`. Static hosting — the browser engine scans. |

*(Deploy links above already point at `Jeeva-zone/google-ai-scan-domain` — no edits needed.)*

---

## 📋 Table of Contents

- [Client-Side Version (this branch)](CLIENT-VERSION.md)
- [Overview & Architecture](#-overview--architecture)
- [Scan Engines](#-scan-engines)
- [Web UI Usage Manual](#-web-ui-usage-manual)
- [Variable Settings & Tuning](#-variable-settings--tuning)
- [Customizing Sample Domains](#-customizing-sample-domains)
- [REST API Reference](#-rest-api-reference)
- [Python CLI & Module Usage](#-python-cli--module-usage)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Local Development Setup](#-local-development-setup)
- [Vercel & Netlify Deployment Guide](#-vercel--netlify-deployment-guide)
- [Cloudflare Workers One-Click Deploy](#-cloudflare-workers-one-click-deploy)
- [Freebuff Cloud — Build & Hosting](#%EF%B8%8F-freebuff-cloud--build--hosting)
- [Docker & Container Deployment](#-docker--container-deployment)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [Responsible Use & Security Disclaimer](#-responsible-use--security-disclaimer)

---

## 🔍 Overview & Architecture

**Orange Test** is an open-source security intelligence utility designed for domain administrators, network auditors, and DevOps teams to audit external attack surfaces.

```
┌─────────────────┐       ┌─────────────────┐       ┌────────────────────────┐
│  Target Domain  │ ───►  │  crt.sh CT Log  │ ───►  │  Candidate Subdomains  │
│ (e.g. site.com) │       │   Query Engine  │       │     (deduplicated)     │
└─────────────────┘       └─────────────────┘       └───────────┬────────────┘
                                                                │
                                                                ▼
┌─────────────────┐       ┌─────────────────┐       ┌────────────────────────┐
│  Verified CF    │ ◄───  │ Cloudflare CIDR │ ◄───  │ Concurrent Multi-Thread│
│  Results (🟠)   │       │ IP Verification │       │   DNS Worker Pool      │
└─────────────────┘       └─────────────────┘       └────────────────────────┘
```

### Core Architecture
1. **Frontend Dashboard**: React 19 with TypeScript, Tailwind CSS, Lucide icons, and modern high-contrast dark theme.
2. **Backend Engine**: Python 3.10+ concurrent worker pool (`concurrent.futures.ThreadPoolExecutor`) resolving IPv4 (A) and IPv6 (AAAA) records.
3. **Passive Discovery**: Queries public Certificate Transparency logs (`crt.sh`) without sending active packets to origin target infrastructure.
4. **Cloudflare IP Range Verification**: Dynamically fetches and in-memory caches official Cloudflare CIDR network blocks from `https://www.cloudflare.com/ips-v4` and `ips-v6`. Matches IPs using standard binary `ipaddress.ip_network` containment checks.
5. **Strict Positive Matching**: Only hostnames resolving to verified Cloudflare IP blocks are displayed with an orange indicator (`🟠`). Unresolved or non-Cloudflare hostnames are filtered out.

---

## 🧠 Scan Engines

Orange Test ships **two interchangeable scan engines**. The app probes `/api/health` on load and automatically picks the one it can use — no configuration needed:

| | Server engine | Browser engine |
| :--- | :--- | :--- |
| **Used when** | A backend is available (local dev, Node/Vercel/Netlify deployment) | The app is served as a static site (e.g. Freebuff static hosting, Cloudflare Workers) |
| **Discovery** | `crt.sh` via Python (`urllib`) | `crt.sh` fetched directly from the browser (CORS-enabled) |
| **DNS resolution** | Python `socket.getaddrinfo` thread pool | DNS-over-HTTPS (`cloudflare-dns.com/dns-query`, A + AAAA) |
| **Cloudflare ranges** | Fetched live from Cloudflare on every cache miss | Bundled snapshot at `public/cloudflare-ranges.txt` |
| **Settings** | Server env / `.env` via `POST /api/config` | `localStorage`, applied to in-browser scans |
| **Rate limiting** | Yes (`RATE_LIMIT_SECONDS`) | Not applicable — nothing to protect server-side |

**How the switch works:** the app requests `POST /api/scan`. Static hosts answer unknown routes with the SPA HTML (or reject POSTs with `405`), which the app detects and transparently re-runs the scan in-browser. The active engine is shown in the header (`Engine: Browser (CT + DoH)` / `Engine: Server (CT + CIDR)`).

> **This branch ships the browser engine in production.** The live deployment at
> <https://orangecloud.freebuff.app> runs it exclusively — see [CLIENT-VERSION.md](CLIENT-VERSION.md).

**Browser engine notes:**
- The CIDR matcher in `src/lib/cidr.ts` is cross-validated against Python's `ipaddress` module, so both engines classify IPs identically (IPv4, IPv6, and boundary cases).
- The Cloudflare CIDR snapshot is bundled at build time. Cloudflare changes these ranges rarely — refresh `public/cloudflare-ranges.txt` from `https://www.cloudflare.com/ips-v4` and `ips-v6` when they do, then rebuild.
- Because discovery/resolution happen in the visitor's browser, the scan adds no server load and needs no API keys.

---

## 🖥️ Web UI Usage Manual

### 1. Launching a Domain Scan
1. Navigate to the web application.
2. Enter any fully qualified domain name (e.g. `speedtest.net`, `cloudflare.com`, `opensignal.com`, `useinsider.com`, `codecademy.com`) into the search bar.
   - The engine automatically strips URL prefixes (`https://`, `http://`), paths (`/blog`), and port suffixes (`:8080`).
3. Click **Scan Subdomains** (or press <kbd>Enter</kbd>).
4. You can also click any of the **Quick Example Chips** below the search input to populate and trigger a scan immediately.
   - These chips are powered by **`sample-domains.txt`** in the repository root: one domain per line, `#` comments allowed. Edit that file (locally or via a commit) and the chips update automatically — no code changes required.
5. To add more example domains, append a line to `sample-domains.txt`:
   ```text
   # Orange Test — sample domains
   speedtest.net
   cloudflare.com
   example-target.net
   ```

### 2. Monitoring Scan Progress
While the scan runs, the interface displays real-time stages:
- **Stage 1**: Querying Certificate Transparency logs (`crt.sh`).
- **Stage 2**: Parsing & deduplicating discovered candidate hostnames.
- **Stage 3**: Concurrently resolving DNS records across worker threads.
- **Stage 4**: Matching IP addresses against official Cloudflare CIDR ranges.

To abort a scan at any point, click the red **Cancel** button.

### 3. Reviewing & Filtering Results
- **Summary Metrics**: Displays total Cloudflare-protected endpoints found, unique hostnames, unique IP addresses, and total scan duration.
- **Real-Time Search**: Use the **Filter results...** input to search simultaneously across hostnames and IP addresses.
- **Copy to Clipboard**:
  - Click the copy button beside any hostname to copy the domain name.
  - Click any IP address pill to copy the IP directly.
- **Exporting Data**:
  - **Download CSV**: Downloads an RFC-compliant CSV file (`orange-test-<domain>.csv`) with `hostname,ip,cloudflare`.
- **Clear Results**: Click the trash/clear icon to reset the dashboard.

---

## ⚙️ Variable Settings & Tuning

You can tune scanning parameters on the fly via the in-app **Variable Settings** modal:
1. Click **Variable Settings** in the top navigation or the **Tune Variables** link below the search bar.
2. Adjust any parameter and click **Save Variables**. Changes take effect immediately and are saved to `.env`.

With the **browser engine** (static deployments) the same modal stores limits in the browser's `localStorage` instead — `MAX_CANDIDATES`, `DNS_CONCURRENCY`, `REQUEST_TIMEOUT` and `MAX_RESULTS` are applied to in-browser scans, while server-only settings (rate limit, CIDR cache) don't apply.

### Configurable Parameters
| Variable | Description | Recommended Default | Safe Range |
| :--- | :--- | :--- | :--- |
| `MAX_CANDIDATES` | Maximum candidate subdomains parsed from `crt.sh` | `1000` | 10 – 10,000 |
| `DNS_CONCURRENCY` | Concurrent worker threads for parallel DNS lookups | `25` | 1 – 100 threads |
| `REQUEST_TIMEOUT` | Network timeout (seconds) for HTTP calls to `crt.sh` | `30` | 5 – 180s |
| `MAX_RESULTS` | Maximum number of verified Cloudflare host-IP entries returned | `500` | 10 – 5,000 |
| `RATE_LIMIT_SECONDS` | Cooldown period between scans per client IP (`0` = disabled) | `0` | 0 – 300s |
| `CF_CACHE_TTL_SECONDS`| Cache lifetime for Cloudflare published CIDR ranges | `3600` (1 hr) | 60 – 86,400s |

### Quick Presets
- **Standard**: 1,000 candidates • 25 threads • 30s timeout • 0s cooldown
- **Fast Scan**: 250 candidates • 40 threads • 15s timeout • 0s cooldown *(ideal for quick checks)*
- **Deep Scan**: 3,000 candidates • 35 threads • 60s timeout • 0s cooldown *(ideal for large organizations)*
- **Strict 60s**: Enables a 60-second cooldown between consecutive scans per IP

---

## 🟠 Customizing Sample Domains

The quick-start **example chips** under the search bar are driven entirely by one text file — no code changes required:

**`sample-domains.txt`** (repository root):
```text
# Orange Test — sample domains
# One domain per line. Lines starting with # and blank lines are ignored.
speedtest.net
cloudflare.com
opensignal.com
useinsider.com
codecademy.com
```

**To add a domain:** append a new line (inline `# comments` are also fine) and commit — the chips update on the next page load.

**Rules:**
- One domain per line, `#` starts a comment
- Duplicates are ignored automatically
- The list is served by `GET /api/sample-domains` and cached with `no-store`, so edits are picked up immediately
- If the file is missing or empty in a deployment, a built-in default list is used

In local dev you can simply edit the file — the running server reads it fresh on every request, so changes show up without a restart.

---

## 📡 REST API Reference

The server exposes clean JSON API endpoints:

### 1. Health Check
```http
GET /api/health
```
**Response (`200 OK`):**
```json
{
  "status": "ok"
}
```

---

### 2. Scan Domain
```http
POST /api/scan
Content-Type: application/json
```
**Request Body:**
```json
{
  "domain": "speedtest.net"
}
```

**Response (`200 OK`):**
```json
{
  "success": true,
  "domain": "speedtest.net",
  "results": [
    {
      "hostname": "app.speedtest.net",
      "ip": "104.18.6.178",
      "cloudflare": true
    },
    {
      "hostname": "auth.speedtest.net",
      "ip": "104.18.37.18",
      "cloudflare": true
    }
  ],
  "count": 2,
  "duration_ms": 1420,
  "discovery_source": "crt.sh",
  "note": "Certificate Transparency discovery may not find every subdomain."
}
```

**Error Responses:**
- `400 Bad Request`:
  ```json
  { "success": false, "error": { "code": "INVALID_DOMAIN", "message": "Please enter a valid domain..." } }
  ```
- `429 Too Many Requests` (when `RATE_LIMIT_SECONDS > 0`):
  ```json
  { "success": false, "error": { "code": "RATE_LIMITED", "message": "Rate limit exceeded. Please wait 45 seconds..." } }
  ```
- `502 Bad Gateway`:
  ```json
  { "success": false, "error": { "code": "UPSTREAM_TIMEOUT", "message": "Certificate Transparency service timed out." } }
  ```

---

### 3. Read Current Variables
```http
GET /api/config
```
**Response (`200 OK`):**
```json
{
  "MAX_CANDIDATES": 1000,
  "DNS_CONCURRENCY": 25,
  "REQUEST_TIMEOUT": 30,
  "MAX_RESULTS": 500,
  "RATE_LIMIT_SECONDS": 0,
  "CF_CACHE_TTL_SECONDS": 3600
}
```

---

### 4. Update Variables
```http
POST /api/config
Content-Type: application/json

{
  "MAX_CANDIDATES": 1500,
  "DNS_CONCURRENCY": 30,
  "RATE_LIMIT_SECONDS": 0
}
```

---

### 5. Reset Rate Limit Cooldown
```http
POST /api/reset-rate-limit
```
**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Rate limit tracker reset."
}
```

---

### 6. Sample Domains
```http
GET /api/sample-domains
```
Reads `sample-domains.txt` from the repository root (one domain per line, `#` comments allowed) and powers the example chips in the web UI.
**Response (`200 OK`):**
```json
{
  "success": true,
  "domains": ["speedtest.net", "cloudflare.com", "opensignal.com", "useinsider.com", "codecademy.com"]
}
```

---

## 🐍 Python CLI & Module Usage

You can run the scanner directly in headless environments without a browser:

### CLI Usage via Terminal
```bash
# Direct JSON invocation
python3 -m backend.scanner '{"domain":"speedtest.net"}'

# Pretty printed with jq
python3 -m backend.scanner '{"domain":"opensignal.com"}' | jq .
```

### Programmatic Python Usage
```python
from backend.scanner import run_scan

# Run scan
status_code, result = run_scan("speedtest.net")

if result.get("success"):
    print(f"Discovered {len(result['results'])} Cloudflare subdomains:")
    for item in result["results"]:
        print(f" - {item['hostname']} -> {item['ip']}")
else:
    print(f"Scan failed: {result.get('error', {}).get('message')}")
```

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **npm** or **bun** / **yarn**

### 1. Clone Repository
```bash
git clone https://github.com/Jeeva-zone/google-ai-scan-domain.git
cd google-ai-scan-domain
```

### 2. Install Dependencies
```bash
# Install Node dependencies (bun recommended; npm works too)
bun install

# Install Python requirements (test tooling only — the scanner uses the stdlib)
pip install -r requirements.txt
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Automated Tests
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

---

## ☁️ Vercel & Netlify Deployment Guide

Orange Test is built with native out-of-the-box support for both **Vercel** and **Netlify**.

### Deploying to Vercel
1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com) and click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. Set the Framework Preset to **Vite**.
5. Set environment variables (optional, defaults are already provided):
   - `RATE_LIMIT_SECONDS=0`
   - `MAX_CANDIDATES=1000`
   - `DNS_CONCURRENCY=25`
   - `REQUEST_TIMEOUT=30`
   - `MAX_RESULTS=500`
6. Click **Deploy**. Vercel will automatically compile the frontend (`dist/`) and mount Python Serverless Functions defined in `/api` as configured in `vercel.json`.

---

### Deploying to Netlify
1. Push your repository to GitHub.
2. Go to [Netlify](https://app.netlify.com) and select **Add new site** -> **Import an existing project**.
3. Select your GitHub repository.
4. Netlify will auto-detect settings from `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
5. Click **Deploy site**. Netlify will host the frontend and execute the serverless Python functions under `/.netlify/functions/`.

---

## 🟠 Cloudflare Workers One-Click Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Jeeva-zone/google-ai-scan-domain)

Deploy your own copy to Cloudflare's global edge in a few clicks — no secrets, no bindings to provision,
and it stays on the free plan.

| Property | Value |
| :--- | :--- |
| Config file | [`wrangler.jsonc`](wrangler.jsonc) — **assets-only** Worker (no `main` entrypoint) |
| Build command | `npm run build` (Vite → `dist/`) |
| Deploy command | `npm run deploy` (`npx wrangler deploy`) |
| Uploaded directory | `./dist` |
| SPA routing | `not_found_handling: "single-page-application"` |
| Response headers | [`public/_headers`](public/_headers) |

### How to deploy

1. Click the button above — Cloudflare clones the repository into your own GitHub account.
2. On the setup page, accept the auto-detected commands (build `npm run build`, deploy `npx wrangler deploy`) and optionally rename the Worker.
3. Press **Deploy**. Your copy goes live at `https://<name>.<your-subdomain>.workers.dev`.

> The button clones the repository's **default branch** (`main`), which carries the same `wrangler.jsonc`.

### Verify locally before you deploy

```bash
npm run build
npx wrangler deploy --dry-run   # validates wrangler.jsonc and lists the assets that would upload
npx wrangler dev                # serves the built bundle through Wrangler locally
```

`--dry-run` needs no Cloudflare login and no API token — it is a pure local check.

### What runs where

Because `wrangler.jsonc` declares an assets-only Worker, Cloudflare serves the files in `dist/`
directly from its edge — there is no server process and no Worker script executing per request.

- **`GET /api/*`** is answered by the SPA fallback with `index.html`, so the app detects that no
  backend exists and scans in the browser — the same behaviour as
  [the Freebuff deployment](#%EF%B8%8F-freebuff-cloud--build--hosting). See [CLIENT-VERSION.md](CLIENT-VERSION.md).
- **`public/_headers`** hardens responses (`X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, `Permissions-Policy`), gives the content-hashed `assets/*` bundle a one-year
  `immutable` cache, and keeps `cloudflare-ranges.txt` on a 1-hour TTL so refreshed CIDR snapshots
  propagate quickly. It deliberately sets **no** `Content-Security-Policy` — the app calls
  `crt.sh` and `cloudflare-dns.com` from the browser and downloads CSV through a `blob:` URL, so a
  policy would have to be maintained alongside those sources.
- **`sample-domains.txt`** is compiled into the bundle at build time, so the example chips work
  without any API.

### Prefer Cloudflare Pages?

The Deploy to Cloudflare button supports **Workers** only, but Pages works just as well — connect the
repository in the dashboard under **Workers & Pages → Create → Pages → Connect to Git** with:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

`public/_headers` is honoured by Pages too. Unlike Workers, Pages does not read `wrangler.jsonc`,
so no config file is needed for that route.

---

## ☁️ Freebuff Cloud — Build & Hosting

Both the development workspace **and** the live website run on **[Freebuff Cloud](https://freebuff.com)**.
The code lives in this GitHub repository; Freebuff installs, builds and serves it.

- **Live site:** <https://orangecloud.freebuff.app>
- **Deploy mode:** Freebuff static hosting (`static_vite`) — the build writes static files into `dist/`, which Freebuff serves from its edge.
- **No extra configuration file** — commands are stored in the Freebuff project settings via `freebuff-preview`, so a fresh clone is deployable as-is.

### Configured commands

| Stage | Command | Notes |
| :--- | :--- | :--- |
| **Install** | `npm install` | The hosting builder is a Node.js-only image, so `npm` is always available |
| **Build** | `npm run build` | Runs `vite build` and bundles `server.ts` → `dist/server.cjs`, then exits (never starts a server) |
| **Preview (dev)** | `bun run dev` | Local dev server on port 3000 (`npm run dev` works too); binds `0.0.0.0` and respects the injected `PORT` |

> **Why `npm run build` and not `vite build`?** Calling `vite` directly fails on the hosting builder with
> `vite: command not found`, because that build shell does not put `node_modules/.bin` on `PATH`.
> Running the build through the package manager resolves the binaries correctly.

### Deployment workflow

| Task | Command / action |
| :--- | :--- |
| **First deploy** | Press **Deploy** in the Freebuff workspace |
| **Redeploy** | `freebuff-deploy start` (or the Deploy button) |
| **Pre-flight check** | `freebuff-deploy check` — prints the exact commands hosting will run, without spending a build |
| **Inspect a deploy** | `freebuff-deploy status` (state, framework, build time) · `freebuff-deploy logs` (build errors) |

### Production environment variables

Production variables are managed separately from the workspace `.env` files (which hold development values):

```bash
freebuff-deploy env list                                # show configured keys
freebuff-deploy env set '{"RATE_LIMIT_SECONDS":"60"}'   # applied on the next deploy
freebuff-deploy env unset RATE_LIMIT_SECONDS
```

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `MAX_CANDIDATES` | Candidate cap parsed from crt.sh | `1000` |
| `DNS_CONCURRENCY` | Parallel DNS lookups | `25` |
| `REQUEST_TIMEOUT` | Outbound HTTP timeout (seconds) | `30` |
| `MAX_RESULTS` | Maximum returned records | `500` |
| `RATE_LIMIT_SECONDS` | Per-IP scan cooldown (`0` = disabled) | `0` |
| `CF_CACHE_TTL_SECONDS` | Cloudflare CIDR cache TTL (seconds) | `3600` |

> **On this branch (`client-version`)** the deployment is static, so the app runs the browser engine and those production variables have no effect — browser-mode limits are set in the app's Variable Settings and stored per visitor. See [CLIENT-VERSION.md](CLIENT-VERSION.md).

### What this means for this project

- **Static hosting activates the browser engine automatically.** Freebuff serves `dist/` only, so `/api/*` is unavailable; the app detects that and runs scans in the visitor's browser (crt.sh + DNS-over-HTTPS + the bundled Cloudflare CIDR snapshot). No backend required.
- Running the app yourself (`npm run dev`, Docker, Vercel/Netlify) uses the **server engine** instead, which adds live CIDR fetching, Python-side concurrency and rate limiting.
- The Node server (`server.ts`) serves `dist/`, shells out to the Python scanner (`python3 -m backend.scanner`) and binds to `0.0.0.0:$PORT` (the injected port is respected automatically).
- `requirements.txt` is installed by the hosting runtime, so the Python endpoints work wherever a Python runtime is available.

---

## 🐳 Docker & Container Deployment

Run Orange Test in a portable, self-contained Docker container:

### Dockerfile
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.10-slim
WORKDIR /app
RUN apt-get update && apt-get install -y curl nodejs npm && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY backend ./backend
COPY public ./public

ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
```

### Build and Run
```bash
docker build -t orange-test:latest .
docker run -p 3000:3000 -e RATE_LIMIT_SECONDS=0 orange-test:latest
```

---

## ❓ Troubleshooting & FAQs

### Why do some domains show no results?
- The subdomains discovered for that domain either resolve to non-Cloudflare IP addresses (e.g. AWS, GCP, on-premise), or have no active public DNS records. Orange Test deliberately filters out non-Cloudflare hostnames.

### How does Orange Test verify Cloudflare IPs?
- Official CIDR ranges are obtained directly from Cloudflare's published endpoint (`https://www.cloudflare.com/ips-v4` and `ips-v6`). When an IP is resolved, Python's `ipaddress.ip_network` compares it mathematically against each CIDR block.

### Why is `crt.sh` occasionally slow or returning HTTP 502/504?
- `crt.sh` is a free, publicly funded Certificate Transparency log search service that can experience temporary traffic spikes. If this occurs, wait 10–15 seconds or click **Tune Variables** and reduce `MAX_CANDIDATES` to `250` for a faster query.

### Can I run scans without any rate limit?
- Yes! In **Variable Settings**, set `RATE_LIMIT_SECONDS` to `0`. There will be zero cooldown between scans.

### How do I change the example domains shown in the UI?
- Edit **`sample-domains.txt`** in the repository root — one domain per line — and commit. The chips refresh automatically; see [Customizing Sample Domains](#-customizing-sample-domains).

---

## ⚖️ Responsible Use & Security Disclaimer

**Orange Test** operates **strictly passively**:
- It **only** queries publicly available Certificate Transparency logs and performs standard DNS resolution queries.
- It **never** sends HTTP requests, port scans, exploit payloads, or brute-force queries to the target domain or its origin servers.
- Users are responsible for complying with all applicable laws and terms of service when conducting security assessments on external domains.

---

## 📄 License
Released under the [MIT License](LICENSE). Built for security researchers, network engineers, and domain administrators.
