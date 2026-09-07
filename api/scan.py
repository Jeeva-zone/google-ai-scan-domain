"""
Vercel Serverless Function: POST /api/scan
Executes passive subdomain discovery and Cloudflare IP filtering.
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

from backend.scanner import run_scan
from backend.rate_limit import check_rate_limit, extract_client_ip
from backend.config import ALLOWED_ORIGINS, API_ACCESS_KEY


class handler(BaseHTTPRequestHandler):
    def _apply_cors(self):
        origin = self.headers.get("Origin", "")
        if ALLOWED_ORIGINS and origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key, Authorization")
            self.send_header("Access-Control-Max-Age", "86400")

    def do_OPTIONS(self):
        self.send_response(204)
        self._apply_cors()
        self.end_headers()

    def do_POST(self):
        # Optional Server-Side API Key verification if API_ACCESS_KEY is set in environment
        if API_ACCESS_KEY:
            api_key = self.headers.get("X-API-Key")
            auth_header = self.headers.get("Authorization", "")
            if not api_key and auth_header.startswith("Bearer "):
                api_key = auth_header[7:].strip()
            if api_key != API_ACCESS_KEY:
                self.send_response(401)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self._apply_cors()
                self.end_headers()
                self.wfile.write(
                    json.dumps({
                        "success": False,
                        "error": {
                            "code": "UNAUTHORIZED",
                            "message": "Invalid or missing API access key.",
                        },
                    }).encode("utf-8")
                )
                return

        # Rate limiting check
        headers_dict = {k: v for k, v in self.headers.items()}
        client_ip = extract_client_ip(headers_dict, self.client_address[0] if self.client_address else None)
        is_allowed, remaining_seconds = check_rate_limit(client_ip)

        if not is_allowed:
            self.send_response(429)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Retry-After", str(remaining_seconds))
            self._apply_cors()
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "success": False,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded. Please wait {remaining_seconds} seconds before scanning again.",
                    },
                }).encode("utf-8")
            )
            return

        # Read POST body
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except (ValueError, TypeError):
            content_length = 0

        if content_length <= 0:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._apply_cors()
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "success": False,
                    "error": {
                        "code": "INVALID_DOMAIN",
                        "message": "Please enter a valid domain, for example: speedtest.net",
                    },
                }).encode("utf-8")
            )
            return

        body_bytes = self.rfile.read(content_length)
        try:
            payload = json.loads(body_bytes.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Payload must be a JSON object.")
            domain = str(payload.get("domain", "")).strip()
        except Exception:
            self.send_response(400)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self._apply_cors()
            self.end_headers()
            self.wfile.write(
                json.dumps({
                    "success": False,
                    "error": {
                        "code": "INVALID_DOMAIN",
                        "message": "Please enter a valid domain, for example: speedtest.net",
                    },
                }).encode("utf-8")
            )
            return

        status_code, response_data = run_scan(domain)

        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self._apply_cors()
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode("utf-8"))
