# Orange Test 🟠

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fusername%2Forange-test&project-name=orange-test&repository-name=orange-test&env=RATE_LIMIT_SECONDS,MAX_CANDIDATES,DNS_CONCURRENCY,REQUEST_TIMEOUT,MAX_RESULTS,CF_CACHE_TTL_SECONDS)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/username/orange-test)

> **Passive subdomain discovery & Cloudflare IP classification engine.**  
> Effortlessly uncover public subdomains from Certificate Transparency logs and identify which ones are actively fronted by Cloudflare proxy network ranges.

---

## 🚀 One-Click Deployment

Deploy your own production-ready instance in seconds to **Vercel** or **Netlify**:

| Platform | One-Click Deploy Button | Configuration Notes |
| :--- | :--- | :--- |
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fusername%2Forange-test&project-name=orange-test&repository-name=orange-test&env=RATE_LIMIT_SECONDS,MAX_CANDIDATES,DNS_CONCURRENCY,REQUEST_TIMEOUT,MAX_RESULTS,CF_CACHE_TTL_SECONDS) | Uses `vercel.json` rewrites and Python serverless handlers under `/api`. |
| **Netlify** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/username/orange-test) | Uses `netlify.toml` redirects and Python Netlify Functions in `netlify/functions`. |

*(Note: Replace `username/orange-test` in the deploy link with your actual GitHub repository slug.)*

---

## 📋 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Web UI Usage Manual](#-web-ui-usage-manual)
- [Variable Settings & Tuning](#-variable-settings--tuning)
- [REST API Reference](#-rest-api-reference)
- [Python CLI & Module Usage](#-python-cli--module-usage)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Local Development Setup](#-local-development-setup)
- [Vercel & Netlify Deployment Guide](#-vercel--netlify-deployment-guide)
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
1. **Frontend Dashboard**: React 18 with TypeScript, Tailwind CSS, Lucide icons, and modern high-contrast dark theme.
2. **Backend Engine**: Python 3.10+ concurrent worker pool (`concurrent.futures.ThreadPoolExecutor`) resolving IPv4 (A) and IPv6 (AAAA) records.
3. **Passive Discovery**: Queries public Certificate Transparency logs (`crt.sh`) without sending active packets to origin target infrastructure.
4. **Cloudflare IP Range Verification**: Dynamically fetches and in-memory caches official Cloudflare CIDR network blocks from `https://www.cloudflare.com/ips-v4` and `ips-v6`. Matches IPs using standard binary `ipaddress.ip_network` containment checks.
5. **Strict Positive Matching**: Only hostnames resolving to verified Cloudflare IP blocks are displayed with an orange indicator (`🟠`). Unresolved or non-Cloudflare hostnames are filtered out.

---

## 🖥️ Web UI Usage Manual

### 1. Launching a Domain Scan
1. Navigate to the web application.
2. Enter any fully qualified domain name (e.g. `speedtest.net`, `cloudflare.com`, `opensignal.com`, `useinsider.com`, `codecademy.com`) into the search bar.
   - The engine automatically strips URL prefixes (`https://`, `http://`), paths (`/blog`), and port suffixes (`:8080`).
3. Click **Scan Subdomains** (or press <kbd>Enter</kbd>).
4. You can also click any of the **Quick Example Chips** below the search input to populate and trigger a scan immediately.

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
  - **Export CSV**: Downloads an RFC-compliant CSV file (`<domain>_cloudflare_subdomains.csv`) with `hostname,ip,cloudflare`.
  - **Export JSON**: Downloads formatted JSON array suitable for programmatic ingestion.
- **Clear Results**: Click the trash/clear icon to reset the dashboard.

---

## ⚙️ Variable Settings & Tuning

You can tune scanning parameters on the fly via the in-app **Variable Settings** modal:
1. Click **Variable Settings** in the top navigation or the **Tune Variables** link below the search bar.
2. Adjust any parameter and click **Save Variables**. Changes take effect immediately and are saved to `.env`.

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
  "candidates_found": 84,
  "discovery_source": "crt.sh",
  "duration_ms": 1420
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
from backend.features.orange_test.service import scan_subdomains

# Run scan
status_code, result = scan_subdomains("speedtest.net")

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
git clone https://github.com/username/orange-test.git
cd orange-test
```

### 2. Install Dependencies
```bash
# Install Node dependencies
npm install

# Install Python requirements
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

---

## ⚖️ Responsible Use & Security Disclaimer

**Orange Test** operates **strictly passively**:
- It **only** queries publicly available Certificate Transparency logs and performs standard DNS resolution queries.
- It **never** sends HTTP requests, port scans, exploit payloads, or brute-force queries to the target domain or its origin servers.
- Users are responsible for complying with all applicable laws and terms of service when conducting security assessments on external domains.

---

## 📄 License
Released under the [MIT License](LICENSE). Built for security researchers, network engineers, and domain administrators.
