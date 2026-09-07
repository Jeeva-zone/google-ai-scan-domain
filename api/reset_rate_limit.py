"""
Vercel Serverless Function: /api/reset_rate_limit
Clears the in-memory rate limiting tracker.
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

from backend.rate_limit import reset_rate_limit


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        reset_rate_limit()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(
            json.dumps({"success": True, "message": "Rate limit tracker reset."}).encode("utf-8")
        )
