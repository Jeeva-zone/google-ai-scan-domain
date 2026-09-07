"""
Vercel Serverless Function: /api/config
GET: returns active environment variables.
POST: updates environment variables in process and .env file.
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

from backend.config import (
    MAX_CANDIDATES,
    DNS_CONCURRENCY,
    REQUEST_TIMEOUT,
    MAX_RESULTS,
    RATE_LIMIT_SECONDS,
    CF_CACHE_TTL_SECONDS,
    ALLOWED_ORIGINS,
)


def get_current_config():
    return {
        "MAX_CANDIDATES": int(os.environ.get("MAX_CANDIDATES", MAX_CANDIDATES)),
        "DNS_CONCURRENCY": int(os.environ.get("DNS_CONCURRENCY", DNS_CONCURRENCY)),
        "REQUEST_TIMEOUT": int(os.environ.get("REQUEST_TIMEOUT", REQUEST_TIMEOUT)),
        "MAX_RESULTS": int(os.environ.get("MAX_RESULTS", MAX_RESULTS)),
        "RATE_LIMIT_SECONDS": int(os.environ.get("RATE_LIMIT_SECONDS", RATE_LIMIT_SECONDS)),
        "CF_CACHE_TTL_SECONDS": int(os.environ.get("CF_CACHE_TTL_SECONDS", CF_CACHE_TTL_SECONDS)),
    }


class handler(BaseHTTPRequestHandler):
    def _apply_cors(self):
        origin = self.headers.get("Origin", "")
        if ALLOWED_ORIGINS and origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
        else:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")

    def do_OPTIONS(self):
        self.send_response(204)
        self._apply_cors()
        self.end_headers()

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self._apply_cors()
        self.end_headers()
        self.wfile.write(json.dumps(get_current_config()).encode("utf-8"))

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
        except (ValueError, TypeError):
            content_length = 0

        updates = {}
        if content_length > 0:
            body_bytes = self.rfile.read(content_length)
            try:
                updates = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                updates = {}

        valid_keys = [
            "MAX_CANDIDATES",
            "DNS_CONCURRENCY",
            "REQUEST_TIMEOUT",
            "MAX_RESULTS",
            "RATE_LIMIT_SECONDS",
            "CF_CACHE_TTL_SECONDS",
        ]

        for key in valid_keys:
            if key in updates and updates[key] is not None:
                try:
                    num = int(updates[key])
                    if num >= 0:
                        os.environ[key] = str(num)
                except (ValueError, TypeError):
                    pass

        # Try to persist to .env file if filesystem is writable
        try:
            env_path = os.path.join(PROJECT_ROOT, ".env")
            current = get_current_config()
            lines = [
                "# Orange Test Environment Configuration",
                f"MAX_CANDIDATES={current['MAX_CANDIDATES']}",
                f"DNS_CONCURRENCY={current['DNS_CONCURRENCY']}",
                f"REQUEST_TIMEOUT={current['REQUEST_TIMEOUT']}",
                f"MAX_RESULTS={current['MAX_RESULTS']}",
                f"RATE_LIMIT_SECONDS={current['RATE_LIMIT_SECONDS']}",
                f"CF_CACHE_TTL_SECONDS={current['CF_CACHE_TTL_SECONDS']}",
                "",
            ]
            with open(env_path, "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
        except Exception:
            pass

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._apply_cors()
        self.end_headers()
        response = {
            "success": True,
            "message": "Variables updated successfully.",
            "config": get_current_config(),
        }
        self.wfile.write(json.dumps(response).encode("utf-8"))
