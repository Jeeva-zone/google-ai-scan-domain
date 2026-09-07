import json
import os
import sys
from pathlib import Path

# Ensure root directory is in sys.path
ROOT_DIR = str(Path(__file__).resolve().parent.parent.parent)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.scanner import run_scan
from backend.rate_limit import check_rate_limit, extract_client_ip
from backend.config import ALLOWED_ORIGINS, API_ACCESS_KEY


def handler(event, context):
    method = event.get("httpMethod", "GET")
    headers = event.get("headers", {})

    origin = headers.get("origin", "")
    cors_origin = origin if (ALLOWED_ORIGINS and origin in ALLOWED_ORIGINS) else "*"

    cors_headers = {
        "Access-Control-Allow-Origin": cors_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
    }

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": cors_headers, "body": ""}

    if method != "POST":
        return {
            "statusCode": 405,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({"error": "Method Not Allowed"}),
        }

    # API key check
    if API_ACCESS_KEY:
        api_key = headers.get("x-api-key")
        auth_header = headers.get("authorization", "")
        if not api_key and auth_header.startswith("Bearer "):
            api_key = auth_header[7:].strip()
        if api_key != API_ACCESS_KEY:
            return {
                "statusCode": 401,
                "headers": {**cors_headers, "Content-Type": "application/json"},
                "body": json.dumps({
                    "success": False,
                    "error": {"code": "UNAUTHORIZED", "message": "Invalid API access key."},
                }),
            }

    # Rate limiting check
    client_ip = extract_client_ip(headers, event.get("identity", {}).get("sourceIp"))
    is_allowed, remaining_seconds = check_rate_limit(client_ip)
    if not is_allowed:
        return {
            "statusCode": 429,
            "headers": {
                **cors_headers,
                "Content-Type": "application/json",
                "Retry-After": str(remaining_seconds),
            },
            "body": json.dumps({
                "success": False,
                "error": {
                    "code": "RATE_LIMITED",
                    "message": f"Rate limit exceeded. Please wait {remaining_seconds}s.",
                },
            }),
        }

    # Parse payload
    body_str = event.get("body", "")
    domain = ""
    try:
        if body_str:
            data = json.loads(body_str)
            domain = str(data.get("domain", "")).strip()
    except Exception:
        pass

    if not domain:
        return {
            "statusCode": 400,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({
                "success": False,
                "error": {
                    "code": "INVALID_DOMAIN",
                    "message": "Please enter a valid domain, for example: speedtest.net",
                },
            }),
        }

    status_code, response_data = run_scan(domain)
    return {
        "statusCode": status_code,
        "headers": {
            **cors_headers,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
        },
        "body": json.dumps(response_data),
    }
