"""
Vercel Serverless Function: GET /api/sample-domains
Returns sample domains parsed from sample-domains.txt in the repo root.
Edit sample-domains.txt (one domain per line, # comments allowed) to
change the example chips shown in the web UI.
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import sys
from pathlib import Path

# Ensure project root is in Python module search path
PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

SAMPLE_DOMAINS_PATH = os.path.join(PROJECT_ROOT, "sample-domains.txt")

# Fallback list if sample-domains.txt is unavailable in the deployed bundle
DEFAULT_DOMAINS = [
    "speedtest.net",
    "cloudflare.com",
    "opensignal.com",
    "useinsider.com",
    "codecademy.com",
]


def load_sample_domains():
    try:
        with open(SAMPLE_DOMAINS_PATH, "r", encoding="utf-8") as f:
            raw = f.read()
    except OSError:
        return list(DEFAULT_DOMAINS)

    domains = []
    seen = set()
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        domain = trimmed.split("#", 1)[0].strip()
        if not domain or domain in seen:
            continue
        seen.add(domain)
        domains.append(domain)
    return domains if domains else list(DEFAULT_DOMAINS)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.end_headers()
        response = {"success": True, "domains": load_sample_domains()}
        self.wfile.write(json.dumps(response).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
